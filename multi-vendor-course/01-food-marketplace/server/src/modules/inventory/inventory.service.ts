import { Types } from "mongoose";
import type { ClientSession } from "mongoose";
import { config } from "../../shared/config.js";
import { withTransaction } from "../../shared/db.js";
import { ConflictError } from "../../shared/errors.js";
import { logger } from "../../shared/logger.js";
import type { PricedLine } from "../pricing/types.js";
import { Product, availableQty } from "../products/product.model.js";
import { StockReservation, type StockReservationDocument } from "./stockReservation.model.js";

export const RESERVATION_TTL_MINUTES = config.reservationTtlMinutes;

export async function reserveForCheckout(input: {
  checkoutId: string;
  lines: PricedLine[];
  expiresAt: Date;
}): Promise<StockReservationDocument[]> {
  return withTransaction(async (session) => {
    const reservations: StockReservationDocument[] = [];
    for (const line of input.lines) {
      const product = await Product.findOneAndUpdate(
        {
          _id: new Types.ObjectId(line.productId),
          isPublished: true,
          isActive: true,
          $expr: {
            $gte: [
              { $subtract: ["$stockQty", { $ifNull: ["$reservedQty", 0] }] },
              line.quantity
            ]
          }
        },
        { $inc: { reservedQty: line.quantity } },
        { new: true, session }
      );

      if (!product) {
        const current = await Product.findById(line.productId).session(session);
        throw new ConflictError(
          current
            ? `Only ${availableQty(current)} of ${line.name} are available`
            : `${line.name} is no longer available`,
          "INSUFFICIENT_STOCK",
          { productId: line.productId, available: current ? availableQty(current) : 0 }
        );
      }

      const [reservation] = await StockReservation.create(
        [
          {
            productId: product._id,
            storeId: product.storeId,
            quantity: line.quantity,
            status: "active",
            checkoutId: input.checkoutId,
            expiresAt: input.expiresAt
          }
        ],
        { session }
      );
      if (!reservation) throw new Error("Could not create stock reservation");
      reservations.push(reservation);
    }
    return reservations;
  });
}

export async function attachPaymentIntent(checkoutId: string, paymentIntentId: string) {
  await StockReservation.updateMany(
    { checkoutId, status: "active" },
    { $set: { paymentIntentId } }
  );
}

export async function confirmReservationsForCheckout(
  checkoutId: string,
  paymentIntentId: string,
  session: ClientSession
): Promise<void> {
  const reservations = await StockReservation.find({ checkoutId }).session(session);
  for (const reservation of reservations) {
    if (reservation.status === "confirmed") continue;
    if (reservation.status === "released") {
      throw new ConflictError(
        "A stock reservation expired before payment completed",
        "RESERVATION_RELEASED",
        { reservationId: reservation.id }
      );
    }

    const transitioned = await StockReservation.findOneAndUpdate(
      { _id: reservation._id, status: "active" },
      {
        $set: {
          status: "confirmed",
          confirmedAt: new Date(),
          paymentIntentId
        }
      },
      { new: true, session }
    );
    if (!transitioned) continue;

    const product = await Product.findOneAndUpdate(
      {
        _id: reservation.productId,
        stockQty: { $gte: reservation.quantity },
        reservedQty: { $gte: reservation.quantity }
      },
      { $inc: { stockQty: -reservation.quantity, reservedQty: -reservation.quantity } },
      { new: true, session }
    );
    if (!product) {
      throw new Error("INVENTORY_CONFIRM_INVARIANT_FAILED");
    }
  }
}

async function releaseOne(
  reservationId: Types.ObjectId,
  session: ClientSession,
  releasedAt: Date
): Promise<boolean> {
  const reservation = await StockReservation.findOneAndUpdate(
    { _id: reservationId, status: "active" },
    { $set: { status: "released", releasedAt } },
    { new: true, session }
  );
  if (!reservation) return false;

  await Product.updateOne(
    { _id: reservation.productId, reservedQty: { $gte: reservation.quantity } },
    { $inc: { reservedQty: -reservation.quantity } },
    { session }
  );
  return true;
}

export async function releaseReservation(reservationId: string): Promise<boolean> {
  return withTransaction(async (session) =>
    releaseOne(new Types.ObjectId(reservationId), session, new Date())
  );
}

export async function releaseForCheckout(checkoutId: string): Promise<number> {
  const active = await StockReservation.find({ checkoutId, status: "active" }).select("_id");
  if (active.length === 0) return 0;
  return withTransaction(async (session) => {
    let released = 0;
    for (const reservation of active) {
      if (await releaseOne(reservation._id, session, new Date())) released += 1;
    }
    return released;
  });
}

export async function releaseExpiredReservations(batchSize = 100): Promise<number> {
  const expired = await StockReservation.find({
    status: "active",
    expiresAt: { $lte: new Date() }
  })
    .limit(batchSize)
    .select("_id");

  let released = 0;
  for (const reservation of expired) {
    try {
      if (await releaseReservation(reservation.id)) released += 1;
    } catch (error) {
      logger.error({ err: error, reservationId: reservation.id }, "Could not release reservation");
    }
  }
  if (released > 0) logger.info({ released }, "[inventory] released expired holds");
  return released;
}

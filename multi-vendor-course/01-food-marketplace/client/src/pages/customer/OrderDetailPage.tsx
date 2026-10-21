import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useOrder } from "../../api/queries";
import { ErrorState, Spinner } from "../../components/ui";
import { OrderStatusBadge } from "../../components/OrderStatusBadge";
import { formatDate, formatMoney } from "../../lib/utils";

export function OrderDetailPage() {
  const { id = "" } = useParams();
  const orderQuery = useOrder(id);

  if (orderQuery.isLoading) return <Spinner label="Loading order" />;
  if (orderQuery.isError || !orderQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16">
        <ErrorState message="This order could not be loaded." onRetry={() => void orderQuery.refetch()} />
      </div>
    );
  }

  const order = orderQuery.data.order;
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        to="/orders"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink/60 hover:text-forest"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to orders
      </Link>

      <div className="surface mt-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-terracotta">
              Receipt
            </p>
            <h1 className="mt-1 text-3xl">{order.store?.name ?? "Vendor order"}</h1>
            <p className="mt-1 text-xs text-ink/55">
              {formatDate(order.createdAt)} · Payment {order.paymentStatus}
            </p>
          </div>
          <OrderStatusBadge status={order.status} />
        </div>

        <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-xl border border-ink/10 bg-cream/50 p-3">
            <dt className="text-xs uppercase tracking-wide text-ink/50">Order</dt>
            <dd className="mt-1 break-all font-medium">{order.id}</dd>
          </div>
          <div className="rounded-xl border border-ink/10 bg-cream/50 p-3">
            <dt className="text-xs uppercase tracking-wide text-ink/50">Payment reference</dt>
            <dd className="mt-1 break-all font-medium">{order.stripePaymentIntentId}</dd>
          </div>
        </dl>

        <div className="mt-6">
          <h2 className="text-lg">Items</h2>
          <ul className="mt-3 divide-y divide-ink/10">
            {order.items.map((item) => (
              <li key={`${order.id}-${item.productId}`} className="flex justify-between gap-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{item.name}</p>
                  <p className="text-xs text-ink/55">
                    {formatMoney(item.priceAtPurchaseCents)} per {item.unit} · quantity {item.quantity}
                  </p>
                </div>
                <div className="text-right">
                  {item.discountCents > 0 ? (
                    <p className="text-xs text-leaf">−{formatMoney(item.discountCents)}</p>
                  ) : null}
                  <p className="font-semibold">{formatMoney(item.lineTotalCents)}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 space-y-2 border-t border-ink/10 pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-ink/65">Subtotal</span>
            <span>{formatMoney(order.subtotalCents)}</span>
          </div>
          {order.discountCents > 0 ? (
            <div className="flex justify-between text-leaf">
              <span>Discount {order.couponCode ? `(${order.couponCode})` : ""}</span>
              <span>−{formatMoney(order.discountCents)}</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-semibold">
            <span>Total paid</span>
            <span>{formatMoney(order.totalCents)}</span>
          </div>
        </div>

        <p className="mt-5 text-xs text-ink/50">
          Product names, units, and prices on this receipt never change when a vendor edits the
          live catalogue.
        </p>
      </div>
    </div>
  );
}

import mongoose, { type ClientSession } from "mongoose";
import { config } from "./config.js";
import { logger } from "./logger.js";

mongoose.set("strictQuery", true);

export async function connectDatabase(uri = config.mongoUri): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
  logger.info("MongoDB connected");
}

export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export function databaseStatus(): "connected" | "disconnected" {
  return mongoose.connection.readyState === 1 ? "connected" : "disconnected";
}

export function mongooseConnection() {
  return mongoose.connection;
}

export async function withTransaction<T>(
  fn: (session: ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T | undefined;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    if (result === undefined) {
      throw new Error("Transaction completed without a result");
    }
    return result;
  } finally {
    await session.endSession();
  }
}

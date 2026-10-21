import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "./logger.js";

export class AppError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, message: string, code = "ERROR", details?: unknown) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class BadRequestError extends AppError {
  constructor(message = "Invalid request", code = "BAD_REQUEST", details?: unknown) {
    super(400, message, code, details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(403, message, "FORBIDDEN");
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, message, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflict", code = "CONFLICT", details?: unknown) {
    super(409, message, code, details);
  }
}

export class PaymentRequiredError extends AppError {
  constructor(message = "Payment required", code = "PAYMENT_REQUIRED") {
    super(402, message, code);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service unavailable", code = "SERVICE_UNAVAILABLE") {
    super(503, message, code);
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ message: "Route not found", code: "NOT_FOUND" });
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  if (error instanceof ZodError) {
    res.status(400).json({
      message: "Validation failed",
      code: "VALIDATION_ERROR",
      errors: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
    return;
  }

  if (error instanceof AppError) {
    if (error.status >= 500) {
      logger.error({ err: error, requestId: req.id }, error.message);
    }
    res.status(error.status).json({
      message: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {})
    });
    return;
  }

  if (typeof error === "object" && error && "code" in error && error.code === 11000) {
    res.status(409).json({ message: "That record already exists", code: "DUPLICATE_KEY" });
    return;
  }

  logger.error({ err: error, requestId: req.id }, "Unhandled error");
  res.status(500).json({ message: "Internal server error", code: "INTERNAL_ERROR" });
}

// middleware/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/appError";
import logger from "../utils/logger";

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || "error";

  const env = process.env.NODE_ENV || "development";

  if (env === "production") {
    // Production Mode: Log every error
    logger.error(`${err.statusCode} - ${err.message}`, {
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
    });

    // Respond differently based on error type
    if (err.isOperational) {
      res.status(err.statusCode).json({
        status: err.status,
        message: err.message,
      });
    } else {
      // Unknown error (e.g., programming bug)
      res.status(500).json({
        status: "error",
        message: "Something went wrong. Please try again later.",
      });
    }
  } else {
    // Dev Mode: log full info and show full response
    console.error("💥 ERROR:", err);
    logger.error(`${err.statusCode} - ${err.message}`, {
      stack: err.stack,
      path: req.originalUrl,
      method: req.method,
    });

    res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
      error: err,
      stack: err.stack,
    });
  }
}

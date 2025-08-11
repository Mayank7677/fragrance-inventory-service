import { NextFunction, Request, Response } from "express";
import logger from "../utils/logger";
import { AppError } from "../utils/appError";

export interface AuthenticatedRequest extends Request {
  user?: any;
}
export const isAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  if (req.user?.role !== "admin") {
    logger.warn(`Unauthorized access by ${req.user?.email}`);
    return next(new AppError("Unauthorized access", 403));
  }

  next();
};

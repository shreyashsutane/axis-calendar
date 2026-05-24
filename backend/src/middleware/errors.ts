import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';
import { env } from '../config/env';

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly errorCode?: string;

  constructor(message: string, statusCode: number = 500, errorCode?: string, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const isOperational = err instanceof AppError ? err.isOperational : false;
  const errorCode = err instanceof AppError ? err.errorCode : 'INTERNAL_SERVER_ERROR';
  const message = isOperational ? err.message : 'Something went wrong inside the API Gateway.';

  // Log the unhandled error with metadata
  logger.error(
    `API Request Error: [${req.method}] ${req.originalUrl} - Status ${statusCode}`,
    err,
    {
      method: req.method,
      path: req.originalUrl,
      ip: req.ip,
      statusCode,
      errorCode,
      isOperational,
    }
  );

  res.status(statusCode).json({
    success: false,
    error: message,
    code: errorCode,
    meta: env.NODE_ENV !== 'production' ? { stack: err.stack } : undefined,
  });
};

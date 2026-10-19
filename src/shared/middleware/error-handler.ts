import { Request, Response, NextFunction } from 'express';
import { RequestWithCorrelation } from './correlation-id';

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    correlationId?: string;
  };
}

export class AppError extends Error {
  public statusCode: number;
  public code: string;

  constructor(message: string, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function errorHandler(
  err: Error | AppError,
  req: RequestWithCorrelation,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const code = err instanceof AppError ? err.code : 'INTERNAL_ERROR';
  const correlationId = req.correlationId;

  if (statusCode >= 500) {
    console.error(`[ErrorHandler] [${correlationId}]`, err);
  }

  const payload: ApiErrorPayload = {
    error: {
      code,
      message: statusCode >= 500 ? 'An unexpected server error occurred' : err.message,
      correlationId,
    },
  };

  res.status(statusCode).json(payload);
}

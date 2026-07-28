import { Prisma } from '@prisma/client';
import { NextFunction, Request, Response } from 'express';
import { isProduction } from '../env';
import { ApiError } from '../utils/ApiError';

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} does not exist`));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      code: err.code,
      ...(err.details ? { details: err.details } : {}),
    });
  }

  // Translate the Prisma errors we can act on into meaningful HTTP responses.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      return res.status(409).json({
        success: false,
        message: `A record with this ${target} already exists`,
        code: 'DUPLICATE_RECORD',
      });
    }
    if (err.code === 'P2025') {
      return res
        .status(404)
        .json({ success: false, message: 'Resource not found', code: 'NOT_FOUND' });
    }
    if (err.code === 'P2003') {
      return res.status(409).json({
        success: false,
        message: 'This record is referenced by other records and cannot be modified',
        code: 'FOREIGN_KEY_CONSTRAINT',
      });
    }
  }

  console.error('[unhandled]', err);
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    code: 'INTERNAL_ERROR',
    ...(isProduction ? {} : { debug: err instanceof Error ? err.message : String(err) }),
  });
}

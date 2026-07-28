import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { ApiError } from '../utils/ApiError';

type Source = 'body' | 'query' | 'params';

/**
 * Validates and *replaces* the request segment with the parsed result, so
 * downstream handlers get correctly typed + coerced values (dates, numbers…).
 */
export const validate =
  (schema: AnyZodObject, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      if (source === 'query') {
        // req.query is a getter in Express 5-style setups; assign defensively.
        Object.defineProperty(req, 'query', { value: parsed, writable: true });
      } else {
        req[source] = parsed as never;
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const details = error.errors.map((e) => ({
          field: e.path.join('.') || '(root)',
          message: e.message,
        }));
        return next(ApiError.badRequest('Validation failed', details));
      }
      next(error);
    }
  };

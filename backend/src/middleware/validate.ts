import type { Request, RequestHandler } from 'express';
import type { ZodTypeAny, ZodSchema } from 'zod';
import { AppError } from '../types/api';

export interface ValidationSchemas {
  body?: ZodSchema<unknown>;
  query?: ZodSchema<unknown>;
  params?: ZodSchema<unknown>;
}

/**
 * Zod request validation middleware (BR-003.1, UR-008.5).
 *
 * Validates the request body, query string and/or route params against
 * the provided schemas before the handler runs. Failures produce a
 * 400 VALIDATION_ERROR (the error handler maps the ZodError details).
 *
 * @example
 * router.post('/services', validate({ body: createServiceSchema }), handler)
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    try {
      if (schemas.body) {
        req.body = parse(schemas.body, req.body, 'body');
      }
      if (schemas.query) {
        req.query = parse(schemas.query, req.query, 'query') as Request['query'];
      }
      if (schemas.params) {
        req.params = parse(schemas.params, req.params, 'params') as Request['params'];
      }
      next();
    } catch (error) {
      next(error);
    }
  };
}

function parse(schema: ZodTypeAny, value: unknown, location: string): unknown {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Invalid request ${location}`,
      details: result.error.issues.map((issue) => ({
        path: `${location}.${issue.path.join('.')}`,
        message: issue.message,
      })),
    });
  }
  return result.data;
}
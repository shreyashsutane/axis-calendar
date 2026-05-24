import { Request, Response, NextFunction } from 'express';
import { ZodError, ZodType } from 'zod';

export const validate = (schemas: {
  body?: ZodType<any, any, any>;
  query?: ZodType<any, any, any>;
  params?: ZodType<any, any, any>;
}) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      if (schemas.query) {
        req.query = await schemas.query.parseAsync(req.query) as any;
      }
      if (schemas.params) {
        req.params = await schemas.params.parseAsync(req.params) as any;
      }
      return next();
    } catch (error) {
      if (error instanceof ZodError) {
        const issues = error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        
        return res.status(400).json({
          success: false,
          error: 'Input validation failed.',
          code: 'VALIDATION_ERROR',
          details: issues,
        });
      }
      return next(error);
    }
  };
};

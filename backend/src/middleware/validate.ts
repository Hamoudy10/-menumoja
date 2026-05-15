import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../utils/errors';
import logger from '../utils/logger';

interface ValidationOptions {
  stripUnknown?: boolean;
}

function parseErrorMessages(error: ZodError): { message: string; messageSwahili: string } {
  const messages = error.errors.map((e) => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  });
  return {
    message: messages.join('; '),
    messageSwahili: messages.join('; '),
  };
}

export function validate(schema: ZodSchema, options: ValidationOptions = {}) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.body, {
        errorMap: (issue) => {
          const path = issue.path?.join('.') || 'value';
          return { message: `${path} is invalid` };
        },
      });

      if (options.stripUnknown !== false) {
        req.body = parsed;
      } else {
        Object.assign(req.body, parsed);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn('Validation failed', {
          path: req.path,
          method: req.method,
          errors: error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        });

        const { message, messageSwahili } = parseErrorMessages(error);
        throw new ValidationError(message, messageSwahili);
      }
      throw error;
    }
  };
}

export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.query);
      req.query = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const { message, messageSwahili } = parseErrorMessages(error);
        throw new ValidationError(message, messageSwahili);
      }
      throw error;
    }
  };
}

export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const parsed = schema.parse(req.params);
      req.params = parsed;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const { message, messageSwahili } = parseErrorMessages(error);
        throw new ValidationError(message, messageSwahili);
      }
      throw error;
    }
  };
}

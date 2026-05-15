import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { ApiResponse } from '../types';
import logger from '../utils/logger';
import { ZodError } from 'zod';

const isProduction = process.env.NODE_ENV === 'production';

interface SentryInstance {
  captureException(err: any, ctx?: any): void;
}

let Sentry: SentryInstance | null = null;
try {
  Sentry = require('@sentry/node');
} catch {
  // Sentry not configured
}

function formatZodError(error: ZodError): { message: string; messageSwahili: string } {
  const messages = error.errors.map((e) => {
    const path = e.path.join('.');
    return path ? `${path}: ${e.message}` : e.message;
  });
  return {
    message: `Validation error: ${messages.join('; ')}`,
    messageSwahili: `Hitilafu ya uthibitisho: ${messages.join('; ')}`,
  };
}

export function errorHandler(
  err: Error,
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const requestId = (req as any).requestId || 'unknown';

  if (_res.headersSent) {
    return next(err);
  }

  if (err instanceof ZodError) {
    const { message, messageSwahili } = formatZodError(err);
    const response: ApiResponse = {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message,
        messageSwahili,
      },
    };

    _res.status(422).json(response);
    return;
  }

  if (err instanceof AppError) {
    const response: ApiResponse = err.toJSON();

    if (err.statusCode >= 500) {
      logger.error(`[${requestId}] ${err.message}`, {
        stack: err.stack,
        code: err.code,
        statusCode: err.statusCode,
      });

      if (Sentry && isProduction) {
        Sentry.captureException(err, {
          tags: { requestId, code: err.code },
          user: { id: (req as any).user?.userId },
          extra: {
            method: req.method,
            url: req.url,
            ip: req.ip,
          },
        });
      }
    } else {
      logger.warn(`[${requestId}] ${err.message}`, {
        code: err.code,
        statusCode: err.statusCode,
      });
    }

    _res.status(err.statusCode).json(response);
    return;
  }

  logger.error(`[${requestId}] Unhandled error: ${err.message}`, {
    stack: err.stack,
    method: req.method,
    url: req.url,
  });

  if (Sentry && isProduction) {
    Sentry.captureException(err, {
      tags: { requestId },
      user: { id: (req as any).user?.userId },
      extra: {
        method: req.method,
        url: req.url,
        ip: req.ip,
      },
    });
  }

  const response: ApiResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: isProduction ? 'An unexpected error occurred' : err.message,
      messageSwahili: isProduction
        ? 'Hitilafu isiyotarajiwa imetokea'
        : err.message,
    },
  };

  if (!isProduction && err.stack) {
    (response.error as any).stack = err.stack;
  }

  _res.status(500).json(response);
}

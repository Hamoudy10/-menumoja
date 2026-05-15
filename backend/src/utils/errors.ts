export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly messageSwahili: string;
  public readonly isOperational: boolean;

  constructor(
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    message: string = 'An unexpected error occurred',
    messageSwahili: string = 'Hitilafu isiyotarajiwa imetokea'
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.messageSwahili = messageSwahili;
    this.isOperational = true;
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        messageSwahili: this.messageSwahili,
      },
    };
  }

  static badRequest(message: string, swahili?: string): AppError {
    return new AppError(400, 'BAD_REQUEST', message, swahili || 'Ombi batili');
  }

  static unauthorized(message?: string, swahili?: string): AppError {
    return new AppError(401, 'UNAUTHORIZED', message || 'Authentication required', swahili || 'Uhakiki unahitajika');
  }

  static forbidden(message?: string, swahili?: string): AppError {
    return new AppError(403, 'FORBIDDEN', message || 'Access denied', swahili || 'Huna ruhusa');
  }

  static notFound(message?: string, swahili?: string): AppError {
    return new AppError(404, 'NOT_FOUND', message || 'Resource not found', swahili || 'Rasilimali haikupatikana');
  }

  static conflict(message: string, swahili?: string): AppError {
    return new AppError(409, 'CONFLICT', message, swahili || 'Mgutano uliotokea');
  }

  static validation(message: string, swahili?: string): AppError {
    return new AppError(422, 'VALIDATION_ERROR', message, swahili || 'Hitilafu ya uthibitisho');
  }

  static rateLimit(message?: string, swahili?: string): AppError {
    return new AppError(429, 'RATE_LIMIT', message || 'Too many requests', swahili || 'Maombi mengi sana');
  }

  static internal(message?: string, swahili?: string): AppError {
    return new AppError(500, 'INTERNAL_ERROR', message || 'Internal server error', swahili || 'Hitilafu ya ndani ya seva');
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found', messageSwahili: string = 'Rasilimali haikupatikana') {
    super(404, 'NOT_FOUND', message, messageSwahili);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed', messageSwahili: string = 'Uthibitisho umeshindwa') {
    super(422, 'VALIDATION_ERROR', message, messageSwahili);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required', messageSwahili: string = 'Uhakiki unahitajika') {
    super(401, 'UNAUTHORIZED', message, messageSwahili);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'Access denied', messageSwahili: string = 'Huna ruhusa') {
    super(403, 'FORBIDDEN', message, messageSwahili);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource already exists', messageSwahili: string = 'Rasilimali tayari ipo') {
    super(409, 'CONFLICT', message, messageSwahili);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests', messageSwahili: string = 'Maombi mengi sana') {
    super(429, 'RATE_LIMIT', message, messageSwahili);
  }
}

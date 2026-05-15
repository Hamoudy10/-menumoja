import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { UnauthorizedError, ForbiddenError, AppError } from '../utils/errors';
import logger from '../utils/logger';

function getAccessSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) {
    throw new Error('JWT_ACCESS_SECRET environment variable is not set');
  }
  return secret;
}

function getRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET environment variable is not set');
  }
  return secret;
}

function extractToken(req: AuthenticatedRequest): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;

  return parts[1];
}

function verifyToken(token: string, secret: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, secret) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Token has expired', 'Muda wa token umeisha');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new UnauthorizedError('Invalid token', 'Token batili');
    }
    throw new UnauthorizedError('Authentication failed', 'Uhakiki umeshindwa');
  }
}

export function authenticate(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);
  if (!token) {
    throw new UnauthorizedError('No token provided', 'Hakuna token iliyotolewa');
  }

  const payload = verifyToken(token, getAccessSecret());

  if (payload.type !== 'access') {
    throw new UnauthorizedError('Invalid token type', 'Aina batili ya token');
  }

  req.user = payload;
  logger.debug('User authenticated', {
    userId: payload.userId,
    role: payload.role,
    requestId: (req as any).requestId,
  });

  next();
}

export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req);
  if (!token) {
    return next();
  }

  try {
    const payload = verifyToken(token, getAccessSecret());
    if (payload.type === 'access') {
      req.user = payload;
    }
  } catch {
    // Silently ignore auth errors for optional auth
  }

  next();
}

export function verifyRefreshToken(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = req.cookies?.refreshToken;
  if (!token) {
    throw new UnauthorizedError('No refresh token provided', 'Hakuna refresh token');
  }

  const payload = verifyToken(token, getRefreshSecret());

  if (payload.type !== 'refresh') {
    throw new UnauthorizedError('Invalid token type', 'Aina batili ya token');
  }

  req.user = payload;
  next();
}

export function verifyStaffPin(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const pin = req.headers['x-staff-pin'] as string;
  if (!pin) {
    throw new UnauthorizedError('Staff PIN required', 'PIN ya mfanyakazi inahitajika');
  }

  if (!/^\d{4,6}$/.test(pin)) {
    throw new ForbiddenError('Invalid PIN format', 'Fomati batili ya PIN');
  }

  req.user = {
    ...(req.user as JwtPayload),
    pin,
  } as any;

  next();
}

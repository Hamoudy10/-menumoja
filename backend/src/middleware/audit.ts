import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
import logger from '../utils/logger';
import { prisma } from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const STATE_CHANGING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

const SENSITIVE_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/reset-password',
  '/payments',
  '/staff',
  '/settings',
];

function isSensitivePath(path: string): boolean {
  return SENSITIVE_PATHS.some((p) => path.startsWith(p));
}

/**
 * Persists an audit entry to the audit_logs table.
 * Fire-and-forget: a persistence failure must never break the request.
 */
function persistAuditEntry(entry: Record<string, any>): void {
  prisma.auditLog
    .create({
      data: {
        restaurantId: entry.restaurantId || null,
        userId: entry.userId === 'anonymous' || entry.userId === 'system' ? null : entry.userId,
        role: entry.role,
        action: entry.action || `${entry.method} ${entry.path}`,
        resourceType: entry.resourceType,
        resourceId: entry.resourceId,
        method: entry.method,
        path: entry.path,
        statusCode: entry.statusCode,
        durationMs: entry.duration,
        requestId: entry.requestId,
        ipAddress: entry.clientInfo?.ip,
        userAgent: entry.clientInfo?.userAgent,
        details: entry.details || entry.body || undefined,
        sensitivity: entry.sensitivity,
      },
    })
    .catch((error) => {
      logger.warn('Audit log persistence failed', { error: error.message, auditId: entry.auditId });
    });
}

function sanitizeBody(body: Record<string, any>): Record<string, any> {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = [
    'password',
    'pin',
    'token',
    'otp',
    'secret',
    'authorization',
    'creditCard',
    'cvv',
  ];

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeBody(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function getClientInfo(req: AuthenticatedRequest) {
  return {
    ip: req.ip || req.socket?.remoteAddress,
    userAgent: req.headers['user-agent']?.slice(0, 500),
    referer: req.headers['referer'],
  };
}

export function auditLog(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const originalEnd = _res.end;
  const startTime = Date.now();
  const auditId = uuidv4();

  (req as any).auditId = auditId;

  const originalJson = _res.json.bind(_res);
  _res.json = function (body: any) {
    const duration = Date.now() - startTime;

    if (STATE_CHANGING_METHODS.includes(req.method)) {
      const auditEntry: Record<string, any> = {
        auditId,
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        statusCode: _res.statusCode,
        duration,
        userId: req.user?.userId || 'anonymous',
        role: req.user?.role || 'anonymous',
        restaurantId: req.user?.restaurantId || (req as any).restaurantId,
        clientInfo: getClientInfo(req),
        body: sanitizeBody(req.body),
        query: req.query,
        params: req.params,
        result: _res.statusCode >= 400 ? 'failure' : 'success',
      };

      if (isSensitivePath(req.path)) {
        auditEntry.sensitivity = 'high';
        auditEntry.body = {
          ...auditEntry.body,
          _hasSensitiveData_: true,
        };
      }

      auditEntry.requestId = (req as any).requestId;
      persistAuditEntry(auditEntry);

      if (_res.statusCode >= 400) {
        logger.warn('Audit: state change', auditEntry);
      } else {
        logger.info('Audit: state change', auditEntry);
      }
    }

    return originalJson(body);
  };

  next();
}

export function createAuditEntry(
  action: string,
  resourceType: string,
  resourceId: string,
  details: Record<string, any>,
  userId?: string,
  restaurantId?: string
): void {
  const entry = {
    auditId: uuidv4(),
    timestamp: new Date().toISOString(),
    action,
    resourceType,
    resourceId,
    details: sanitizeBody(details),
    userId: userId || 'system',
    restaurantId,
  };

  persistAuditEntry(entry);
  logger.info('Audit: custom entry', entry);
}

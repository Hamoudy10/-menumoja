import { Request } from 'express';
import { Prisma } from '@prisma/client';
import { redis } from '@/config/redis';
import { prisma } from '@/config/database';

const IDEMPOTENCY_TTL_SECONDS = 24 * 60 * 60;

export const IDEMPOTENCY_RACE_CODE = 'P2002';

/**
 * Extracts an idempotency key from the request headers.
 * Accepted headers: Idempotency-Key | x-idempotency-key
 * Returns null when absent or malformed (the request then proceeds without
 * idempotency protection).
 */
export function getIdempotencyKey(req: Request): string | null {
  const raw = req.headers['idempotency-key'] ?? req.headers['x-idempotency-key'];
  if (!raw) return null;
  const key = String(raw).trim();
  if (!key || key.length > 128) return null;
  return key;
}

/**
 * Looks up an order previously created under the given idempotency key.
 * Checks Redis first (fast path), then falls back to the database unique
 * constraint (covers races and Redis data loss).
 */
export async function findIdempotentOrder(key: string, scope: string): Promise<any | null> {
  const redisKey = `idempotency:order:${scope}:${key}`;
  const orderId = await redis.get(redisKey);
  if (orderId) {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    });
    if (order) return order;
  }

  const order = await prisma.order.findFirst({
    where: { idempotencyKey: key },
    include: { items: true },
  });
  return order;
}

/**
 * Records a successful order creation against the idempotency key.
 */
export async function recordIdempotency(key: string, scope: string, orderId: string): Promise<void> {
  await redis.set(`idempotency:order:${scope}:${key}`, orderId, 'EX', IDEMPOTENCY_TTL_SECONDS);
}

/**
 * Returns true when the error is a Prisma unique-constraint violation.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    (error as { code?: string }).code === IDEMPOTENCY_RACE_CODE
  );
}

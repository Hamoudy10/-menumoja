import { Prisma } from '@prisma/client';
import { prisma } from '@/config/database';
import { AppError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Offline-first sync engine (Phase 2, Increment 1).
 *
 * Principle (from the roadmap): every transaction carries a globally unique
 * identity — `restaurant_id + device_id + client_transaction_id` — so the same
 * logical transaction generated on a device can never be double-applied, even
 * across devices or after a reconnect.
 *
 * The cloud is the source of truth. Devices buffer mutations locally (see the
 * client offline queue) and replay them here. Replays are idempotent: the
 * unique `(restaurantId, deviceId, clientTransactionId)` on orders/payments
 * plus the durable `sync_changes` (outbox) log make a replay a no-op.
 *
 * `sync_changes` is the durable outbox: every mutation is recorded here before
 * (or as) it is applied, so a local node / future sync worker can also consume
 * and reconcile it.
 */

export interface MutationInput {
  restaurantId: string;
  deviceId?: string | null;
  clientTransactionId?: string | null;
  entityType: 'ORDER' | 'PAYMENT';
  mutationType: string;
  entityId?: string | null;
  payload: Record<string, unknown>;
}

/**
 * Records a mutation into the durable sync-changes (outbox) log.
 * Idempotent on `(restaurantId, deviceId, clientTransactionId)` — a replay
 * returns the existing row instead of creating a duplicate.
 */
export async function recordMutation(input: MutationInput): Promise<{ change: any; isNew: boolean }> {
  const { restaurantId, deviceId, clientTransactionId } = input;

  if (!deviceId || !clientTransactionId) {
    // No device identity — nothing to track durably, but do not block.
    return { change: null, isNew: false };
  }

  const data = {
    restaurantId,
    deviceId,
    clientTransactionId,
    entityType: input.entityType,
    mutationType: input.mutationType,
    payload: input.payload as Prisma.InputJsonValue,
    ...(input.entityId ? { entityId: input.entityId } : {}),
  };

  try {
    const change = await prisma.syncChange.create({ data });
    return { change, isNew: true };
  } catch (error: any) {
    // Unique (restaurantId, deviceId, clientTransactionId) — already recorded.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const existing = await prisma.syncChange.findUnique({
        where: { restaurantId_deviceId_clientTransactionId: { restaurantId, deviceId: deviceId!, clientTransactionId: clientTransactionId! } },
      });
      return { change: existing, isNew: false };
    }
    throw error;
  }
}

/** Finds a previously-recorded sync change by its device transaction id. */
export async function findChange(restaurantId: string, deviceId: string, clientTransactionId: string): Promise<any | null> {
  return prisma.syncChange.findUnique({
    where: { restaurantId_deviceId_clientTransactionId: { restaurantId, deviceId, clientTransactionId } },
  });
}

/** Marks a sync change as applied, linking the resulting entity id. */
export async function markApplied(changeId: string, entityId: string): Promise<void> {
  await prisma.syncChange.update({
    where: { id: changeId },
    data: { status: 'APPLIED', entityId, appliedAt: new Date() },
  }).catch((error) => {
    logger.warn('markApplied failed', { changeId, entityId, error: (error as Error).message });
  });
}

/** Idempotent lookup: an order already created by this device+transaction. */
export async function findOrderByClientTxn(restaurantId: string, deviceId: string, clientTransactionId: string): Promise<any | null> {
  return prisma.order.findFirst({
    where: { restaurantId, deviceId, clientTransactionId },
    include: { items: { take: 100 } },
  });
}

/** Idempotent lookup: a payment already created by this device+transaction. */
export async function findPaymentByClientTxn(restaurantId: string, deviceId: string, clientTransactionId: string): Promise<any | null> {
  return prisma.payment.findFirst({
    where: { restaurantId, deviceId, clientTransactionId },
  });
}

/** Lists sync changes for audit/support. */
export async function listChanges(restaurantId: string, status?: 'PENDING' | 'APPLIED' | 'all', take = 100): Promise<any[]> {
  return prisma.syncChange.findMany({
    where: { restaurantId, ...(status && status !== 'all' ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take,
  });
}

/** Throws when neither deviceId nor clientTransactionId is supplied to a replay. */
export function requireDeviceIdentity(deviceId?: string | null, clientTransactionId?: string | null): void {
  if (!deviceId || !clientTransactionId) {
    throw AppError.validation('deviceId and clientTransactionId are required for sync', 'Vitambulisho vya kifaa vinahitajika');
  }
}

export default { recordMutation, findChange, markApplied, findOrderByClientTxn, findPaymentByClientTxn, listChanges, requireDeviceIdentity };

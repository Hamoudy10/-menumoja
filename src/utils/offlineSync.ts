import { offlineQueue, type QueuedMutation } from './offline.ts'
import { createPosOrder } from '@/api/orders'
import { recordCashPayment, recordCardPayment } from '@/api/payments'

/**
 * Maps queued offline mutations to the real API calls.
 * Every call carries its idempotency key so replays are safe.
 */
export async function syncMutation(mutation: QueuedMutation): Promise<void> {
  switch (mutation.type) {
    case 'createPosOrder':
      await createPosOrder(mutation.payload, mutation.idempotencyKey)
      return
    case 'recordCashPayment':
      await recordCashPayment(mutation.payload, mutation.idempotencyKey)
      return
    case 'recordCardPayment':
      await recordCardPayment(
        String(mutation.payload.orderId),
        Number(mutation.payload.amount),
        mutation.idempotencyKey
      )
      return
  }
}

export function flushOfflineQueue() {
  return offlineQueue.flush(syncMutation)
}

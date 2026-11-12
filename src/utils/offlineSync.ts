import { offlineQueue, getDeviceId, type QueuedMutation } from './offline.ts'
import { createPosOrder } from '@/api/orders'
import { recordCashPayment, recordCardPayment } from '@/api/payments'

/**
 * Maps queued offline mutations to the real API calls.
 * Every call carries its idempotency key + a global device identity
 * (deviceId + clientTransactionId), so replays are safe and the server can
 * dedupe by device+transaction even across devices.
 */
export async function syncMutation(mutation: QueuedMutation): Promise<void> {
  const deviceId = getDeviceId()
  const clientTransactionId = mutation.idempotencyKey || deviceId
  switch (mutation.type) {
    case 'createPosOrder':
      await createPosOrder({ ...mutation.payload, deviceId, clientTransactionId }, mutation.idempotencyKey)
      return
    case 'recordCashPayment':
      await recordCashPayment({ ...mutation.payload, deviceId, clientTransactionId }, mutation.idempotencyKey)
      return
    case 'recordCardPayment':
      await recordCardPayment(
        String(mutation.payload.orderId),
        Number(mutation.payload.amount),
        mutation.idempotencyKey,
        { deviceId, clientTransactionId }
      )
      return
  }
}

export function flushOfflineQueue() {
  return offlineQueue.flush(syncMutation)
}

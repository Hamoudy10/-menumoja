import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createOfflineQueue, isNetworkError, type StorageLike, type QueuedMutation } from './offline.ts'

function memoryStorage(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>()
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  }
}

describe('offline queue', () => {
  let storage: ReturnType<typeof memoryStorage>
  let queue: ReturnType<typeof createOfflineQueue>

  beforeEach(() => {
    storage = memoryStorage()
    queue = createOfflineQueue(storage)
  })

  it('enqueues mutations in order with their idempotency keys', () => {
    queue.enqueue('createPosOrder', { items: [{ name: 'A' }] }, 'key-1')
    queue.enqueue('recordCashPayment', { orderId: 'x', amount: 500 }, 'key-2')

    const items = queue.getQueue()
    expect(items).toHaveLength(2)
    expect(items[0].type).toBe('createPosOrder')
    expect(items[0].idempotencyKey).toBe('key-1')
    expect(items[1].type).toBe('recordCashPayment')
    expect(items[1].attempts).toBe(0)
  })

  it('does not double-enqueue the same idempotency key', () => {
    queue.enqueue('createPosOrder', { items: [] }, 'same-key')
    const duplicate = queue.enqueue('createPosOrder', { items: [] }, 'same-key')

    expect(queue.getPendingCount()).toBe(1)
    expect(duplicate.idempotencyKey).toBe('same-key')
  })

  it('persists the queue across queue instances (localStorage durability)', () => {
    queue.enqueue('createPosOrder', { items: [{ name: 'B' }] }, 'key-persist')
    const reloaded = createOfflineQueue(storage)
    expect(reloaded.getPendingCount()).toBe(1)
  })

  it('flushes mutations in order and clears them on success', async () => {
    queue.enqueue('createPosOrder', {}, 'k1')
    queue.enqueue('recordCashPayment', {}, 'k2')

    const sent: string[] = []
    const result = await queue.flush(async (m: QueuedMutation) => {
      sent.push(m.idempotencyKey)
    })

    expect(sent).toEqual(['k1', 'k2'])
    expect(result).toEqual({ total: 2, synced: 2, failed: 0 })
    expect(queue.getPendingCount()).toBe(0)
    expect(queue.getStatus()).toBe('online')
  })

  it('keeps failed mutations and reports them, bounding attempts', async () => {
    queue.enqueue('createPosOrder', {}, 'k-fail')
    queue.enqueue('createPosOrder', {}, 'k-ok')

    let calls = 0
    const result = await queue.flush(async (m: QueuedMutation) => {
      calls++
      if (m.idempotencyKey === 'k-fail') throw new Error('server rejected')
    })

    expect(result.failed).toBe(1)
    expect(result.synced).toBe(1)
    const remaining = queue.getQueue()
    expect(remaining).toHaveLength(1)
    expect(remaining[0].idempotencyKey).toBe('k-fail')
    expect(remaining[0].attempts).toBe(1)
    expect(queue.getStatus()).toBe('offline')
  })

  it('marks sync_error when a mutation exhausts its attempts', async () => {
    queue.enqueue('recordCashPayment', {}, 'k-doomed')

    for (let i = 0; i < 5; i++) {
      await queue.flush(async () => {
        throw new Error('always fails')
      })
    }

    expect(queue.getPendingCount()).toBe(0)
    expect(queue.getStatus()).toBe('sync_error')
  })

  it('sets syncing during flush and returns online for an empty queue', async () => {
    expect(queue.getStatus()).toBe('online')
    queue.enqueue('createPosOrder', {}, 'k-sync')
    queue.setStatus('syncing')
    expect(queue.getStatus()).toBe('syncing')

    await queue.flush(async () => {})
    expect(queue.getStatus()).toBe('online')
  })

  it('clear() empties the queue', () => {
    queue.enqueue('createPosOrder', {}, 'k-clear')
    queue.clear()
    expect(queue.getPendingCount()).toBe(0)
  })
})

describe('isNetworkError', () => {
  it('recognizes axios network errors and missing responses', () => {
    expect(isNetworkError({ code: 'ERR_NETWORK' })).toBe(true)
    expect(isNetworkError({})).toBe(true)
    expect(isNetworkError({ response: { status: 422 } })).toBe(false)
    expect(isNetworkError({ response: { status: 409 } })).toBe(false)
  })
})

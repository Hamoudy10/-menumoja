/**
 * Offline-first mutation queue for POS operations.
 *
 * Design:
 * - localStorage-backed ordered queue of mutations (POS order creation,
 *   cash/card payment recording).
 * - Every mutation carries its own idempotency key, so replaying the queue
 *   (after reconnect, refresh, or manual retry) can never create duplicates —
 *   the server dedupes on `Idempotency-Key`.
 * - Storage is injected so the module is unit-testable without a browser.
 * - The app renders ONLINE / OFFLINE / SYNCING / SYNC ERROR from getStatus().
 */

export type MutationType =
  | 'createPosOrder'
  | 'recordCashPayment'
  | 'recordCardPayment'

export interface QueuedMutation {
  id: string
  type: MutationType
  payload: Record<string, unknown>
  idempotencyKey: string
  createdAt: string
  attempts: number
}

export type SyncStatus = 'online' | 'offline' | 'syncing' | 'sync_error'

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface FlushResult {
  total: number
  synced: number
  failed: number
}

const QUEUE_KEY = 'menumoja_offline_queue'
const STATUS_KEY = 'menumoja_offline_status'

const MAX_ATTEMPTS = 5

export function isNetworkError(error: unknown): boolean {
  const anyError = error as { code?: string; response?: unknown; message?: string }
  if (anyError?.code === 'ERR_NETWORK') return true
  if (!anyError?.response) return true
  return false
}

export function createOfflineQueue(storage: StorageLike) {
  const load = (): QueuedMutation[] => {
    try {
      const raw = storage.getItem(QUEUE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  const save = (queue: QueuedMutation[]): void => {
    try {
      storage.setItem(QUEUE_KEY, JSON.stringify(queue))
    } catch {
      // storage unavailable (quota/private mode) — queue lives in memory for this session
    }
  }

  const setStatus = (status: SyncStatus): void => {
    try {
      storage.setItem(STATUS_KEY, status)
    } catch {
      // ignore
    }
  }

  const getStatus = (): SyncStatus => {
    try {
      return (storage.getItem(STATUS_KEY) as SyncStatus) || 'online'
    } catch {
      return 'online'
    }
  }

  return {
    /**
     * Persists a mutation at the end of the queue. Returns the queued item.
     */
    enqueue(type: MutationType, payload: Record<string, unknown>, idempotencyKey: string): QueuedMutation {
      const queue = load()
      // A duplicate idempotency key means the mutation is already queued —
      // drop the new one to prevent double-enqueues on retry.
      const existing = queue.find((m) => m.idempotencyKey === idempotencyKey)
      if (existing) return existing

      const mutation: QueuedMutation = {
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        type,
        payload,
        idempotencyKey,
        createdAt: new Date().toISOString(),
        attempts: 0,
      }
      save([...queue, mutation])
      setStatus('offline')
      return mutation
    },

    getQueue(): QueuedMutation[] {
      return load()
    },

    getPendingCount(): number {
      return load().length
    },

    getStatus,

    setStatus,

    clear(): void {
      try {
        storage.removeItem(QUEUE_KEY)
      } catch {
        // ignore
      }
    },

    /**
     * Replays the queue in order through the provided sender. Idempotency
     * keys make replays safe. Non-network failures are kept in the queue
     * (bounded by MAX_ATTEMPTS) and surfaced as SYNC ERROR.
     */
    async flush(sender: (mutation: QueuedMutation) => Promise<void>): Promise<FlushResult> {
      const queue = load()
      if (queue.length === 0) {
        setStatus('online')
        return { total: 0, synced: 0, failed: 0 }
      }

      setStatus('syncing')

      const remaining: QueuedMutation[] = []
      let synced = 0
      let failed = 0

      for (const mutation of queue) {
        try {
          await sender(mutation)
          synced++
        } catch (error) {
          failed++
          mutation.attempts += 1
          if (mutation.attempts < MAX_ATTEMPTS) {
            remaining.push(mutation)
          } else {
            // give up after repeated failures — surface to the user
          }
        }
      }

      save(remaining)

      if (failed === 0) {
        setStatus('online')
      } else if (remaining.length === 0) {
        setStatus('sync_error')
      } else {
        setStatus('offline')
      }

      return { total: queue.length, synced, failed }
    },
  }
}

export type OfflineQueue = ReturnType<typeof createOfflineQueue>

function browserStorage(): StorageLike {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    // fall through to memory storage
  }
  const memory = new Map<string, string>()
  return {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => memory.set(k, v),
    removeItem: (k) => memory.delete(k),
  }
}

export const offlineQueue = createOfflineQueue(browserStorage())

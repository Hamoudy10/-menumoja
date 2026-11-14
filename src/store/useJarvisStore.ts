import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CommandPlan, CommandProposal, WorkflowStepResult } from '@/api/command'

/**
 * Persistent Jarvis session.
 *
 * - Survives dashboard tab switches (the router no longer remounts the layout)
 *   and full reloads (localStorage).
 * - Keyed to the restaurant; the component resets it when the restaurant
 *   changes and logout clears it, so one account never sees another's chat.
 * - Capped at 40 messages to keep storage small.
 */

export type ProposalState = 'pending' | 'executing' | 'done' | 'rejected' | 'failed'
export type PlanState = 'pending' | 'executing' | 'done' | 'partial' | 'failed' | 'cancelled' | 'undone'

export interface JarvisMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
  kind?: 'answer' | 'clarify' | 'proposal' | 'plan' | 'refused' | 'error'
  data?: any
  toolUsed?: string | null
  options?: Array<{ id: string; label: string }>
  proposal?: CommandProposal
  proposalState?: ProposalState
  plan?: CommandPlan
  planState?: PlanState
  planSteps?: WorkflowStepResult[]
  undoUntil?: string
  feedback?: 'up' | 'down'
}

interface JarvisState {
  restaurantId: string | null
  conversationId?: string
  open: boolean
  messages: JarvisMessage[]
  setOpen: (open: boolean | ((prev: boolean) => boolean)) => void
  setRestaurant: (restaurantId: string | null) => void
  setConversationId: (id?: string) => void
  setMessages: (next: JarvisMessage[] | ((prev: JarvisMessage[]) => JarvisMessage[])) => void
  reset: () => void
}

export const useJarvisStore = create<JarvisState>()(
  persist(
    (set) => ({
      restaurantId: null,
      conversationId: undefined,
      open: false,
      messages: [],
      setOpen: (open) =>
        set((state) => ({ open: typeof open === 'function' ? open(state.open) : open })),
      setRestaurant: (restaurantId) => set({ restaurantId }),
      setConversationId: (conversationId) => set({ conversationId }),
      setMessages: (next) =>
        set((state) => ({
          messages: (typeof next === 'function' ? next(state.messages) : next).slice(-40),
        })),
      reset: () => set({ conversationId: undefined, messages: [] }),
    }),
    {
      name: 'menumoja-jarvis',
      partialize: (state) => ({
        restaurantId: state.restaurantId,
        conversationId: state.conversationId,
        open: state.open,
        messages: state.messages,
      }),
    }
  )
)

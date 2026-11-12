import api from './client'

const unwrap = (r: any) => r.data?.data || r.data

export interface CommandClarification {
  question: string
  options: Array<{ id: string; label: string }>
}

export interface CommandProposal {
  id: string
  tool: string
  label: string
  args: Record<string, unknown>
  summary: string
  risk: 'low' | 'high'
  undoWindowSeconds?: number
}

export type CommandResponse =
  | { kind: 'answer'; reply: string; data?: any; toolUsed: string | null; conversationId: string }
  | { kind: 'clarify'; reply: string; clarification: CommandClarification; toolUsed: string | null; conversationId: string }
  | { kind: 'proposal'; reply: string; proposal: CommandProposal; toolUsed: string; conversationId: string }
  | { kind: 'refused'; reply: string; toolUsed: null; conversationId: string }

export interface UiContext {
  route?: string
  screen?: string
  entityType?: string
  entityId?: string
}

export const sendCommand = (
  text: string,
  options: { conversationId?: string; uiContext?: UiContext } = {}
): Promise<CommandResponse> =>
  api.post('/ai/command', { text, ...options }).then(unwrap)

export const confirmAction = (actionId: string) =>
  api.post(`/ai/command/${actionId}/confirm`).then(unwrap)

export const rejectAction = (actionId: string) =>
  api.post(`/ai/command/${actionId}/reject`).then(unwrap)

export const undoAction = (actionId: string) =>
  api.post(`/ai/command/${actionId}/undo`).then(unwrap)

export const transcribeAudio = (form: FormData) =>
  api
    .post('/ai/command/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then(unwrap)

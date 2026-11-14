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

export interface PlanStep {
  actionId: string
  tool: string
  label: string
  args: Record<string, unknown>
  summary: string
  risk: 'low' | 'high'
  undoWindowSeconds?: number
}

export interface CommandPlan {
  id: string
  title: string
  steps: PlanStep[]
}

export interface WorkflowStepResult {
  actionId: string
  tool: string
  summary: string
  status: 'EXECUTED' | 'FAILED' | 'SKIPPED' | 'PENDING' | 'REJECTED' | 'UNDONE' | string
  message?: string
  undoUntil?: string
}

export type CommandResponse =
  | { kind: 'answer'; reply: string; data?: any; toolUsed: string | null; conversationId: string }
  | { kind: 'clarify'; reply: string; clarification: CommandClarification; toolUsed: string | null; conversationId: string }
  | { kind: 'proposal'; reply: string; proposal: CommandProposal; toolUsed: string; conversationId: string }
  | { kind: 'plan'; reply: string; plan: CommandPlan; toolUsed: 'plan'; conversationId: string }
  | { kind: 'refused'; reply: string; toolUsed: null; conversationId: string }

export interface UiContext {
  route?: string
  screen?: string
  entityType?: string
  entityId?: string
}

export const sendCommand = (
  text: string,
  options: { conversationId?: string; uiContext?: UiContext; language?: 'en' | 'sw' } = {}
): Promise<CommandResponse> =>
  api.post('/ai/command', { text, ...options }).then(unwrap)

export const confirmAction = (actionId: string) =>
  api.post(`/ai/command/${actionId}/confirm`).then(unwrap)

export const rejectAction = (actionId: string) =>
  api.post(`/ai/command/${actionId}/reject`).then(unwrap)

export const undoAction = (actionId: string) =>
  api.post(`/ai/command/${actionId}/undo`).then(unwrap)

export const confirmWorkflow = (workflowId: string) =>
  api.post(`/ai/command/workflows/${workflowId}/confirm`).then(unwrap)

export const cancelWorkflow = (workflowId: string) =>
  api.post(`/ai/command/workflows/${workflowId}/cancel`).then(unwrap)

export const undoWorkflow = (workflowId: string) =>
  api.post(`/ai/command/workflows/${workflowId}/undo`).then(unwrap)

export const sendFeedback = (data: {
  conversationId?: string
  tool?: string
  rating: 'up' | 'down'
  comment?: string
}) => api.post('/ai/command/feedback', data).then(unwrap)

export const transcribeAudio = (form: FormData) =>
  api
    .post('/ai/command/transcribe', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    .then(unwrap)

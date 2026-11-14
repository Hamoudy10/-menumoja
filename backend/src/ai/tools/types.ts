import { z } from 'zod';

/**
 * Unified AI Command ("Jarvis") tool contract.
 *
 * Security invariants (do not weaken):
 *  - The server derives `role`, `restaurantId` and `userId` from the JWT. They
 *    are never accepted from the request body or the LLM.
 *  - Every tool is tenant-scoped through `ctx.restaurantId`.
 *  - The LLM only selects a tool and supplies human names/values. It never
 *    supplies database IDs and never executes SQL.
 *  - Entity resolution happens server-side. Ambiguity must produce a
 *    clarification; it must never silently guess.
 *  - Write tools are proposed, then explicitly confirmed. Nothing auto-runs.
 */

export type ToolKind = 'read' | 'write';
/** Write risk. Reads have no risk (kind === 'read'). */
export type ToolRisk = 'low' | 'high';

export type CommandRole = 'owner' | 'manager' | 'cashier' | 'waiter' | 'kitchen' | 'super_admin';

export interface UIContext {
  route?: string;
  screen?: string;
  entityType?: string;
  entityId?: string;
}

export interface ToolContext {
  restaurantId: string;
  userId: string;
  role: string;
  uiContext?: UIContext;
  conversationId?: string;
}

export interface ClarificationOption {
  id: string;
  label: string;
}

export interface Clarification {
  question: string;
  options: ClarificationOption[];
}

export interface ToolPreview {
  /** Human-readable line shown on the confirmation card. */
  summary: string;
  /** Snapshot needed by `compensate` to undo a write. Never contains secrets. */
  before?: Record<string, unknown>;
  details?: Record<string, unknown>;
}

export type ResolveOutcome =
  | { ok: true; args: Record<string, unknown>; preview: ToolPreview }
  | { ok: false; clarification: Clarification };

export interface ToolRunResult {
  message?: string;
  data?: any;
}

export interface Tool {
  key: string;
  label: string;
  description: string;
  kind: ToolKind;
  risk?: ToolRisk;
  roles: CommandRole[];
  inputSchema: z.ZodTypeAny;
  jsonSchema: Record<string, unknown>;
  /** Resolve human names → stable IDs, detect ambiguity, build the preview. */
  resolve: (ctx: ToolContext, args: Record<string, unknown>) => Promise<ResolveOutcome>;
  /** Execute the read or the confirmed write. */
  run: (ctx: ToolContext, args: Record<string, unknown>) => Promise<ToolRunResult>;
  /**
   * Optional deterministic summary for a read result. When present, the command
   * layer uses it instead of an LLM answer (cheaper, consistent, no raw JSON
   * artifacts like "changePct: null" leaking into the reply).
   */
  summarize?: (data: any) => string;
  /**
   * Compensating action for low/high-risk reversible writes. Undo is a *new*
   * domain action, never a database rollback.
   */
  compensate?: (ctx: ToolContext, args: Record<string, unknown>, before: Record<string, unknown> | null) => Promise<ToolRunResult>;
  /** Seconds an executed write remains undoable (only if `compensate` exists). */
  undoWindowSeconds?: number;
  /** True when the tool triggers irreversible side effects (printers, STK, SMS). */
  irreversible?: boolean;
}

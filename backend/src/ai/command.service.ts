import { randomUUID } from 'crypto';
import { prisma } from '@/config/database';
import logger from '@/utils/logger';
import { AppError, NotFoundError, ConflictError } from '@/utils/errors';
import { getTool, isToolAllowed, toLlmToolSpecs, toolsForRole, normalizeRole } from './tools';
import type { Tool, ToolContext, UIContext } from './tools/types';
import * as openai from '@/integrations/openai';
import { detectIntent, formatToolData } from '@/services/manager.service';
import { assertRestaurantUsable } from '@/services/subscription.service';
import { recordAiUsage, providerName, providerForModel, isWithinDailyBudget } from '@/services/ai-usage.service';
import { isCommandRoleAllowed } from './access';

/**
 * AI Command ("Jarvis") orchestration — Phase A.
 *
 * Guarantees:
 *  - Authorization context is server-derived; the request body cannot set role
 *    or restaurantId (the route schema is strict).
 *  - The LLM only selects a tool and supplies human names. Unknown/ambiguous
 *    entities produce a clarification; nothing is guessed.
 *  - Reads execute directly. Writes are persisted as PENDING proposals and
 *    require an explicit confirm. No auto-run.
 *  - Confirm re-resolves the entities, so stale references never execute.
 *  - Every execution writes an audit entry and, where the domain supports it,
 *    a compensating undo can be run inside a short window.
 */

export interface CommandInput {
  text: string;
  uiContext?: UIContext;
  conversationId?: string;
  /** Reply language for the assistant text ("en" | "sw"; omit for auto). */
  language?: string;
}

export interface ProposedActionView {
  id: string;
  tool: string;
  label: string;
  args: Record<string, unknown>;
  summary: string;
  risk: 'low' | 'high';
  undoWindowSeconds?: number;
}

export interface PlanStepView {
  actionId: string;
  tool: string;
  label: string;
  args: Record<string, unknown>;
  summary: string;
  risk: 'low' | 'high';
  undoWindowSeconds?: number;
}

export interface PlanView {
  id: string;
  title: string;
  steps: PlanStepView[];
}

export type CommandResponse =
  | { kind: 'answer'; reply: string; data?: any; toolUsed: string | null; conversationId: string }
  | { kind: 'clarify'; reply: string; clarification: { question: string; options: Array<{ id: string; label: string }> }; toolUsed: string | null; conversationId: string }
  | { kind: 'proposal'; reply: string; proposal: ProposedActionView; toolUsed: string; conversationId: string }
  | { kind: 'plan'; reply: string; plan: PlanView; toolUsed: 'plan'; conversationId: string }
  | { kind: 'refused'; reply: string; toolUsed: null; conversationId: string };

type CommandBody =
  | { kind: 'answer'; reply: string; data?: any; toolUsed: string | null }
  | { kind: 'clarify'; reply: string; clarification: { question: string; options: Array<{ id: string; label: string }> }; toolUsed: string | null }
  | { kind: 'proposal'; reply: string; proposal: ProposedActionView; toolUsed: string }
  | { kind: 'plan'; reply: string; plan: PlanView; toolUsed: 'plan' }
  | { kind: 'refused'; reply: string; toolUsed: null };

const FALLBACK_MAP: Record<string, string> = {
  sales: 'get_sales_summary',
  orders: 'get_open_orders',
  profit: 'get_profitability',
  inventory: 'get_low_stock',
  staff: 'get_staff_performance',
};

/**
 * Defense in depth: never run a tool without a concrete tenant id. A Prisma
 * `where: { restaurantId: undefined }` would silently query across tenants, so
 * this fails closed instead of failing open.
 */
function assertRestaurantContext(ctx: ToolContext): void {
  const restaurantId = ctx?.restaurantId;
  if (!restaurantId || typeof restaurantId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(restaurantId)) {
    throw new AppError(
      400,
      'RESTAURANT_CONTEXT_REQUIRED',
      'A restaurant context is required for AI commands',
      'Muktadha wa mgahawa unahitajika kwa amri za AI'
    );
  }
}

/**
 * Advanced AI capabilities are admin-only for now. Staff keep the manual UI.
 */
function assertCommandAccess(ctx: ToolContext): void {
  if (!isCommandRoleAllowed(ctx.role)) {
    throw new AppError(
      403,
      'AI_COMMAND_FORBIDDEN',
      'AI commands are currently limited to restaurant admins. Please use the dashboard.',
      'Amri za AI zinaruhusiwa kwa wasimamizi wa mgahawa pekee kwa sasa. Tafadhali tumia dashibodi.'
    );
  }
}

function helpText(): string {
  return 'I can help with sales, top items, stock, tables, open orders, staff, profitability, the daily briefing, and actions like marking an item unavailable, changing a price, restocking, updating an order, assigning a waiter or transferring a table. What do you need?';
}

function budgetText(): string {
  return 'The AI token budget for today is used up. You can still use the dashboard, or try again tomorrow.';
}

function extractHistory(messages: unknown): Array<{ role: string; content: string }> {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((m: any) => m && typeof m.content === 'string')
    .map((m: any) => ({ role: String(m.role || 'user'), content: String(m.content).slice(0, 600) }))
    .slice(-8);
}

async function getOrCreateConversation(ctx: ToolContext, conversationId?: string): Promise<any> {
  if (conversationId) {
    const conversation = await prisma.aiConversation.findFirst({
      where: { id: conversationId, restaurantId: ctx.restaurantId },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found', 'Mazungumzo hayakupatikana');
    }
    return conversation;
  }
  return prisma.aiConversation.create({
    data: {
      restaurantId: ctx.restaurantId,
      sessionId: `${ctx.userId}:${Date.now()}`,
      conversationType: 'MANAGER_COMMAND',
      messages: [],
    },
  });
}

async function appendMessages(conversationId: string, entries: Array<{ role: string; content: string }>): Promise<void> {
  try {
    const conversation = await prisma.aiConversation.findUnique({
      where: { id: conversationId },
      select: { messages: true },
    });
    const existing = Array.isArray(conversation?.messages) ? (conversation!.messages as any[]) : [];
    const messages = [...existing, ...entries].slice(-40);
    await prisma.aiConversation.update({ where: { id: conversationId }, data: { messages: messages as any } });
  } catch (error) {
    logger.warn('Failed to append AI command conversation', { conversationId, error: (error as Error).message });
  }
}

async function writeAudit(ctx: ToolContext, action: string, resourceId: string, details: Record<string, unknown>): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        restaurantId: ctx.restaurantId,
        userId: ctx.userId,
        role: ctx.role,
        action,
        resourceType: 'AiAction',
        resourceId,
        details: details as any,
        sensitivity: 'high',
      },
    });
  } catch (error) {
    logger.warn('Failed to persist AI command audit entry', { action, resourceId, error: (error as Error).message });
  }
}

async function finalize(conversationId: string, userText: string, body: CommandBody): Promise<CommandResponse> {
  const response = { ...body, conversationId } as CommandResponse;
  const assistantText =
    response.kind === 'proposal'
      ? `${response.reply} [proposal ${response.proposal.id}]`
      : response.kind === 'plan'
        ? `${response.reply} [plan ${response.plan.id}]`
        : response.reply;
  await appendMessages(conversationId, [
    { role: 'user', content: userText },
    { role: 'assistant', content: assistantText },
  ]);
  return response;
}

function serializeForStorage(value: unknown): any {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export async function handleCommand(ctx: ToolContext, input: CommandInput): Promise<CommandResponse> {
  assertRestaurantContext(ctx);
  assertCommandAccess(ctx);
  const text = String(input.text || '').trim();
  if (!text) throw AppError.validation('Command text is required', 'Amri inahitajika');

  const conversation = await getOrCreateConversation(ctx, input.conversationId);
  const conversationId = conversation.id;
  const history = extractHistory(conversation.messages);

  const allowed = toolsForRole(ctx.role);
  if (allowed.length === 0) {
    return finalize(conversationId, text, { kind: 'refused', reply: 'Your role cannot use AI commands.', toolUsed: null });
  }

  const withinBudget = await isWithinDailyBudget(ctx.restaurantId).catch(() => false);
  let selection: { actions: Array<{ action: string; args: Record<string, unknown> }>; reply: string } = { actions: [], reply: '' };

  if (withinBudget) {
    try {
      const result = await openai.selectCommandPlan(text, toLlmToolSpecs(allowed), {
        role: normalizeRole(ctx.role),
        uiContext: input.uiContext as Record<string, unknown> | undefined,
        history,
        language: input.language,
      });
      selection = { actions: result.actions, reply: result.reply };
      await recordAiUsage({
        restaurantId: ctx.restaurantId,
        feature: 'COMMAND_SELECT',
        provider: providerName(),
        model: providerForModel(openai.MODEL_NAME),
        promptTokens: result.usage?.promptTokens || 0,
        completionTokens: result.usage?.completionTokens || 0,
      }).catch(() => undefined);
    } catch (error) {
      logger.warn('AI command tool selection failed', { restaurantId: ctx.restaurantId, error: (error as Error).message });
    }
  } else {
    const fallback = detectIntent(text);
    const mapped = fallback ? FALLBACK_MAP[fallback] : null;
    if (mapped && allowed.some((t) => t.key === mapped)) {
      selection = { actions: [{ action: mapped, args: {} }], reply: '' };
    }
  }

  if (selection.actions.length === 0) {
    const reply = selection.reply || (withinBudget ? helpText() : budgetText());
    return finalize(conversationId, text, { kind: 'answer', reply, toolUsed: null });
  }

  // Resolve every step before proposing anything. A plan is all-or-nothing at
  // proposal time: if any entity is ambiguous, we ask instead of creating a
  // partial plan.
  interface PreparedStep {
    tool: Tool;
    rawArgs: Record<string, unknown>;
    args: Record<string, unknown>;
    preview: { summary: string; before?: Record<string, unknown> };
  }
  const prepared: PreparedStep[] = [];

  for (const step of selection.actions) {
    const tool = getTool(step.action);
    if (!tool) {
      return finalize(conversationId, text, { kind: 'answer', reply: helpText(), toolUsed: null });
    }
    if (!isToolAllowed(ctx.role, tool)) {
      return finalize(conversationId, text, {
        kind: 'refused',
        reply: `One of those actions is not available for your role (${normalizeRole(ctx.role)}).`,
        toolUsed: null,
      });
    }
    // Validate the model's arguments strictly. Missing/invalid → ask, never guess.
    const parsed = tool.inputSchema.safeParse(step.args ?? {});
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || 'argument'}: ${issue.message}`)
        .join('; ');
      return finalize(conversationId, text, {
        kind: 'clarify',
        reply: `I need a bit more detail before I can do that (${issues}).`,
        clarification: { question: `Please provide: ${issues}`, options: [] },
        toolUsed: tool.key,
      });
    }

    let resolved;
    try {
      resolved = await tool.resolve(ctx, parsed.data as Record<string, unknown>);
    } catch (error) {
      logger.warn('AI command resolution failed', { tool: tool.key, restaurantId: ctx.restaurantId, error: (error as Error).message });
      return finalize(conversationId, text, {
        kind: 'answer',
        reply: 'I could not resolve that request. Please rephrase it.',
        toolUsed: tool.key,
      });
    }

    if (!resolved.ok) {
      return finalize(conversationId, text, {
        kind: 'clarify',
        reply: resolved.clarification.question,
        clarification: resolved.clarification,
        toolUsed: tool.key,
      });
    }

    prepared.push({
      tool,
      rawArgs: parsed.data as Record<string, unknown>,
      args: resolved.args,
      preview: { summary: resolved.preview.summary, before: resolved.preview.before },
    });
  }

  // Single step: preserve the original read-answer / single-proposal behavior.
  if (prepared.length === 1) {
    const step = prepared[0];

    if (step.tool.kind === 'read') {
      const result = await step.tool.run(ctx, step.args);
      const dataText = formatToolData(step.tool.label, result.data);
      const deterministic = step.tool.summarize ? step.tool.summarize(result.data) : null;
      let reply = result.message || deterministic || dataText;

      const isKnowledge = step.tool.key === 'search_knowledge';
      const knowledgeResults = Array.isArray(result.data?.results) ? result.data.results : [];

      // If a tool provides a deterministic summary, skip the LLM entirely:
      // it is cheaper, stable, and avoids leaking raw keys like "changePct: null".
      if (isKnowledge && knowledgeResults.length === 0) {
        reply = "I couldn't find that in the knowledge base. Try rephrasing the question, or contact support.";
      } else if (withinBudget && !deterministic) {
        try {
          const answer = isKnowledge
            ? await openai.generateKnowledgeAnswer(text, knowledgeResults)
            : await openai.generateManagerAnswer(text, dataText);
          reply = answer.reply || reply;
          await recordAiUsage({
            restaurantId: ctx.restaurantId,
            feature: 'COMMAND_ANSWER',
            provider: providerName(),
            model: providerForModel(answer.model || openai.MODEL_NAME),
            promptTokens: answer.usage?.promptTokens || 0,
            completionTokens: answer.usage?.completionTokens || 0,
          }).catch(() => undefined);
        } catch (error) {
          logger.warn('AI command answer generation failed — returning structured data', { error: (error as Error).message });
        }
      }

      return finalize(conversationId, text, { kind: 'answer', reply, data: result.data, toolUsed: step.tool.key });
    }

    // Write: propose only. Nothing is executed here.
    await assertRestaurantUsable(ctx.restaurantId);
    const action = await prisma.aiAction.create({
      data: {
        restaurantId: ctx.restaurantId,
        conversationId,
        tool: step.tool.key,
        label: step.tool.label,
        // `args` keeps the raw (validated) arguments so confirmation can
        // re-resolve entities; `resolvedArgs` is the resolved execution payload.
        args: serializeForStorage(step.rawArgs) as any,
        resolvedArgs: serializeForStorage(step.args) as any,
        summary: step.preview.summary,
        status: 'PENDING',
        uiContext: serializeForStorage(input.uiContext),
        beforeState: serializeForStorage(step.preview.before),
      },
    });

    return finalize(conversationId, text, {
      kind: 'proposal',
      reply: `I can do that — ${step.preview.summary} Please confirm to apply it.`,
      toolUsed: step.tool.key,
      proposal: {
        id: action.id,
        tool: step.tool.key,
        label: step.tool.label,
        args: step.args,
        summary: step.preview.summary,
        risk: step.tool.risk || 'high',
        undoWindowSeconds: step.tool.compensate ? step.tool.undoWindowSeconds ?? 15 : undefined,
      },
    });
  }

  // Multiple reads: execute them all and combine into one grounded answer.
  // (The planner may return several read tools for questions that span domains.)
  const readSteps = prepared.filter((step) => step.tool.kind === 'read');
  const writeSteps = prepared.filter((step) => step.tool.kind === 'write');

  if (readSteps.length > 0 && writeSteps.length > 0) {
    return finalize(conversationId, text, {
      kind: 'answer',
      reply: 'I can combine the write actions into one plan, but please ask for that report separately so I can answer it accurately.',
      toolUsed: null,
    });
  }

  if (readSteps.length > 1) {
    const results: Array<{ tool: string; label: string; data: any; summary?: string }> = [];

    for (const step of readSteps) {
      const result = await step.tool.run(ctx, step.args);
      results.push({
        tool: step.tool.key,
        label: step.tool.label,
        data: result.data,
        summary: step.tool.summarize ? step.tool.summarize(result.data) : undefined,
      });
    }

    const deterministic = results.every((result) => result.summary)
      ? results.map((result) => result.summary).join('\n\n')
      : null;
    const dataText = results.map((result) => `${result.label}:\n${JSON.stringify(result.data, null, 2)}`).join('\n\n');
    let reply = deterministic || dataText;

    if (withinBudget && !deterministic) {
      try {
        const answer = await openai.generateManagerAnswer(text, dataText);
        reply = answer.reply || reply;
        await recordAiUsage({
          restaurantId: ctx.restaurantId,
          feature: 'COMMAND_ANSWER',
          provider: providerName(),
          model: providerForModel(answer.model || openai.MODEL_NAME),
          promptTokens: answer.usage?.promptTokens || 0,
          completionTokens: answer.usage?.completionTokens || 0,
        }).catch(() => undefined);
      } catch (error) {
        logger.warn('AI multi-read answer generation failed — returning structured data', { error: (error as Error).message });
      }
    }

    return finalize(conversationId, text, {
      kind: 'answer',
      reply,
      data: { results: results.map((result) => ({ tool: result.tool, label: result.label, data: result.data })) },
      toolUsed: 'multi',
    });
  }

  // Multi-step plan (writes only). Each step is a PENDING AiAction sharing a
  // workflowId; confirmation executes them in order.
  await assertRestaurantUsable(ctx.restaurantId);
  const workflowId = randomUUID();
  const workflowTitle = (selection.reply || 'Multi-step plan').trim().slice(0, 120) || 'Multi-step plan';
  const planSteps: PlanStepView[] = [];

  for (let index = 0; index < prepared.length; index++) {
    const step = prepared[index];
    const action = await prisma.aiAction.create({
      data: {
        restaurantId: ctx.restaurantId,
        conversationId,
        workflowId,
        stepOrder: index,
        workflowTitle,
        tool: step.tool.key,
        label: step.tool.label,
        args: serializeForStorage(step.rawArgs) as any,
        resolvedArgs: serializeForStorage(step.args) as any,
        summary: step.preview.summary,
        status: 'PENDING',
        uiContext: serializeForStorage(input.uiContext),
        beforeState: serializeForStorage(step.preview.before),
      },
    });
    planSteps.push({
      actionId: action.id,
      tool: step.tool.key,
      label: step.tool.label,
      args: step.args,
      summary: step.preview.summary,
      risk: step.tool.risk || 'high',
      undoWindowSeconds: step.tool.compensate ? step.tool.undoWindowSeconds ?? 15 : undefined,
    });
  }

  const reply = `I can do these ${planSteps.length} steps in order:\n${planSteps.map((s, i) => `${i + 1}. ${s.summary}`).join('\n')}\nPlease confirm to apply them.`;
  return finalize(conversationId, text, {
    kind: 'plan',
    reply,
    plan: { id: workflowId, title: workflowTitle, steps: planSteps },
    toolUsed: 'plan',
  });
}

async function loadActionForUpdate(ctx: ToolContext, actionId: string): Promise<any> {
  const action = await prisma.aiAction.findFirst({ where: { id: actionId, restaurantId: ctx.restaurantId } });
  if (!action) throw new NotFoundError('Action not found', 'Kitendo hakikupatikana');
  return action;
}

function assertActionPending(action: any): void {
  if (action.status === 'EXECUTED') throw new ConflictError('Action already executed', 'Kitendo tayari kimetekelezwa');
  if (action.status === 'REJECTED') throw new ConflictError('Action was rejected', 'Kitendo kilikataliwa');
  if (action.status === 'UNDONE') throw new ConflictError('Action was undone', 'Kitendo kilirudishwa');
  if (action.status === 'SKIPPED') throw new ConflictError('Action was skipped', 'Kitendo kilirukwa');
  if (action.status !== 'PENDING') throw new ConflictError(`Action cannot be executed from status ${action.status}`, 'Kitendo hakiwezi kutekelezwa');
}

async function executePendingAction(ctx: ToolContext, action: any): Promise<any> {
  assertActionPending(action);

  const tool = getTool(action.tool);
  if (!tool) throw AppError.internal(`Unknown command tool: ${action.tool}`);
  if (!isToolAllowed(ctx.role, tool)) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot execute this action', 'Huwezi kutekeleza kitendo hiki');
  }

  await assertRestaurantUsable(ctx.restaurantId);

  const parsed = tool.inputSchema.safeParse(action.args);
  if (!parsed.success) {
    await prisma.aiAction.update({
      where: { id: action.id },
      data: { status: 'FAILED', executedById: ctx.userId, executedAt: new Date(), result: { error: 'Stored arguments are no longer valid' } as any },
    });
    throw AppError.validation('This action is no longer valid. Please ask again.', 'Kitendo hiki si sahihi tena. Tafadhali uliza tena.');
  }

  // Re-resolve at confirmation time: entities may have changed since the
  // proposal. Never execute against a stale or ambiguous reference.
  let resolved;
  try {
    resolved = await tool.resolve(ctx, parsed.data as Record<string, unknown>);
  } catch (error) {
    await prisma.aiAction.update({
      where: { id: action.id },
      data: { status: 'FAILED', executedById: ctx.userId, executedAt: new Date(), result: { error: (error as Error).message } as any },
    });
    throw error;
  }

  if (!resolved.ok) {
    await prisma.aiAction.update({
      where: { id: action.id },
      data: { status: 'FAILED', executedById: ctx.userId, executedAt: new Date(), result: { error: resolved.clarification.question } as any },
    });
    throw new ConflictError(
      `I can no longer apply this safely: ${resolved.clarification.question}`,
      `Siwezi kutekeleza kwa usalama tena: ${resolved.clarification.question}`
    );
  }

  let result;
  try {
    result = await tool.run(ctx, resolved.args);
  } catch (error) {
    await prisma.aiAction.update({
      where: { id: action.id },
      data: { status: 'FAILED', executedById: ctx.userId, executedAt: new Date(), result: { error: (error as Error).message } as any },
    });
    throw error;
  }

  const undoExpiresAt = tool.compensate ? new Date(Date.now() + (tool.undoWindowSeconds ?? 15) * 1000) : null;
  await prisma.aiAction.update({
    where: { id: action.id },
    data: {
      status: 'EXECUTED',
      executedById: ctx.userId,
      executedAt: new Date(),
      undoExpiresAt,
      resolvedArgs: serializeForStorage(resolved.args),
      beforeState: serializeForStorage(resolved.preview.before ?? action.beforeState),
      result: serializeForStorage({ data: result.data, message: result.message }),
    },
  });

  await writeAudit(ctx, 'AI_COMMAND_CONFIRM', action.id, { tool: tool.key, args: resolved.args, summary: resolved.preview.summary });
  if (action.conversationId) {
    await appendMessages(action.conversationId, [{ role: 'assistant', content: `Done: ${result.message || resolved.preview.summary}` }]);
  }

  return {
    actionId: action.id,
    status: 'EXECUTED',
    message: result.message || resolved.preview.summary,
    data: result.data,
    undoUntil: undoExpiresAt,
  };
}

export async function confirmCommand(ctx: ToolContext, actionId: string): Promise<any> {
  assertRestaurantContext(ctx);
  assertCommandAccess(ctx);
  const action = await loadActionForUpdate(ctx, actionId);
  return executePendingAction(ctx, action);
}

export async function rejectCommand(ctx: ToolContext, actionId: string): Promise<void> {
  assertRestaurantContext(ctx);
  assertCommandAccess(ctx);
  const action = await loadActionForUpdate(ctx, actionId);
  assertActionPending(action);
  await prisma.aiAction.update({
    where: { id: action.id },
    data: { status: 'REJECTED', executedById: ctx.userId, executedAt: new Date() },
  });
  if (action.conversationId) {
    await appendMessages(action.conversationId, [{ role: 'assistant', content: 'Okay — I will not apply that.' }]);
  }
}

async function undoExecutedAction(ctx: ToolContext, action: any): Promise<any> {
  if (action.status !== 'EXECUTED') {
    throw new ConflictError('Only executed actions can be undone', 'Vitendo vilivyotekelezwa pekee vinaweza kurudishwa');
  }
  if (!action.undoExpiresAt || new Date(action.undoExpiresAt).getTime() < Date.now()) {
    throw new ConflictError('The undo window for this action has passed', 'Muda wa kurudisha kitendo hiki umepita');
  }

  const tool = getTool(action.tool);
  if (!tool?.compensate) {
    throw new ConflictError('This action cannot be undone', 'Kitendo hiki hakiwezi kurudishwa');
  }
  if (!isToolAllowed(ctx.role, tool)) {
    throw new AppError(403, 'FORBIDDEN', 'You cannot undo this action', 'Huwezi kurudisha kitendo hiki');
  }

  // Undo uses the exact resolved payload that was executed, plus the before
  // snapshot. It never re-resolves (the entity may no longer be matchable).
  const undoArgs = (action.resolvedArgs ?? action.args) as Record<string, unknown>;
  const before = (action.beforeState as Record<string, unknown> | null) ?? null;
  const result = await tool.compensate(ctx, undoArgs, before);

  await prisma.aiAction.update({
    where: { id: action.id },
    data: {
      status: 'UNDONE',
      undoneAt: new Date(),
      result: serializeForStorage({ previous: action.result, undo: { message: result.message, data: result.data } }),
    },
  });

  await writeAudit(ctx, 'AI_COMMAND_UNDO', action.id, { tool: tool.key, args: undoArgs });
  if (action.conversationId) {
    await appendMessages(action.conversationId, [{ role: 'assistant', content: result.message || 'Undone.' }]);
  }

  return { actionId: action.id, status: 'UNDONE', message: result.message || 'Undone.', data: result.data };
}

export async function undoCommand(ctx: ToolContext, actionId: string): Promise<any> {
  assertRestaurantContext(ctx);
  assertCommandAccess(ctx);
  const action = await loadActionForUpdate(ctx, actionId);
  return undoExecutedAction(ctx, action);
}

// ── Multi-step plans (Phase D) ──

export async function confirmWorkflow(ctx: ToolContext, workflowId: string): Promise<any> {
  assertRestaurantContext(ctx);
  assertCommandAccess(ctx);

  const actions = await prisma.aiAction.findMany({
    where: { restaurantId: ctx.restaurantId, workflowId },
    orderBy: { stepOrder: 'asc' },
  });
  if (actions.length === 0) {
    throw new NotFoundError('Plan not found', 'Mpango haukupatikana');
  }

  const steps: any[] = [];
  let failed = false;

  for (const action of actions) {
    if (failed) {
      if (action.status === 'PENDING') {
        await prisma.aiAction.update({
          where: { id: action.id },
          data: {
            status: 'SKIPPED',
            executedById: ctx.userId,
            executedAt: new Date(),
            result: { error: 'Skipped because an earlier step failed' } as any,
          },
        });
        steps.push({ actionId: action.id, tool: action.tool, summary: action.summary, status: 'SKIPPED' });
      }
      continue;
    }

    if (action.status !== 'PENDING') {
      steps.push({ actionId: action.id, tool: action.tool, summary: action.summary, status: action.status });
      continue;
    }

    try {
      const result = await executePendingAction(ctx, action);
      steps.push({
        actionId: action.id,
        tool: action.tool,
        summary: action.summary,
        status: 'EXECUTED',
        message: result.message,
        undoUntil: result.undoUntil,
      });
    } catch (error) {
      failed = true;
      steps.push({
        actionId: action.id,
        tool: action.tool,
        summary: action.summary,
        status: 'FAILED',
        message: (error as Error).message,
      });
    }
  }

  const executed = steps.filter((step) => step.status === 'EXECUTED').length;
  const status = failed ? (executed > 0 ? 'PARTIAL' : 'FAILED') : 'COMPLETED';

  if (actions[0]?.conversationId) {
    await appendMessages(actions[0].conversationId, [
      { role: 'assistant', content: `Plan ${status.toLowerCase()}: ${executed}/${steps.length} step(s) applied.` },
    ]);
  }

  return { workflowId, status, steps };
}

export async function cancelWorkflow(ctx: ToolContext, workflowId: string): Promise<any> {
  assertRestaurantContext(ctx);
  assertCommandAccess(ctx);

  const actions = await prisma.aiAction.findMany({
    where: { restaurantId: ctx.restaurantId, workflowId },
    select: { id: true, status: true, conversationId: true },
  });
  if (actions.length === 0) {
    throw new NotFoundError('Plan not found', 'Mpango haukupatikana');
  }

  const pending = actions.filter((action) => action.status === 'PENDING');
  if (pending.length > 0) {
    await prisma.aiAction.updateMany({
      where: { restaurantId: ctx.restaurantId, workflowId, status: 'PENDING' },
      data: { status: 'SKIPPED', executedById: ctx.userId, executedAt: new Date() },
    });
  }

  if (actions[0]?.conversationId) {
    await appendMessages(actions[0].conversationId, [{ role: 'assistant', content: `Cancelled ${pending.length} pending step(s).` }]);
  }

  return { workflowId, status: 'CANCELLED', cancelled: pending.length };
}

export async function undoWorkflow(ctx: ToolContext, workflowId: string): Promise<any> {
  assertRestaurantContext(ctx);
  assertCommandAccess(ctx);

  const actions = await prisma.aiAction.findMany({
    where: { restaurantId: ctx.restaurantId, workflowId, status: 'EXECUTED' },
    orderBy: { stepOrder: 'desc' },
  });
  if (actions.length === 0) {
    throw new ConflictError('No executed steps to undo', 'Hakuna hatua zilizotekelezwa za kurudisha');
  }

  const steps: any[] = [];
  let failed = false;
  for (const action of actions) {
    try {
      const result = await undoExecutedAction(ctx, action);
      steps.push({ actionId: action.id, tool: action.tool, summary: action.summary, status: 'UNDONE', message: result.message });
    } catch (error) {
      failed = true;
      steps.push({ actionId: action.id, tool: action.tool, summary: action.summary, status: 'FAILED', message: (error as Error).message });
    }
  }

  return { workflowId, status: failed ? 'PARTIAL' : 'UNDONE', steps };
}

export async function getWorkflow(ctx: ToolContext, workflowId: string): Promise<any> {
  assertRestaurantContext(ctx);
  assertCommandAccess(ctx);

  const actions = await prisma.aiAction.findMany({
    where: { restaurantId: ctx.restaurantId, workflowId },
    orderBy: { stepOrder: 'asc' },
  });
  if (actions.length === 0) {
    throw new NotFoundError('Plan not found', 'Mpango haukupatikana');
  }

  return {
    id: workflowId,
    title: actions[0].workflowTitle || 'Multi-step plan',
    steps: actions.map((action) => ({
      actionId: action.id,
      tool: action.tool,
      label: action.label,
      summary: action.summary,
      status: action.status,
      undoUntil: action.undoExpiresAt,
      executedAt: action.executedAt,
    })),
  };
}

export async function getConversation(ctx: ToolContext, conversationId: string): Promise<any> {
  assertRestaurantContext(ctx);
  assertCommandAccess(ctx);
  const conversation = await prisma.aiConversation.findFirst({
    where: { id: conversationId, restaurantId: ctx.restaurantId },
    select: { id: true, sessionId: true, conversationType: true, messages: true, createdAt: true, updatedAt: true },
  });
  if (!conversation) throw new NotFoundError('Conversation not found', 'Mazungumzo hayakupatikana');
  return conversation;
}

export default {
  handleCommand,
  confirmCommand,
  rejectCommand,
  undoCommand,
  confirmWorkflow,
  cancelWorkflow,
  undoWorkflow,
  getWorkflow,
  getConversation,
};

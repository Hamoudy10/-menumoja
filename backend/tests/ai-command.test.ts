import { prisma, setupTestApp, generateTestToken, getAuthHeader, createTestOwner, cleanupTestData } from './helpers';
import request from 'supertest';
import * as openai from '@/integrations/openai';
import {
  handleCommand,
  confirmCommand,
  undoCommand,
  confirmWorkflow,
  cancelWorkflow,
  undoWorkflow,
} from '@/ai/command.service';
import { ALL_TOOLS, toolsForRole } from '@/ai/tools';
import type { ToolContext } from '@/ai/tools/types';

jest.mock('@/integrations/openai', () => ({
  selectCommandTool: jest.fn(),
  selectCommandPlan: jest.fn(),
  generateManagerAnswer: jest.fn(),
  generateManagerAction: jest.fn(),
  MODEL_NAME: 'deepseek-v4-flash',
}));

const app = setupTestApp();

const RESTAURANT_ID = '11111111-1111-1111-1111-111111111111';
const OWNER_ID = '22222222-2222-2222-2222-222222222222';

const ctx: ToolContext = { restaurantId: RESTAURANT_ID, userId: OWNER_ID, role: 'owner' };

function prime() {
  (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue({
    id: RESTAURANT_ID,
    slug: 'test-restaurant',
    planId: 'plan-1',
    subscriptionStatus: 'TRIAL',
    trialEndsAt: null,
    planExpiresAt: null,
    isSuspended: false,
  });
  (prisma.subscriptionPlan.findUnique as jest.Mock).mockResolvedValue({
    id: 'plan-1',
    name: 'Starter',
    maxMenuItems: 20,
    maxTables: 10,
  });
  (prisma.aiConversation.create as jest.Mock).mockResolvedValue({ id: 'conv-1', messages: [] });
  (prisma.aiConversation.findUnique as jest.Mock).mockResolvedValue({ id: 'conv-1', messages: [] });
  (prisma.aiConversation.update as jest.Mock).mockResolvedValue({});
  (prisma.aiAction.update as jest.Mock).mockResolvedValue({});
  (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: 'audit-1' });
  (openai.selectCommandTool as jest.Mock).mockReset();
  (openai.selectCommandPlan as jest.Mock).mockReset();
  (openai.generateManagerAnswer as jest.Mock).mockReset();
}

const tilapiaWhole = { id: 'm-1', name: 'Grilled Tilapia Whole', price: 1200, isAvailable: true, isTodaysSpecial: false };
const tilapiaFillet = { id: 'm-2', name: 'Tilapia Fillet', price: 900, isAvailable: true, isTodaysSpecial: false };

beforeEach(() => {
  cleanupTestData();
  prime();
});

describe('command registry', () => {
  it('exposes the registered tools with unique keys', () => {
    expect(ALL_TOOLS).toHaveLength(26);
    expect(new Set(ALL_TOOLS.map((t) => t.key)).size).toBe(26);
    for (const tool of ALL_TOOLS) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.resolve).toBeInstanceOf(Function);
      expect(tool.run).toBeInstanceOf(Function);
    }
  });

  it('filters tools by role (least privilege)', () => {
    expect(toolsForRole('owner')).toHaveLength(26);
    expect(toolsForRole('kitchen').map((t) => t.key)).toEqual(['get_open_orders', 'update_order_status']);
    expect(toolsForRole('cashier').some((t) => t.key === 'set_item_price')).toBe(false);
    expect(toolsForRole('waiter').some((t) => t.key === 'transfer_table')).toBe(true);
  });
});

describe('handleCommand — reads', () => {
  it('executes a read tool and grounds the answer in data', async () => {
    (openai.selectCommandPlan as jest.Mock).mockResolvedValue({
      actions: [{ action: 'get_sales_summary', args: { period: 'today' } }],
      reply: '',
      usage: { promptTokens: 10, completionTokens: 5 },
    });
    (openai.generateManagerAnswer as jest.Mock).mockResolvedValue({
      reply: 'You made KES 5,000 from 10 paid orders today.',
      model: 'deepseek-v4-flash',
      usage: { promptTokens: 10, completionTokens: 5 },
    });
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 5000 }, _count: { id: 10 } });
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);

    const result = await handleCommand(ctx, { text: 'how much did we sell today?' });

    expect(result.kind).toBe('answer');
    expect(result.toolUsed).toBe('get_sales_summary');
    expect(result.reply).toContain('5,000');
  });

  it('returns a deterministic daily briefing without calling the LLM answer', async () => {
    (openai.selectCommandPlan as jest.Mock).mockResolvedValue({
      actions: [{ action: 'get_daily_briefing', args: {} }],
      reply: '',
    });
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 0 }, _count: { id: 0 } });

    const result = await handleCommand(ctx, { text: 'daily briefing' });

    expect(result.kind).toBe('answer');
    expect(result.toolUsed).toBe('get_daily_briefing');
    expect(result.reply).toContain('Daily briefing');
    expect(result.reply).toContain('Revenue');
    expect(openai.generateManagerAnswer).not.toHaveBeenCalled();
  });

  it('combines multiple read tools into one grounded answer', async () => {
    (openai.selectCommandPlan as jest.Mock).mockResolvedValue({
      actions: [
        { action: 'get_sales_summary', args: { period: 'today' } },
        { action: 'get_low_stock', args: {} },
      ],
      reply: '',
    });
    (prisma.order.aggregate as jest.Mock).mockResolvedValue({ _sum: { totalAmount: 5000 }, _count: { id: 10 } });
    (prisma.orderItem.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.findMany as jest.Mock).mockResolvedValue([]);
    (openai.generateManagerAnswer as jest.Mock).mockResolvedValue({
      reply: 'You made KES 5,000 and no stock is critically low.',
      model: 'deepseek-v4-flash',
      usage: { promptTokens: 5, completionTokens: 5 },
    });

    const result = await handleCommand(ctx, { text: 'show sales and low stock' });

    expect(result.kind).toBe('answer');
    expect(result.toolUsed).toBe('multi');
    if (result.kind === 'answer') {
      expect(result.data.results).toHaveLength(2);
      expect(result.data.results.map((row: any) => row.tool)).toEqual(['get_sales_summary', 'get_low_stock']);
    }
  });
});

describe('handleCommand — writes are proposed, never executed', () => {
  it('asks for clarification when the entity is ambiguous', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([tilapiaWhole, tilapiaFillet]);
    (openai.selectCommandPlan as jest.Mock).mockResolvedValue({
      actions: [{ action: 'set_item_availability', args: { item: 'Tilapia', available: false } }],
      reply: '',
    });

    const result = await handleCommand(ctx, { text: '86 the tilapia' });

    expect(result.kind).toBe('clarify');
    if (result.kind === 'clarify') {
      expect(result.clarification.options.map((o) => o.label)).toEqual(
        expect.arrayContaining(['Grilled Tilapia Whole', 'Tilapia Fillet'])
      );
    }
    expect(prisma.aiAction.create).not.toHaveBeenCalled();
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('creates a PENDING proposal for a unique match and does not write yet', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([tilapiaWhole]);
    (prisma.aiAction.create as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: 'act-1', ...data }));
    (openai.selectCommandPlan as jest.Mock).mockResolvedValue({
      actions: [{ action: 'set_item_availability', args: { item: 'Grilled Tilapia Whole', available: false } }],
      reply: '',
    });

    const result = await handleCommand(ctx, { text: 'mark grilled tilapia whole unavailable' });

    expect(result.kind).toBe('proposal');
    if (result.kind === 'proposal') {
      expect(result.proposal.summary).toContain('UNAVAILABLE');
      expect(result.proposal.risk).toBe('low');
    }
    expect(prisma.aiAction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'PENDING',
          tool: 'set_item_availability',
          args: expect.objectContaining({ item: 'Grilled Tilapia Whole', available: false }),
          resolvedArgs: expect.objectContaining({ itemId: 'm-1', available: false }),
        }),
      })
    );
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('refuses a tool the role is not allowed to use (defense in depth)', async () => {
    // Allow the kitchen role through the command-access gate to prove the
    // inner per-tool authorization still blocks a privileged tool.
    const previous = process.env.AI_COMMAND_ALLOWED_ROLES;
    process.env.AI_COMMAND_ALLOWED_ROLES = 'owner,kitchen';
    try {
      (openai.selectCommandPlan as jest.Mock).mockResolvedValue({
        actions: [{ action: 'set_item_price', args: { item: 'Anything', price: 100 } }],
        reply: '',
      });

      const result = await handleCommand({ ...ctx, role: 'kitchen' }, { text: 'change the price' });
      expect(result.kind).toBe('refused');
      expect(prisma.aiAction.create).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete process.env.AI_COMMAND_ALLOWED_ROLES;
      else process.env.AI_COMMAND_ALLOWED_ROLES = previous;
    }
  });
});

describe('confirm / undo', () => {
  it('re-resolves and executes a confirmed proposal', async () => {
    (prisma.aiAction.findFirst as jest.Mock).mockResolvedValue({
      id: 'act-1',
      restaurantId: RESTAURANT_ID,
      conversationId: 'conv-1',
      tool: 'set_item_availability',
      status: 'PENDING',
      args: { item: 'Grilled Tilapia Whole', available: false },
      beforeState: { itemId: 'm-1', itemName: 'Grilled Tilapia Whole', isAvailable: true },
    });
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([tilapiaWhole]);
    (prisma.menuItem.update as jest.Mock).mockResolvedValue({ id: 'm-1', name: 'Grilled Tilapia Whole', isAvailable: false });

    const result = await confirmCommand(ctx, 'act-1');

    expect(result.status).toBe('EXECUTED');
    expect(prisma.menuItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm-1' }, data: { isAvailable: false } })
    );
    expect(prisma.aiAction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'EXECUTED' }) })
    );
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it('marks the proposal FAILED and refuses when the entity is stale at confirm time', async () => {
    (prisma.aiAction.findFirst as jest.Mock).mockResolvedValue({
      id: 'act-2',
      restaurantId: RESTAURANT_ID,
      conversationId: null,
      tool: 'set_item_availability',
      status: 'PENDING',
      args: { item: 'Deleted Item', available: false },
      beforeState: null,
    });
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([]);

    await expect(confirmCommand(ctx, 'act-2')).rejects.toThrow();
    expect(prisma.aiAction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) })
    );
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('undoes an executed low-risk action via a compensating write', async () => {
    (prisma.aiAction.findFirst as jest.Mock).mockResolvedValue({
      id: 'act-3',
      restaurantId: RESTAURANT_ID,
      conversationId: 'conv-1',
      tool: 'set_item_availability',
      status: 'EXECUTED',
      undoExpiresAt: new Date(Date.now() + 10_000),
      args: { item: 'Grilled Tilapia Whole', available: false },
      resolvedArgs: { itemId: 'm-1', available: false },
      beforeState: { itemId: 'm-1', itemName: 'Grilled Tilapia Whole', isAvailable: true },
      result: { message: 'done' },
    });
    (prisma.menuItem.update as jest.Mock).mockResolvedValue({ id: 'm-1', name: 'Grilled Tilapia Whole', isAvailable: true });

    const result = await undoCommand(ctx, 'act-3');

    expect(result.status).toBe('UNDONE');
    expect(prisma.menuItem.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm-1' }, data: { isAvailable: true } })
    );
    expect(prisma.aiAction.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'UNDONE' }) })
    );
  });

  it('refuses undo after the window has passed', async () => {
    (prisma.aiAction.findFirst as jest.Mock).mockResolvedValue({
      id: 'act-4',
      restaurantId: RESTAURANT_ID,
      tool: 'set_item_availability',
      status: 'EXECUTED',
      undoExpiresAt: new Date(Date.now() - 60_000),
      args: {},
      resolvedArgs: {},
      beforeState: {},
    });

    await expect(undoCommand(ctx, 'act-4')).rejects.toThrow();
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });
});

describe('Phase D — multi-step plans', () => {
  const curry = { id: 'm-3', name: 'Chicken Curry', price: 900, isAvailable: true, isTodaysSpecial: false };

  it('proposes a plan for multiple writes and does not execute', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([tilapiaWhole, curry]);
    let counter = 0;
    (prisma.aiAction.create as jest.Mock).mockImplementation(async ({ data }: any) => ({ id: `act-${++counter}`, ...data }));
    (openai.selectCommandPlan as jest.Mock).mockResolvedValue({
      actions: [
        { action: 'set_item_availability', args: { item: 'Grilled Tilapia Whole', available: false } },
        { action: 'set_item_price', args: { item: 'Chicken Curry', price: 950 } },
      ],
      reply: 'Two menu updates',
    });

    const result = await handleCommand(ctx, { text: '86 the tilapia and set chicken curry to 950' });

    expect(result.kind).toBe('plan');
    if (result.kind === 'plan') {
      expect(result.plan.steps).toHaveLength(2);
      expect(result.plan.title).toBe('Two menu updates');
    }
    expect(prisma.aiAction.create).toHaveBeenCalledTimes(2);
    expect(prisma.aiAction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workflowId: expect.any(String), stepOrder: 0, status: 'PENDING' }) })
    );
    expect(prisma.aiAction.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ workflowId: expect.any(String), stepOrder: 1, status: 'PENDING' }) })
    );
    expect(prisma.menuItem.update).not.toHaveBeenCalled();
  });

  it('asks for clarification instead of creating a partial plan', async () => {
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([tilapiaWhole, tilapiaFillet, curry]);
    (openai.selectCommandPlan as jest.Mock).mockResolvedValue({
      actions: [
        { action: 'set_item_availability', args: { item: 'Tilapia', available: false } },
        { action: 'set_item_price', args: { item: 'Chicken Curry', price: 950 } },
      ],
      reply: '',
    });

    const result = await handleCommand(ctx, { text: '86 the tilapia and set chicken curry to 950' });

    expect(result.kind).toBe('clarify');
    expect(prisma.aiAction.create).not.toHaveBeenCalled();
  });

  it('executes a confirmed plan in order', async () => {
    (prisma.aiAction.findMany as jest.Mock).mockResolvedValue([
      { id: 'act-1', restaurantId: RESTAURANT_ID, conversationId: 'conv-1', workflowId: 'wf-1', stepOrder: 0, tool: 'set_item_availability', status: 'PENDING', args: { item: 'Grilled Tilapia Whole', available: false }, beforeState: { itemId: 'm-1', isAvailable: true }, summary: 'Mark tilapia unavailable' },
      { id: 'act-2', restaurantId: RESTAURANT_ID, conversationId: 'conv-1', workflowId: 'wf-1', stepOrder: 1, tool: 'set_item_price', status: 'PENDING', args: { item: 'Chicken Curry', price: 950 }, beforeState: { itemId: 'm-3', price: 900 }, summary: 'Set curry price' },
    ]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([tilapiaWhole, curry]);
    (prisma.menuItem.update as jest.Mock).mockImplementation(async ({ where, data }: any) => ({
      id: where.id,
      name: where.id === 'm-1' ? 'Grilled Tilapia Whole' : 'Chicken Curry',
      ...data,
    }));

    const result = await confirmWorkflow(ctx, 'wf-1');

    expect(result.status).toBe('COMPLETED');
    expect(result.steps.filter((step: any) => step.status === 'EXECUTED')).toHaveLength(2);
    expect(prisma.menuItem.update).toHaveBeenCalledTimes(2);
  });

  it('stops and skips remaining steps when one fails', async () => {
    (prisma.aiAction.findMany as jest.Mock).mockResolvedValue([
      { id: 'act-1', restaurantId: RESTAURANT_ID, conversationId: null, workflowId: 'wf-1', stepOrder: 0, tool: 'set_item_availability', status: 'PENDING', args: { item: 'Grilled Tilapia Whole', available: false }, summary: 'Mark tilapia unavailable' },
      { id: 'act-2', restaurantId: RESTAURANT_ID, conversationId: null, workflowId: 'wf-1', stepOrder: 1, tool: 'set_item_price', status: 'PENDING', args: { item: 'Chicken Curry', price: 950 }, summary: 'Set curry price' },
    ]);
    (prisma.menuItem.findMany as jest.Mock).mockResolvedValue([tilapiaWhole, curry]);
    (prisma.menuItem.update as jest.Mock).mockRejectedValue(new Error('db write failed'));

    const result = await confirmWorkflow(ctx, 'wf-1');

    expect(result.status).toBe('FAILED');
    expect(result.steps[0].status).toBe('FAILED');
    expect(result.steps[1].status).toBe('SKIPPED');
    expect(prisma.menuItem.update).toHaveBeenCalledTimes(1);
  });

  it('cancels pending steps', async () => {
    (prisma.aiAction.findMany as jest.Mock).mockResolvedValue([
      { id: 'act-1', status: 'PENDING', conversationId: null },
      { id: 'act-2', status: 'PENDING', conversationId: null },
    ]);

    const result = await cancelWorkflow(ctx, 'wf-1');

    expect(result.status).toBe('CANCELLED');
    expect(result.cancelled).toBe(2);
    expect(prisma.aiAction.updateMany).toHaveBeenCalled();
  });

  it('undoes executed steps in reverse order', async () => {
    (prisma.aiAction.findMany as jest.Mock).mockResolvedValue([
      { id: 'act-2', restaurantId: RESTAURANT_ID, conversationId: null, stepOrder: 1, tool: 'set_item_price', status: 'EXECUTED', undoExpiresAt: new Date(Date.now() + 10_000), resolvedArgs: { itemId: 'm-3', price: 950 }, beforeState: { itemId: 'm-3', price: 900 }, summary: 'price' },
      { id: 'act-1', restaurantId: RESTAURANT_ID, conversationId: null, stepOrder: 0, tool: 'set_item_availability', status: 'EXECUTED', undoExpiresAt: new Date(Date.now() + 10_000), resolvedArgs: { itemId: 'm-1', available: false }, beforeState: { itemId: 'm-1', isAvailable: true }, summary: 'availability' },
    ]);
    (prisma.menuItem.update as jest.Mock).mockResolvedValue({ id: 'm-1', name: 'X', isAvailable: true });

    const result = await undoWorkflow(ctx, 'wf-1');

    expect(result.status).toBe('UNDONE');
    expect(result.steps).toHaveLength(2);
    expect(prisma.menuItem.update).toHaveBeenCalledTimes(2);
  });
});

describe('command routes — security', () => {
  it('requires authentication (401)', async () => {
    const res = await request(app).post('/api/v1/ai/command').send({ text: 'hello' });
    expect(res.status).toBe(401);
  });

  it('rejects a body that tries to supply role or restaurantId (422)', async () => {
    const owner = await createTestOwner({ id: OWNER_ID });
    const token = generateTestToken(owner.id, 'owner', RESTAURANT_ID);

    const res = await request(app)
      .post('/api/v1/ai/command')
      .set(getAuthHeader(token))
      .send({ text: 'show sales', role: 'super_admin', restaurantId: '99999999-9999-9999-9999-999999999999' });

    expect(res.status).toBe(422);
    expect(openai.selectCommandPlan).not.toHaveBeenCalled();
  });

  it('blocks staff roles from AI commands (403) — manual UI only', async () => {
    for (const role of ['manager', 'cashier', 'waiter', 'kitchen']) {
      const token = generateTestToken(`staff-${role}`, role, RESTAURANT_ID);
      const res = await request(app)
        .post('/api/v1/ai/command')
        .set(getAuthHeader(token))
        .send({ text: 'show sales' });
      expect(res.status).toBe(403);
    }
    expect(openai.selectCommandPlan).not.toHaveBeenCalled();
  });

  it('blocks a service call from a staff role (defense in depth)', async () => {
    await expect(
      handleCommand({ ...ctx, role: 'cashier' }, { text: 'show sales' })
    ).rejects.toThrow();
    expect(openai.selectCommandPlan).not.toHaveBeenCalled();
  });

  it('fails closed when a super-admin has no restaurant context (400)', async () => {
    const token = generateTestToken('admin-1', 'SUPER_ADMIN');
    const res = await request(app)
      .post('/api/v1/ai/command')
      .set(getAuthHeader(token))
      .send({ text: 'show sales' });

    expect(res.status).toBe(400);
    expect(openai.selectCommandPlan).not.toHaveBeenCalled();
  });

  it('rejects a service call without a valid restaurant id (defense in depth)', async () => {
    await expect(
      handleCommand({ restaurantId: '', userId: OWNER_ID, role: 'owner' }, { text: 'show sales' })
    ).rejects.toThrow();
    expect(openai.selectCommandPlan).not.toHaveBeenCalled();
  });

  it('derives context from the token and returns an answer', async () => {
    const owner = await createTestOwner({ id: OWNER_ID });
    const token = generateTestToken(owner.id, 'owner', RESTAURANT_ID);

    (openai.selectCommandPlan as jest.Mock).mockResolvedValue({
      actions: [{ action: 'get_low_stock', args: {} }],
      reply: '',
    });
    (prisma.inventoryItem.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.stockMovement.aggregate as jest.Mock).mockResolvedValue({ _sum: { quantity: 0 } });
    (openai.generateManagerAnswer as jest.Mock).mockResolvedValue({
      reply: 'No items are low on stock.',
      model: 'deepseek-v4-flash',
      usage: { promptTokens: 1, completionTokens: 1 },
    });

    const res = await request(app)
      .post('/api/v1/ai/command')
      .set(getAuthHeader(token))
      .send({ text: 'what stock is low?' });

    expect(res.status).toBe(200);
    expect(res.body.data.kind).toBe('answer');
    expect(res.body.data.toolUsed).toBe('get_low_stock');
  });
});

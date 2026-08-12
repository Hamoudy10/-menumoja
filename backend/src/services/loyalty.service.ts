import { prisma } from '@/config/database';
import { NotFoundError, ConflictError, AppError } from '@/utils/errors';
import logger from '@/utils/logger';

/**
 * Smart loyalty engine.
 *
 * - Points: earned per KES spent (program.pointsPerKes), held in an
 *   immutable ledger (LoyaltyTransaction). Balance is never overwritten.
 * - Rules: trigger → reward. Triggers evaluated against the customer's
 *   history + the current order. Rewards issued with a per-customer usage
 *   limit to prevent abuse. Rules are date-windowed + active-flagged.
 * - REFERRAL trigger intentionally deferred (no referral infrastructure).
 */

const EARN = 'EARN';
const REDEEM = 'REDEEM';
const ADJUST = 'ADJUST';
const EXPIRE = 'EXPIRE';

export async function getOrCreateProgram(restaurantId: string): Promise<any> {
  let program = await prisma.loyaltyProgram.findUnique({ where: { restaurantId } });
  if (!program) {
    program = await prisma.loyaltyProgram.create({
      data: { restaurantId },
    });
  }
  return program;
}

export async function updateProgram(restaurantId: string, data: { name?: string; pointsPerKes?: number; pointsExpiryDays?: number | null; isActive?: boolean }): Promise<any> {
  const program = await getOrCreateProgram(restaurantId);
  return prisma.loyaltyProgram.update({
    where: { id: program.id },
    data: {
      name: data.name,
      pointsPerKes: data.pointsPerKes !== undefined ? data.pointsPerKes : undefined,
      pointsExpiryDays: data.pointsExpiryDays !== undefined ? data.pointsExpiryDays : undefined,
      isActive: data.isActive,
    },
  });
}

// ── Accounts & ledger ──

async function getOrCreateAccount(restaurantId: string, customerId: string): Promise<any> {
  const account = await prisma.loyaltyAccount.findUnique({
    where: { customerId },
  });
  if (account) return account;

  try {
    return await prisma.loyaltyAccount.create({
      data: { restaurantId, customerId },
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return prisma.loyaltyAccount.findUniqueOrThrow({
        where: { customerId },
      });
    }
    throw error;
  }
}

/**
 * Applies a signed point movement to an account + writes an immutable
 * ledger row. Returns the updated account.
 */
export async function applyPoints(
  restaurantId: string,
  customerId: string,
  points: number,
  type: 'EARN' | 'REDEEM' | 'ADJUST' | 'EXPIRE',
  reason: string,
  reference?: { referenceType?: string; referenceId?: string }
): Promise<any> {
  if (points === 0) return null;

  const account = await getOrCreateAccount(restaurantId, customerId);

  if (points < 0 && account.pointsBalance + points < 0) {
    throw new ConflictError('Insufficient points', 'Pointi hazitoshi');
  }

  const updated = await prisma.$transaction(async (tx) => {
    await tx.loyaltyTransaction.create({
      data: {
        restaurantId,
        accountId: account.id,
        type,
        points,
        reason,
        referenceType: reference?.referenceType || null,
        referenceId: reference?.referenceId || null,
      },
    });
    return tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        pointsBalance: { increment: points },
        totalEarned: points > 0 ? { increment: points } : undefined,
        totalRedeemed: points < 0 ? { increment: -points } : undefined,
      },
    });
  });

  return updated;
}

// ── Rule evaluation ──

export async function listRules(restaurantId: string): Promise<any[]> {
  return prisma.loyaltyRule.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function createRule(restaurantId: string, data: any): Promise<any> {
  return prisma.loyaltyRule.create({
    data: {
      restaurantId,
      name: data.name,
      triggerType: data.triggerType,
      triggerValue: String(data.triggerValue),
      rewardType: data.rewardType,
      rewardValue: String(data.rewardValue),
      rewardItemId: data.rewardItemId || null,
      rewardQuantity: data.rewardQuantity ?? null,
      startsAt: data.startsAt ? new Date(data.startsAt) : null,
      endsAt: data.endsAt ? new Date(data.endsAt) : null,
      usageLimit: data.usageLimit ?? 1,
    },
  });
}

export async function updateRule(restaurantId: string, ruleId: string, data: any): Promise<any> {
  const rule = await prisma.loyaltyRule.findFirst({ where: { id: ruleId, restaurantId } });
  if (!rule) throw new NotFoundError('Loyalty rule not found', 'Kanuni ya uaminifu haikupatikana');

  return prisma.loyaltyRule.update({
    where: { id: ruleId },
    data: {
      name: data.name,
      triggerType: data.triggerType,
      triggerValue: data.triggerValue !== undefined ? String(data.triggerValue) : undefined,
      rewardType: data.rewardType,
      rewardValue: data.rewardValue !== undefined ? String(data.rewardValue) : undefined,
      rewardItemId: data.rewardItemId !== undefined ? data.rewardItemId : undefined,
      rewardQuantity: data.rewardQuantity !== undefined ? data.rewardQuantity : undefined,
      startsAt: data.startsAt !== undefined ? (data.startsAt ? new Date(data.startsAt) : null) : undefined,
      endsAt: data.endsAt !== undefined ? (data.endsAt ? new Date(data.endsAt) : null) : undefined,
      usageLimit: data.usageLimit,
      isActive: data.isActive,
    },
  });
}

export async function deleteRule(restaurantId: string, ruleId: string): Promise<void> {
  const rule = await prisma.loyaltyRule.findFirst({ where: { id: ruleId, restaurantId } });
  if (!rule) throw new NotFoundError('Loyalty rule not found', 'Kanuni ya uaminifu haikupatikana');
  await prisma.loyaltyRule.delete({ where: { id: ruleId } });
}

interface OrderContext {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  items: Array<{ menuItemId: string | null; name: string; quantity: number; categoryName?: string | null }>;
  createdAt: Date;
}

interface CustomerContext {
  customerId: string;
  totalVisits: number;
  totalSpend: number;
  firstVisit: Date;
  lastVisit: Date;
  dateOfBirth: Date | null;
}

/**
 * Evaluates a paid order against the loyalty program + rules.
 * 1. Earns points (pointsPerKes × spend).
 * 2. Issues rewards for every matching rule (usage-limited per customer).
 * Best-effort: failures are logged, never break payment.
 */
export async function processPaidOrder(
  restaurantId: string,
  order: OrderContext,
  customer: CustomerContext
): Promise<{ pointsEarned: number; rewardsIssued: number }> {
  const program = await prisma.loyaltyProgram.findUnique({ where: { restaurantId } });
  if (!program || !program.isActive) return { pointsEarned: 0, rewardsIssued: 0 };

  const [rules, existingAccount] = await Promise.all([
    prisma.loyaltyRule.findMany({
      where: { restaurantId, isActive: true },
    }),
    prisma.loyaltyAccount.findUnique({
      where: { customerId: customer.customerId },
    }),
  ]);

  let pointsEarned = 0;
  const pointsPerKes = Number(program.pointsPerKes);
  if (pointsPerKes > 0 && order.totalAmount >= 1) {
    pointsEarned = Math.floor(order.totalAmount / pointsPerKes);
    if (pointsEarned > 0) {
      await applyPoints(restaurantId, customer.customerId, pointsEarned, EARN as any, `Spend of KES ${Math.floor(order.totalAmount)}`, {
        referenceType: 'ORDER',
        referenceId: order.orderId,
      });
    }
  }

  let rewardsIssued = 0;
  const now = new Date();
  const activeRules = rules.filter((r) => {
    if (r.startsAt && now < r.startsAt) return false;
    if (r.endsAt && now > r.endsAt) return false;
    return true;
  });

  for (const rule of activeRules) {
    const matched = evaluateRule(rule, order, customer);
    if (!matched) continue;

    // abuse prevention: per-customer usage limit per rule
    if (existingAccount) {
      const used = await prisma.loyaltyReward.count({
        where: { accountId: existingAccount.id, ruleId: rule.id },
      });
      if (used >= rule.usageLimit) continue;
    }

    await issueReward(restaurantId, customer.customerId, rule);
    rewardsIssued++;
  }

  return { pointsEarned, rewardsIssued };
}

function evaluateRule(rule: any, order: OrderContext, customer: CustomerContext): boolean {
  switch (rule.triggerType) {
    case 'VISIT_COUNT':
      return customer.totalVisits >= Number(rule.triggerValue);
    case 'SPEND_THRESHOLD':
      return customer.totalSpend >= Number(rule.triggerValue);
    case 'ITEM_COUNT': {
      const targetId = rule.rewardItemId || rule.triggerValue;
      const item = order.items.find((i) => i.menuItemId === targetId || i.name.toLowerCase() === String(rule.triggerValue).toLowerCase());
      return !!item && item.quantity >= (rule.rewardQuantity || 1);
    }
    case 'CATEGORY_PURCHASE': {
      const targetCat = String(rule.triggerValue).toLowerCase();
      return order.items.some((i) => i.categoryName && i.categoryName.toLowerCase() === targetCat);
    }
    case 'INACTIVITY': {
      const days = Number(rule.triggerValue);
      const gapDays = Math.floor((order.createdAt.getTime() - customer.lastVisit.getTime()) / 86400000);
      return gapDays >= days;
    }
    case 'BIRTHDAY': {
      if (!customer.dateOfBirth) return false;
      const dob = customer.dateOfBirth;
      const today = order.createdAt;
      return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
    }
    default:
      return false;
  }
}

async function issueReward(restaurantId: string, customerId: string, rule: any): Promise<void> {
  const account = await getOrCreateAccount(restaurantId, customerId);

  if (rule.rewardType === 'POINTS') {
    await applyPoints(restaurantId, customerId, Number(rule.rewardValue), EARN as any, `Rule: ${rule.name}`, {
      referenceType: 'RULE',
      referenceId: rule.id,
    });
    return;
  }

  await prisma.loyaltyReward.create({
    data: {
      restaurantId,
      accountId: account.id,
      ruleId: rule.id,
      rewardType: rule.rewardType,
      rewardValue: rule.rewardValue,
      itemId: rule.rewardItemId || null,
      quantity: rule.rewardQuantity || 1,
      note: rule.name,
    },
  });
}

// ── Rewards ──

export async function listRewards(restaurantId: string, customerId?: string): Promise<any[]> {
  const where: any = { restaurantId };
  if (customerId) {
    const account = await prisma.loyaltyAccount.findFirst({ where: { restaurantId, customerId } });
    if (!account) return [];
    where.accountId = account.id;
  }
  return prisma.loyaltyReward.findMany({
    where,
    orderBy: { issuedAt: 'desc' },
    take: 200,
  });
}

export async function redeemReward(restaurantId: string, rewardId: string): Promise<any> {
  const reward = await prisma.loyaltyReward.findFirst({ where: { id: rewardId, restaurantId } });
  if (!reward) throw new NotFoundError('Reward not found', 'Zawadi haikupatikana');

  if (reward.status !== 'ISSUED') {
    throw new ConflictError('Reward is not redeemable', 'Zawadi hii haiwezi kutumika');
  }
  if (reward.expiresAt && reward.expiresAt < new Date()) {
    throw new ConflictError('Reward has expired', 'Zawadi imeisha muda wake');
  }

  return prisma.loyaltyReward.update({
    where: { id: rewardId },
    data: { status: 'REDEEMED', redeemedAt: new Date() },
  });
}

export async function cancelReward(restaurantId: string, rewardId: string): Promise<any> {
  const reward = await prisma.loyaltyReward.findFirst({ where: { id: rewardId, restaurantId } });
  if (!reward) throw new NotFoundError('Reward not found', 'Zawadi haikupatikana');
  if (reward.status === 'REDEEMED') throw new ConflictError('Already redeemed', 'Tayari imetumika');
  return prisma.loyaltyReward.update({ where: { id: rewardId }, data: { status: 'CANCELLED' } });
}

// ── Accounts (owner view) ──

/**
 * Convenience wrapper for payment flows: loads the order + customer context
 * and evaluates loyalty for a confirmed payment. Best-effort — never throws
 * into the payment path.
 */
export async function processPayment(restaurantId: string, phone: string, orderId: string): Promise<{ pointsEarned: number; rewardsIssued: number }> {
  try {
    const [order, customer] = await Promise.all([
      prisma.order.findUnique({
        where: { id: orderId },
        include: {
          items: { select: { menuItemId: true, itemName: true, quantity: true, menuItem: { select: { category: { select: { name: true } } } } } },
        },
      }),
      prisma.customer.findUnique({
        where: { restaurantId_phone: { restaurantId, phone } },
      }),
    ]);

    if (!order || !customer) return { pointsEarned: 0, rewardsIssued: 0 };

    return processPaidOrder(
      restaurantId,
      {
        orderId: order.id,
        orderNumber: order.orderNumber,
        totalAmount: Number(order.totalAmount),
        createdAt: order.createdAt,
        items: order.items.map((i) => ({
          menuItemId: i.menuItemId,
          name: i.itemName,
          quantity: i.quantity,
          categoryName: (i as any).menuItem?.category?.name || null,
        })),
      },
      {
        customerId: customer.id,
        totalVisits: customer.totalVisits,
        totalSpend: Number(customer.totalSpend),
        firstVisit: customer.firstVisit,
        lastVisit: customer.lastVisit,
        dateOfBirth: customer.dateOfBirth,
      }
    );
  } catch (error) {
    logger.error('Loyalty processing failed', { error: (error as Error).message, restaurantId, orderId, phone });
    return { pointsEarned: 0, rewardsIssued: 0 };
  }
}

export async function listAccounts(restaurantId: string): Promise<any[]> {
  return prisma.loyaltyAccount.findMany({
    where: { restaurantId },
    orderBy: { pointsBalance: 'desc' },
    take: 100,
    include: {
      customer: { select: { id: true, name: true, phone: true, totalSpend: true, totalVisits: true } },
    },
  });
}

export async function getAccountDetail(restaurantId: string, customerId: string): Promise<any> {
  const account = await prisma.loyaltyAccount.findFirst({
    where: { restaurantId, customerId },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!account) throw new NotFoundError('Loyalty account not found', 'Akaunti ya uaminifu haikupatikana');

  const [transactions, rewards] = await Promise.all([
    prisma.loyaltyTransaction.findMany({
      where: { accountId: account.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.loyaltyReward.findMany({
      where: { accountId: account.id },
      orderBy: { issuedAt: 'desc' },
      take: 50,
    }),
  ]);

  return { account, transactions, rewards };
}

export async function manualAdjust(restaurantId: string, customerId: string, points: number, reason: string, performedById?: string): Promise<any> {
  if (!points || !reason) {
    throw AppError.validation('Points and reason are required', 'Pointi na sababu zinahitajika');
  }
  return applyPoints(restaurantId, customerId, points, ADJUST as any, `Manual adjust by ${performedById || 'owner'}: ${reason}`);
}

import { prisma } from '@/config/database';
import { NotFoundError, ConflictError } from '@/utils/errors';
import * as whatsapp from '@/integrations/whatsapp';
import logger from '@/utils/logger';

/**
 * WhatsApp engagement layer.
 *
 * Privacy: NO message is ever sent without explicit marketing consent
 * (customer.consentMarketing && !isOptedOut) — and only when the customer's
 * preferred channel is unset or whatsapp. Transactional confirmations still
 * require consent per the master plan (marketing consent is the gate).
 *
 * Delivery tracking: only SENT/FAILED are recorded. Meta delivery receipts
 * require webhook wiring — we never claim delivered/open stats we don't have.
 */

export const DEFAULT_TEMPLATES: Record<string, string> = {
  order_confirm: 'Hello {{customerName}}! 🍽️ Your order {{orderNumber}} has been received at {{restaurantName}}. Estimated prep time: {{prepMinutes}} min. We will notify you when it is ready. - {{restaurantName}}',
  payment_receipt: 'Payment received! ✅ KES {{amount}} paid for order {{orderNumber}} via {{method}}. Receipt: {{receiptNo}}. Thank you for dining with {{restaurantName}}!',
  order_ready: 'Your order {{orderNumber}} is READY! 🎉 Please pick it up at {{restaurantName}}. Thank you!',
  promotion: 'Special offer at {{restaurantName}}! {{promotion}}. Show this message to redeem. Valid while stocks last. 🎁',
  winback: 'We miss you, {{customerName}}! 👋 Come back to {{restaurantName}} — {{promotion}}. See you soon!',
  birthday: 'Happy birthday, {{customerName}}! 🎂 Enjoy a special treat at {{restaurantName}} on us today. 🎉',
  reservation_confirm: 'Reservation confirmed at {{restaurantName}}! 🪑 Party of {{partySize}} on {{reservedAt}}. See you soon!',
};

function normalizePhone(phone: string): string {
  let p = phone.trim().replace(/\s+/g, '');
  if (p.startsWith('+')) p = p.slice(1);
  else if (p.startsWith('0')) p = `254${p.slice(1)}`;
  return p;
}

export function canContact(customer: { consentMarketing: boolean; isOptedOut: boolean; preferredChannel?: string | null }): boolean {
  if (!customer.consentMarketing) return false;
  if (customer.isOptedOut) return false;
  const channel = (customer.preferredChannel || '').toLowerCase();
  if (channel && channel !== 'whatsapp') return false;
  return true;
}

export function compileTemplate(content: string, vars: Record<string, string | number>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = vars[key];
    return value !== undefined ? String(value) : match;
  });
}

async function isEnabled(restaurantId: string): Promise<boolean> {
  const settings = await prisma.whatsAppSettings.findUnique({ where: { restaurantId } });
  return !!settings?.enabled;
}

async function sendToCustomer(restaurantId: string, phone: string, message: string): Promise<boolean> {
  if (!message || message.trim().length === 0) return false;
  try {
    await whatsapp.sendTextMessage(normalizePhone(phone), message.slice(0, 4096));
    return true;
  } catch (error: any) {
    logger.error('WhatsApp send failed', { error: error.message, restaurantId, phone });
    return false;
  }
}

export async function getSettings(restaurantId: string): Promise<any> {
  let settings = await prisma.whatsAppSettings.findUnique({ where: { restaurantId } });
  if (!settings) {
    settings = await prisma.whatsAppSettings.create({ data: { restaurantId } });
  }
  return settings;
}

export async function saveSettings(restaurantId: string, data: { enabled?: boolean; businessPhone?: string }): Promise<any> {
  const settings = await getSettings(restaurantId);
  return prisma.whatsAppSettings.update({
    where: { id: settings.id },
    data: {
      enabled: data.enabled,
      businessPhone: data.businessPhone !== undefined ? (data.businessPhone || null) : undefined,
    },
  });
}

// ── Templates ──

export async function listTemplates(restaurantId: string): Promise<any[]> {
  return prisma.messageTemplate.findMany({
    where: { restaurantId },
    orderBy: { name: 'asc' },
  });
}

export async function createTemplate(restaurantId: string, data: { name: string; content: string; isActive?: boolean }): Promise<any> {
  return prisma.messageTemplate.create({
    data: { restaurantId, name: data.name, content: data.content, isActive: data.isActive ?? true },
  });
}

export async function updateTemplate(restaurantId: string, templateId: string, data: { name?: string; content?: string; isActive?: boolean }): Promise<any> {
  const template = await prisma.messageTemplate.findFirst({ where: { id: templateId, restaurantId } });
  if (!template) throw new NotFoundError('Template not found', 'Kiolezo hakikupatikana');
  return prisma.messageTemplate.update({ where: { id: templateId }, data });
}

export async function deleteTemplate(restaurantId: string, templateId: string): Promise<void> {
  const template = await prisma.messageTemplate.findFirst({ where: { id: templateId, restaurantId } });
  if (!template) throw new NotFoundError('Template not found', 'Kiolezo hakikupatikana');
  await prisma.messageTemplate.delete({ where: { id: templateId } });
}

async function getTemplateContent(restaurantId: string, name: string): Promise<string | null> {
  const template = await prisma.messageTemplate.findFirst({
    where: { restaurantId, name, isActive: true },
  });
  if (template) return template.content;
  return DEFAULT_TEMPLATES[name] || null;
}

// ── Transactional sends (best-effort; consent-gated) ──

export async function sendTransactional(restaurantId: string, templateName: string, phone: string, vars: Record<string, string | number>): Promise<boolean> {
  try {
    if (!(await isEnabled(restaurantId))) return false;

    const customer = await prisma.customer.findUnique({
      where: { restaurantId_phone: { restaurantId, phone: normalizePhone(phone) } },
    });
    if (!customer || !canContact(customer)) return false;

    const content = await getTemplateContent(restaurantId, templateName);
    if (!content) return false;

    const message = compileTemplate(content, {
      customerName: customer.name || 'friend',
      restaurantName: vars.restaurantName || 'our restaurant',
      ...vars,
    });

    return sendToCustomer(restaurantId, customer.phone, message);
  } catch (error: any) {
    logger.error('Transactional WhatsApp send failed', { error: error.message, restaurantId, templateName });
    return false;
  }
}

// ── Campaigns ──

export async function listCampaigns(restaurantId: string): Promise<any[]> {
  return prisma.campaign.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}

export async function createCampaign(restaurantId: string, data: { name: string; audienceSegment?: string; templateId?: string; message?: string; scheduledAt?: string }): Promise<any> {
  return prisma.campaign.create({
    data: {
      restaurantId,
      name: data.name,
      audienceSegment: data.audienceSegment || null,
      templateId: data.templateId || null,
      message: data.message || null,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
      status: data.scheduledAt ? 'SCHEDULED' : 'DRAFT',
    },
  });
}

export async function getCampaign(restaurantId: string, campaignId: string): Promise<any> {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, restaurantId },
    include: {
      deliveries: { orderBy: { createdAt: 'desc' }, take: 200 },
      events: true,
      template: true,
    },
  });
  if (!campaign) throw new NotFoundError('Campaign not found', 'Kampeni haikupatikana');
  return campaign;
}

/**
 * Builds the audience for a segment: only consenting, opted-in customers.
 */
async function buildAudience(restaurantId: string, segment?: string): Promise<Array<{ id: string; phone: string; name: string | null; consentMarketing: boolean; isOptedOut: boolean; preferredChannel: string | null }>> {
  const customers = await prisma.customer.findMany({
    where: { restaurantId, consentMarketing: true, isOptedOut: false },
  });

  let audience = customers.filter((c) => {
    const channel = (c.preferredChannel || '').toLowerCase();
    return !channel || channel === 'whatsapp';
  });

  if (segment && segment !== 'ALL') {
    // segments are derived — reuse the CRM classifier with customer stats
    const { classifyCustomer } = await import('@/services/customer.service');
    audience = audience.filter((c) => {
      const segs = classifyCustomer({
        totalSpend: Number(c.totalSpend),
        totalVisits: c.totalVisits,
        firstVisit: c.firstVisit,
        lastVisit: c.lastVisit,
        lunchShare: 0, dinnerShare: 0, weekendShare: 0, topCategoryShare: 0,
      });
      return segs.includes(segment);
    });
  }

  return audience;
}

/**
 * Sends a campaign to its audience (consent-gated). Records every delivery
 * (SENT/FAILED). Idempotent: campaigns already SENT cannot be re-sent.
 */
export async function sendCampaign(restaurantId: string, campaignId: string): Promise<any> {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, restaurantId } });
  if (!campaign) throw new NotFoundError('Campaign not found', 'Kampeni haikupatikana');
  if (campaign.status === 'SENT') throw new ConflictError('Campaign already sent', 'Kampeni tayari imetumwa');

  if (!(await isEnabled(restaurantId))) {
    throw new ConflictError('WhatsApp is not enabled for this restaurant', 'WhatsApp haijawashwa kwa mgahawa huu');
  }

  const template = campaign.templateId
    ? await prisma.messageTemplate.findUnique({ where: { id: campaign.templateId } })
    : null;
  const content = template?.content || campaign.message;
  if (!content) {
    throw new ConflictError('Campaign has no message — set a template or custom message', 'Kampeni haina ujumbe');
  }

  const audience = await buildAudience(restaurantId, campaign.audienceSegment || undefined);

  let sent = 0;
  let failed = 0;

  for (const customer of audience) {
    const message = compileTemplate(content, { customerName: customer.name || 'friend', restaurantName: 'our restaurant' });
    const ok = await sendToCustomer(restaurantId, customer.phone, message);
    await prisma.campaignDelivery.create({
      data: {
        campaignId,
        customerId: customer.id,
        phone: customer.phone,
        status: ok ? 'SENT' : 'FAILED',
        error: ok ? null : 'send_failed',
        sentAt: ok ? new Date() : null,
      },
    });
    if (ok) sent++;
    else failed++;
  }

  return prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      totalRecipients: audience.length,
      sentCount: sent,
      failedCount: failed,
    },
  });
}

export async function deleteCampaign(restaurantId: string, campaignId: string): Promise<void> {
  const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, restaurantId } });
  if (!campaign) throw new NotFoundError('Campaign not found', 'Kampeni haikupatikana');
  if (campaign.status === 'SENT') throw new ConflictError('Sent campaigns cannot be deleted', 'Kampeni iliyotumwa haiwezi kufutwa');
  await prisma.campaign.delete({ where: { id: campaignId } });
}

/**
 * Conversion attribution: call when an order from a campaign audience
 * customer is PAID. Attributes revenue to campaigns sent within the last
 * 7 days. Best-effort.
 */
export async function recordCampaignConversion(restaurantId: string, customerId: string, orderId: string, amount: number): Promise<void> {
  try {
    const recentCampaigns = await prisma.campaign.findMany({
      where: {
        restaurantId,
        status: 'SENT',
        sentAt: { gte: new Date(Date.now() - 7 * 86400000) },
      },
      select: { id: true },
    });
    if (recentCampaigns.length === 0) return;

    for (const campaign of recentCampaigns) {
      const delivered = await prisma.campaignDelivery.findFirst({
        where: { campaignId: campaign.id, customerId },
      });
      if (!delivered) continue;
      await prisma.campaignEvent.create({
        data: {
          campaignId: campaign.id,
          customerId,
          type: 'ORDER',
          referenceId: orderId,
          value: amount,
        },
      });
    }
  } catch (error: any) {
    logger.error('Campaign conversion attribution failed', { error: error.message, restaurantId, customerId });
  }
}

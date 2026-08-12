import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import {
  setupTestApp,
  prisma,
  createTestOwner,
  createTestRestaurant,
  generateTestToken,
  getAuthHeader,
  cleanupTestData,
} from './helpers';
import * as whatsappIntegration from '../src/integrations/whatsapp';
import { compileTemplate, sendTransactional, sendCampaign, recordCampaignConversion, canContact } from '../src/services/whatsapp.service';

jest.mock('../src/integrations/whatsapp', () => ({
  sendTextMessage: jest.fn().mockResolvedValue({}),
}));

const app = setupTestApp();

beforeEach(() => {
  cleanupTestData();
});

async function setupTenant() {
  const owner = await createTestOwner();
  const restaurant = await createTestRestaurant(owner.id);
  const token = generateTestToken(owner.id, 'owner', restaurant.id);
  return { owner, restaurant, token };
}

describe('TEMPLATE ENGINE', () => {
  it('compiles {{placeholders}} with provided variables', () => {
    const compiled = compileTemplate('Hello {{customerName}}, your order {{orderNumber}} is ready!', {
      customerName: 'Jane',
      orderNumber: 'ORD-123',
    });
    expect(compiled).toBe('Hello Jane, your order ORD-123 is ready!');
  });

  it('leaves unknown placeholders untouched', () => {
    expect(compileTemplate('Hi {{missing}}', {})).toBe('Hi {{missing}}');
  });
});

describe('CONSENT GATE', () => {
  it('never sends without marketing consent', async () => {
    const { restaurant } = await setupTenant();
    (prisma.whatsAppSettings.findUnique as jest.Mock).mockResolvedValue({ enabled: true });
    (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1', consentMarketing: false, isOptedOut: false, preferredChannel: null, name: 'Jane',
    });

    const sent = await sendTransactional(restaurant.id, 'order_confirm', '254712345678', {});

    expect(sent).toBe(false);
    expect(whatsappIntegration.sendTextMessage).not.toHaveBeenCalled();
  });

  it('never sends to opted-out customers', async () => {
    const { restaurant } = await setupTenant();
    (prisma.whatsAppSettings.findUnique as jest.Mock).mockResolvedValue({ enabled: true });
    (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1', consentMarketing: true, isOptedOut: true, preferredChannel: null, name: 'Jane',
    });

    const sent = await sendTransactional(restaurant.id, 'order_confirm', '254712345678', {});
    expect(sent).toBe(false);
    expect(whatsappIntegration.sendTextMessage).not.toHaveBeenCalled();
  });

  it('does not send when WhatsApp is disabled', async () => {
    const { restaurant } = await setupTenant();
    (prisma.whatsAppSettings.findUnique as jest.Mock).mockResolvedValue({ enabled: false });
    (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1', consentMarketing: true, isOptedOut: false, preferredChannel: null, name: 'Jane',
    });

    const sent = await sendTransactional(restaurant.id, 'order_confirm', '254712345678', {});
    expect(sent).toBe(false);
  });

  it('sends when enabled + consenting, with the compiled template', async () => {
    const { restaurant } = await setupTenant();
    (prisma.whatsAppSettings.findUnique as jest.Mock).mockResolvedValue({ enabled: true });
    (prisma.customer.findUnique as jest.Mock).mockResolvedValue({
      id: 'c1', phone: '254712345678', consentMarketing: true, isOptedOut: false, preferredChannel: null, name: 'Jane',
    });
    (prisma.messageTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 't1', content: 'Hi {{customerName}} — order {{orderNumber}} received!', isActive: true,
    });
    (whatsappIntegration.sendTextMessage as jest.Mock).mockResolvedValue({});

    const sent = await sendTransactional(restaurant.id, 'order_confirm', '254712345678', { orderNumber: 'ORD-9' });

    expect(sent).toBe(true);
    expect(whatsappIntegration.sendTextMessage).toHaveBeenCalledWith(
      '254712345678',
      'Hi Jane — order ORD-9 received!'
    );
  });

  it('canContact respects preferred channel', () => {
    expect(canContact({ consentMarketing: true, isOptedOut: false, preferredChannel: null })).toBe(true);
    expect(canContact({ consentMarketing: true, isOptedOut: false, preferredChannel: 'whatsapp' })).toBe(true);
    expect(canContact({ consentMarketing: true, isOptedOut: false, preferredChannel: 'sms' })).toBe(false);
    expect(canContact({ consentMarketing: false, isOptedOut: false, preferredChannel: null })).toBe(false);
  });
});

describe('CAMPAIGNS', () => {
  it('sends to the consenting audience and records deliveries', async () => {
    const { restaurant, token } = await setupTenant();
    const campaignId = uuidv4();

    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
      id: campaignId, restaurantId: restaurant.id, status: 'DRAFT', templateId: null, message: 'Hi {{customerName}}, come to our restaurant!', audienceSegment: null,
    });
    (prisma.whatsAppSettings.findUnique as jest.Mock).mockResolvedValue({ enabled: true });
    (prisma.customer.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', phone: '254712345678', name: 'Jane', consentMarketing: true, isOptedOut: false, preferredChannel: null },
      { id: 'c2', phone: '254722222222', name: 'John', consentMarketing: true, isOptedOut: false, preferredChannel: 'whatsapp' },
    ]);
    (whatsappIntegration.sendTextMessage as jest.Mock).mockResolvedValue({});
    (prisma.campaignDelivery.create as jest.Mock).mockResolvedValue({});
    (prisma.campaign.update as jest.Mock).mockResolvedValue({ id: campaignId, status: 'SENT', totalRecipients: 2, sentCount: 2, failedCount: 0 });

    const res = await request(app)
      .post(`/api/v1/whatsapp/campaigns/${campaignId}/send`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(prisma.campaignDelivery.create).toHaveBeenCalledTimes(2);
    expect(whatsappIntegration.sendTextMessage).toHaveBeenCalledTimes(2);
    const firstDelivery = (prisma.campaignDelivery.create as jest.Mock).mock.calls[0][0].data;
    expect(firstDelivery.status).toBe('SENT');
  });

  it('marks failed deliveries and still reports counts', async () => {
    const { restaurant } = await setupTenant();
    const campaignId = uuidv4();

    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
      id: campaignId, restaurantId: restaurant.id, status: 'DRAFT', templateId: null, message: 'Hi {{customerName}}!', audienceSegment: null,
    });
    (prisma.whatsAppSettings.findUnique as jest.Mock).mockResolvedValue({ enabled: true });
    (prisma.customer.findMany as jest.Mock).mockResolvedValue([
      { id: 'c1', phone: '254712345678', name: 'Jane', consentMarketing: true, isOptedOut: false, preferredChannel: null },
    ]);
    (whatsappIntegration.sendTextMessage as jest.Mock).mockRejectedValue(new Error('provider down'));
    (prisma.campaignDelivery.create as jest.Mock).mockResolvedValue({});
    (prisma.campaign.update as jest.Mock).mockResolvedValue({ id: campaignId, status: 'SENT', totalRecipients: 1, sentCount: 0, failedCount: 1 });

    const result = await sendCampaign(restaurant.id, campaignId);

    expect(result.failedCount).toBe(1);
    const deliveryData = (prisma.campaignDelivery.create as jest.Mock).mock.calls[0][0].data;
    expect(deliveryData.status).toBe('FAILED');
  });

  it('rejects re-sending a campaign that was already sent', async () => {
    const { restaurant, token } = await setupTenant();
    const campaignId = uuidv4();
    (prisma.campaign.findFirst as jest.Mock).mockResolvedValue({
      id: campaignId, restaurantId: restaurant.id, status: 'SENT',
    });

    const res = await request(app)
      .post(`/api/v1/whatsapp/campaigns/${campaignId}/send`)
      .set(getAuthHeader(token));

    expect(res.status).toBe(409);
  });
});

describe('CONVERSION ATTRIBUTION', () => {
  it('attributes paid orders to campaigns delivered within 7 days', async () => {
    const { restaurant } = await setupTenant();
    (prisma.campaign.findMany as jest.Mock).mockResolvedValue([
      { id: 'camp-1', sentAt: new Date(Date.now() - 2 * 86400000) },
      { id: 'camp-old', sentAt: new Date(Date.now() - 30 * 86400000) },
    ]);
    (prisma.campaignDelivery.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'd1', campaignId: 'camp-1', customerId: 'c1' })
      .mockResolvedValueOnce(null); // not delivered for the old campaign
    (prisma.campaignEvent.create as jest.Mock).mockResolvedValue({});

    await recordCampaignConversion(restaurant.id, 'c1', 'order-1', 1200);

    expect(prisma.campaignEvent.create).toHaveBeenCalledTimes(1);
    const eventData = (prisma.campaignEvent.create as jest.Mock).mock.calls[0][0].data;
    expect(eventData.campaignId).toBe('camp-1');
    expect(eventData.type).toBe('ORDER');
    expect(Number(eventData.value)).toBe(1200);
  });
});

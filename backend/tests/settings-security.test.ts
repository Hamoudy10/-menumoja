import { prisma, setupTestApp, createTestOwner, createTestRestaurant, generateTestToken, getAuthHeader, cleanupTestData } from './helpers';
import request from 'supertest';
import { encryptSecret, decryptSecret, isEncryptedSecret } from '../src/utils/encryption';

/**
 * Regression tests for payment-credential handling.
 *
 * The M-Pesa passkey is a high-value secret. It must be:
 *  - encrypted at rest (enc:v1: prefix),
 *  - never returned by the public menu endpoint,
 *  - never returned by owner/admin settings endpoints (only `mpesaPasskeySet`).
 */

const app = setupTestApp();

const SECRET = 'super-secret-daraja-passkey';

function baseRestaurant(overrides: Record<string, any> = {}) {
  return {
    id: '11111111-1111-1111-1111-111111111111',
    ownerId: '22222222-2222-2222-2222-222222222222',
    name: 'Test Restaurant',
    slug: 'test-restaurant',
    description: null,
    descriptionSw: null,
    logoUrl: null,
    coverPhotoUrl: null,
    phone: '+254712345678',
    address: 'Mombasa',
    city: 'Mombasa',
    currency: 'KES',
    isHalalCertified: false,
    dietaryOptions: [],
    isActive: true,
    isSuspended: false,
    suspensionReason: null,
    subscriptionStatus: 'TRIAL',
    settings: {
      primaryColor: '#0A1628',
      secondaryColor: '#FF6B35',
      mpesaShortcode: '174379',
      mpesaPasskey: SECRET,
      mpesaBusinessName: 'Test Ltd',
      allowMpesaPayment: true,
      allowCashPayment: true,
    },
    openingHours: [],
    tables: [],
    menuCategories: [],
    _count: { staff: 0, menuCategories: 0, menuItems: 0, branches: 0, qrCodes: 0 },
    plan: { id: 'plan-1', name: 'Starter', maxMenuItems: 20, maxTables: 10 },
    ...overrides,
  };
}

beforeEach(() => {
  cleanupTestData();
});

describe('secret encryption at rest', () => {
  it('round-trips an encrypted secret', () => {
    const encrypted = encryptSecret(SECRET);
    expect(encrypted.startsWith('enc:v1:')).toBe(true);
    expect(encrypted).not.toContain(SECRET);
    expect(isEncryptedSecret(encrypted)).toBe(true);
    expect(decryptSecret(encrypted)).toBe(SECRET);
  });

  it('treats legacy plaintext as plaintext (backwards compatible)', () => {
    expect(decryptSecret(SECRET)).toBe(SECRET);
    expect(isEncryptedSecret(SECRET)).toBe(false);
    expect(decryptSecret(null)).toBe('');
  });
});

describe('public menu does not leak payment credentials', () => {
  it('omits mpesaPasskey/mpesaShortcode but keeps public branding', async () => {
    (prisma.restaurant.findUnique as jest.Mock).mockResolvedValue(baseRestaurant());
    (prisma.promotion.findMany as jest.Mock).mockResolvedValue([]);

    const res = await request(app).get('/api/v1/menu/public/test-restaurant');

    expect(res.status).toBe(200);
    const settings = res.body.data.settings;
    expect(settings).toBeDefined();
    expect(settings.primaryColor).toBe('#0A1628');
    expect(settings).not.toHaveProperty('mpesaPasskey');
    expect(settings).not.toHaveProperty('mpesaShortcode');
    expect(settings).not.toHaveProperty('mpesaBusinessName');
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });
});

describe('owner settings never return the raw passkey', () => {
  it('GET /restaurant/me reports mpesaPasskeySet instead of the secret', async () => {
    const owner = await createTestOwner({ id: '22222222-2222-2222-2222-222222222222' });
    const token = generateTestToken(owner.id, 'owner', baseRestaurant().id);
    (prisma.restaurant.findFirst as jest.Mock).mockResolvedValue(baseRestaurant());

    const res = await request(app)
      .get('/api/v1/restaurant/me')
      .set(getAuthHeader(token));

    expect(res.status).toBe(200);
    expect(res.body.data.settings).not.toHaveProperty('mpesaPasskey');
    expect(res.body.data.settings.mpesaPasskeySet).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);
  });

  it('PUT /restaurant/me/settings encrypts the passkey before storing it', async () => {
    const owner = await createTestOwner({ id: '22222222-2222-2222-2222-222222222222' });
    const token = generateTestToken(owner.id, 'owner', baseRestaurant().id);

    (prisma.restaurantSettings.upsert as jest.Mock).mockImplementation(async ({ create, update }: any) =>
      baseRestaurant().settings ? { ...baseRestaurant().settings, ...create, ...update } : { ...create, ...update }
    );

    const res = await request(app)
      .put('/api/v1/restaurant/me/settings')
      .set(getAuthHeader(token))
      .send({ paymentSettings: { mpesaPasskey: SECRET } });

    expect(res.status).toBe(200);

    const upsertArg = (prisma.restaurantSettings.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertArg.update.mpesaPasskey).toMatch(/^enc:v1:/);
    expect(upsertArg.update.mpesaPasskey).not.toBe(SECRET);
    expect(res.body.data).not.toHaveProperty('mpesaPasskey');
    expect(res.body.data.mpesaPasskeySet).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain(SECRET);

    // The audit middleware must redact the passkey from the persisted body.
    const auditCalls = (prisma.auditLog.create as jest.Mock).mock.calls;
    const auditCall = auditCalls[auditCalls.length - 1];
    expect(auditCall).toBeDefined();
    expect(JSON.stringify(auditCall[0].data.details)).not.toContain(SECRET);
  });

  it('does not overwrite an existing passkey when the field is blank', async () => {
    const owner = await createTestOwner({ id: '22222222-2222-2222-2222-222222222222' });
    const token = generateTestToken(owner.id, 'owner', baseRestaurant().id);

    (prisma.restaurantSettings.upsert as jest.Mock).mockImplementation(async ({ create, update }: any) => ({ ...create, ...update }));

    await request(app)
      .put('/api/v1/restaurant/me/settings')
      .set(getAuthHeader(token))
      .send({ paymentSettings: { mpesaPasskey: '' } });

    const upsertArg = (prisma.restaurantSettings.upsert as jest.Mock).mock.calls[0][0];
    expect(upsertArg.update).not.toHaveProperty('mpesaPasskey');
  });
});

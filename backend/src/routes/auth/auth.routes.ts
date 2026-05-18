import { Router } from 'express';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler, AppError, NotFoundError, hashPassword, generateSlug, comparePassword } from '@/utils';
import { authenticate, authLimiter, validate } from '@/middleware';
import { registerSchema, loginSchema, verifyOtpSchema, staffLoginSchema } from '@/utils/validation';
import { prisma } from '@/config/database';
import { redis } from '@/config/redis';
import logger from '@/utils/logger';

const router = Router();

async function generateUniqueSlug(baseName: string): Promise<string> {
  let slug = generateSlug(baseName);
  let existing = await prisma.restaurant.findUnique({ where: { slug } });
  let counter = 1;
  while (existing) {
    slug = `${generateSlug(baseName)}-${counter}`;
    existing = await prisma.restaurant.findUnique({ where: { slug } });
    counter++;
  }
  return slug;
}

function generateTokens(userId: string, role: string, restaurantId?: string): { accessToken: string; refreshToken: string; expiresAt: Date } {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!accessSecret || !refreshSecret) {
    throw new AppError(500, 'JWT_CONFIG_ERROR', 'JWT secrets not configured', 'Siri za JWT hazijasanidiwa');
  }

  const accessToken = jwt.sign(
    { userId, role, type: 'access', restaurantId: restaurantId || null },
    accessSecret,
    { expiresIn: '15m' }
  );

  const refreshToken = jwt.sign(
    { userId, role, type: 'refresh', restaurantId: restaurantId || null },
    refreshSecret,
    { expiresIn: '30d' }
  );

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  return { accessToken, refreshToken, expiresAt };
}

const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60;

async function storeRefreshToken(userId: string, token: string): Promise<void> {
  const decoded = jwt.decode(token) as any;
  const tokenId = decoded?.tokenId || uuidv4();
  await redis.setex(`refresh_token:${userId}:${tokenId}`, REFRESH_TOKEN_EXPIRY, token);
}

// POST /register - Create owner account and restaurant
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const { name, email, phone, password, restaurantName } = req.body;

    const existing = await prisma.owner.findFirst({
      where: { OR: [{ email }, { phone }] },
    });
    if (existing) {
      throw new AppError(409, 'ACCOUNT_EXISTS', 'An account with this email or phone already exists', 'Akaunti yenye barua pepe au nambari hii ya simu tayari ipo');
    }

    const passwordHash = await hashPassword(password);
    const slug = await generateUniqueSlug(restaurantName);

    const { owner, restaurant } = await prisma.$transaction(async (tx) => {
      let plan = await tx.subscriptionPlan.findFirst({ where: { isActive: true } });
      if (!plan) {
        plan = await tx.subscriptionPlan.create({
          data: {
            name: 'Free Trial',
            priceMonthlyKes: 0,
            priceYearlyKes: 0,
            hasOrdering: true,
            hasAnalytics: true,
            maxMenuItems: 50,
            maxTables: 20,
            isActive: true,
          },
        });
      }

      const owner = await tx.owner.create({
        data: { fullName: name, email, phone, passwordHash },
      });

      const restaurant = await tx.restaurant.create({
        data: {
          ownerId: owner.id,
          name: restaurantName,
          slug,
          description: '',
          address: '',
          phone,
          planId: plan.id,
        },
      });

      await tx.restaurantSettings.create({
        data: { restaurantId: restaurant.id },
      });

      const days = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
      await tx.openingHour.createMany({
        data: days.map((day) => ({
          restaurantId: restaurant.id,
          dayOfWeek: day,
          openTime: '08:00',
          closeTime: '22:00',
          isClosed: day === 'SUN',
        })),
      });

      return { owner, restaurant };
    });

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await redis.setex(`otp:${owner.id}`, 600, otp);

    try {
      logger.info('OTP generated for registration', { userId: owner.id, otp });
    } catch (err) {
      logger.warn('Failed to send OTP during registration', { error: err });
    }

    const tokens = generateTokens(owner.id, 'owner', restaurant.id);
    await storeRefreshToken(owner.id, tokens.refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: owner.id,
          fullName: owner.fullName,
          email: owner.email,
          phone: owner.phone,
          isVerified: owner.isVerified,
          role: 'owner',
          restaurantId: restaurant.id,
        },
        tokens,
      },
    });
  })
);

// POST /google - Login/Register with Google
router.post(
  '/google',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { credential } = req.body;
    if (!credential) {
      throw new AppError(400, 'GOOGLE_CREDENTIAL_REQUIRED', 'Google credential is required', 'Kitambulisho cha Google kinahitajika');
    }

    // Decode Google credential (JWT) to get user info
    let payload: any;
    try {
      payload = jwt.decode(credential);
    } catch {
      throw new AppError(400, 'INVALID_GOOGLE_CREDENTIAL', 'Invalid Google credential', 'Kitambulisho batili cha Google');
    }

    const { email, name, sub: googleId } = payload;
    if (!email) throw new AppError(400, 'EMAIL_REQUIRED', 'Email is required from Google', 'Barua pepe inahitajika kutoka Google');

    // Find or create owner
    let owner = await prisma.owner.findUnique({ where: { email } });
    if (!owner) {
      const passwordHash = await hashPassword(crypto.randomBytes(16).toString('hex'));
      owner = await prisma.owner.create({
        data: { fullName: name || email.split('@')[0], email, phone: '', passwordHash, isVerified: true, onboardingCompleted: false },
      });
    }

    // Find or create restaurant
    let restaurant = await prisma.restaurant.findFirst({ where: { ownerId: owner.id } });
    if (!restaurant) {
      let plan = await prisma.subscriptionPlan.findFirst({ where: { isActive: true }, orderBy: { priceMonthlyKes: 'asc' } });
      if (!plan) {
        plan = await prisma.subscriptionPlan.create({
          data: { name: 'Free Trial', priceMonthlyKes: 0, priceYearlyKes: 0, hasOrdering: true, hasAnalytics: true, maxMenuItems: 50, maxTables: 20, isActive: true },
        });
      }
      const slug = generateSlug(name || email.split('@')[0]) + '-' + Date.now().toString(36);
      restaurant = await prisma.restaurant.create({
        data: { ownerId: owner.id, name: name || 'My Restaurant', slug, address: '', phone: '', planId: plan.id, subscriptionStatus: 'TRIAL', trialEndsAt: new Date(Date.now() + 14 * 86400000), description: '' },
      });
      await prisma.restaurantSettings.create({ data: { restaurantId: restaurant.id } });
    }
    if (!restaurant) throw new AppError(500, 'RESTAURANT_NOT_FOUND', 'No restaurant found', 'Hakuna mgahawa uliopatikana');

    const tokens = generateTokens(owner.id, 'owner', restaurant.id);
    await storeRefreshToken(owner.id, tokens.refreshToken);

    res.json({
      success: true,
      data: {
        user: { id: owner.id, fullName: owner.fullName, email: owner.email, phone: owner.phone, isVerified: owner.isVerified, role: 'owner', restaurantId: restaurant.id, restaurantName: restaurant.name, restaurantSlug: restaurant.slug },
        tokens,
      },
    });
  })
);

// POST /verify-otp - Verify phone number
router.post(
  '/verify-otp',
  authLimiter,
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const { phone, otp } = req.body;

    const owner = await prisma.owner.findUnique({ where: { phone } });
    if (!owner) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found with this phone number', 'Mtumiaji hajapatikana kwa nambari hii ya simu');
    }

    const storedOtp = await redis.get(`otp:${owner.id}`);
    if (!storedOtp) {
      throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Request a new one.', 'OTP imeisha muda. Omba mpya.');
    }

    if (storedOtp !== otp) {
      throw new AppError(400, 'INVALID_OTP', 'Invalid OTP code', 'Nambari ya OTP si sahihi');
    }

    await prisma.owner.update({
      where: { id: owner.id },
      data: { isVerified: true },
    });

    await redis.del(`otp:${owner.id}`);

    logger.info('User verified successfully', { userId: owner.id });

    res.json({
      success: true,
      data: { message: 'Phone verified successfully', messageSwahili: 'Nambari ya simu imethibitishwa kwa mafanikio' },
    });
  })
);

// POST /resend-otp - Resend OTP verification code
router.post(
  '/resend-otp',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { userId } = req.body;
    if (!userId) throw new AppError(400, 'USER_ID_REQUIRED', 'User ID is required', 'Kitambulisho cha mtumiaji kinahitajika');

    const owner = await prisma.owner.findUnique({ where: { id: userId } });
    if (!owner) throw new NotFoundError('Owner not found', 'Mmiliki hakupatikana');

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await prisma.owner.update({ where: { id: userId }, data: { otpCode: otp, otpExpiresAt } });

    try {
      logger.info('OTP resent', { userId, otp });
    } catch { /* SMS may fail silently */ }

    res.json({ success: true, data: { message: 'OTP resent successfully', messageSwahili: 'OTP imetumwa tena kwa mafanikio' } });
  })
);

// POST /login - Login with email/phone + password
router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, phone, password } = req.body;

    const identifier = email || phone;
    if (!identifier) {
      throw new AppError(400, 'MISSING_CREDENTIALS', 'Email or phone is required', 'Barua pepe au nambari ya simu inahitajika');
    }

    const loginAttemptsKey = `login_attempts:${identifier}`;
    const attempts = await redis.incr(loginAttemptsKey);
    if (attempts === 1) {
      await redis.expire(loginAttemptsKey, 900);
    }
    if (attempts > 5) {
      const ttl = await redis.ttl(loginAttemptsKey);
      throw new AppError(429, 'ACCOUNT_LOCKED', `Too many login attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`, 'Majaribio mengi ya kuingia. Jaribu tena baada ya dakika chache.');
    }

    const owner = await prisma.owner.findFirst({
      where: email ? { email } : { phone },
    });
    if (!owner) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password', 'Barua pepe/simu au neno la siri si sahihi');
    }

    const isValid = await comparePassword(password, owner.passwordHash);
    if (!isValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password', 'Barua pepe/simu au neno la siri si sahihi');
    }

    await redis.del(loginAttemptsKey);

    const restaurant = await prisma.restaurant.findFirst({
      where: { ownerId: owner.id, isActive: true },
    });

    if (!restaurant) {
      throw new AppError(403, 'NO_ACTIVE_RESTAURANT', 'No active restaurant found for this account', 'Hakuna mgahawa unaotumika kwa akaunti hii');
    }

    if (restaurant.isSuspended) {
      throw new AppError(403, 'RESTAURANT_SUSPENDED', 'Your restaurant account has been suspended. Contact support.', 'Akaunti yako ya mgahawa imesimamishwa. Wasiliana na msaada.');
    }

    const tokens = generateTokens(owner.id, 'owner', restaurant.id);
    await storeRefreshToken(owner.id, tokens.refreshToken);

    res.json({
      success: true,
      data: {
        user: {
          id: owner.id,
          fullName: owner.fullName,
          email: owner.email,
          phone: owner.phone,
          isVerified: owner.isVerified,
          role: 'owner',
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          restaurantSlug: restaurant.slug,
        },
        tokens,
      },
    });
  })
);

// POST /refresh-token - Refresh access token
router.post(
  '/refresh-token',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      throw new AppError(400, 'REFRESH_TOKEN_REQUIRED', 'Refresh token is required', 'Refresh token inahitajika');
    }

    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!refreshSecret) {
      throw new AppError(500, 'JWT_CONFIG_ERROR', 'JWT secrets not configured', 'Siri za JWT hazijasanidiwa');
    }

    let decoded: any;
    try {
      decoded = jwt.verify(refreshToken, refreshSecret);
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError(401, 'REFRESH_TOKEN_EXPIRED', 'Refresh token expired. Please login again.', 'Token imeisha muda. Tafadhali ingia tena.');
      }
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Invalid refresh token', 'Token batili');
    }

    if (decoded.type !== 'refresh') {
      throw new AppError(401, 'INVALID_TOKEN_TYPE', 'Invalid token type', 'Aina batili ya token');
    }

    const decodedPayload = jwt.decode(refreshToken) as any;
    const oldTokenId = decodedPayload?.tokenId;
    if (oldTokenId) {
      await redis.del(`refresh_token:${decoded.userId}:${oldTokenId}`);
    }

    const tokens = generateTokens(decoded.userId, decoded.role, decoded.restaurantId || undefined);
    await storeRefreshToken(decoded.userId, tokens.refreshToken);

    res.json({
      success: true,
      data: { tokens },
    });
  })
);

// POST /forgot-password - Send OTP for password reset
router.post(
  '/forgot-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone } = req.body;
    if (!phone) {
      throw new AppError(400, 'PHONE_REQUIRED', 'Phone number is required', 'Nambari ya simu inahitajika');
    }

    const owner = await prisma.owner.findUnique({ where: { phone } });
    if (!owner) {
      throw new AppError(404, 'USER_NOT_FOUND', 'No account found with this phone number', 'Hakuna akaunti iliyopatikana kwa nambari hii ya simu');
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    await redis.setex(`reset_otp:${phone}`, 600, otp);

    try {
      logger.info('Password reset OTP generated', { phone });
    } catch (err) {
      logger.error('Failed to send OTP for password reset', { phone });
      throw new AppError(502, 'OTP_SEND_FAILED', 'Failed to send OTP. Please try again.', 'Imeshindwa kutuma OTP. Tafadhali jaribu tena.');
    }

    res.json({
      success: true,
      data: { message: 'OTP sent successfully', messageSwahili: 'OTP imetumwa kwa mafanikio' },
    });
  })
);

// POST /reset-password - Reset password with OTP
router.post(
  '/reset-password',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { phone, otp, newPassword } = req.body;
    if (!phone || !otp || !newPassword) {
      throw new AppError(400, 'MISSING_FIELDS', 'Phone, OTP, and new password are required', 'Simu, OTP, na neno la siri mpya zinahitajika');
    }

    if (newPassword.length < 8) {
      throw new AppError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters', 'Neno la siri lazima liwe na angalau herufi 8');
    }

    const storedOtp = await redis.get(`reset_otp:${phone}`);
    if (!storedOtp) {
      throw new AppError(400, 'OTP_EXPIRED', 'OTP has expired. Request a new one.', 'OTP imeisha muda. Omba mpya.');
    }

    if (storedOtp !== otp) {
      throw new AppError(400, 'INVALID_OTP', 'Invalid OTP code', 'Nambari ya OTP si sahihi');
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.owner.update({
      where: { phone },
      data: { passwordHash },
    });

    await redis.del(`reset_otp:${phone}`);

    logger.info('Password reset successful', { phone });

    res.json({
      success: true,
      data: { message: 'Password reset successfully', messageSwahili: 'Neno la siri limewekwa upya kwa mafanikio' },
    });
  })
);

// POST /staff/login - Staff PIN login
router.post(
  '/staff/login',
  authLimiter,
  validate(staffLoginSchema),
  asyncHandler(async (req, res) => {
    const { pin, restaurantSlug } = req.body;

    const restaurant = await prisma.restaurant.findUnique({
      where: { slug: restaurantSlug, isActive: true },
    });
    if (!restaurant) {
      throw new AppError(404, 'RESTAURANT_NOT_FOUND', 'Restaurant not found', 'Mgahawa haukupatikana');
    }

    if (restaurant.isSuspended) {
      throw new AppError(403, 'RESTAURANT_SUSPENDED', 'This restaurant account is suspended', 'Akaunti ya mgahawa huu imesimamishwa');
    }

    const staff = await prisma.staff.findFirst({
      where: { restaurantId: restaurant.id, isActive: true },
    });

    if (!staff) {
      throw new AppError(401, 'INVALID_STAFF_PIN', 'Invalid restaurant or PIN', 'Mgahawa au PIN si sahihi');
    }

    const isValidPin = await comparePassword(pin, staff.pinHash);
    if (!isValidPin) {
      throw new AppError(401, 'INVALID_STAFF_PIN', 'Invalid restaurant or PIN', 'Mgahawa au PIN si sahihi');
    }

    await prisma.staff.update({
      where: { id: staff.id },
      data: { lastLogin: new Date() },
    });

    const roleMap: Record<string, string> = {
      WAITER: 'waiter',
      CASHIER: 'cashier',
      KITCHEN: 'kitchen',
      MANAGER: 'manager',
      OWNER: 'owner',
    };

    const tokens = generateTokens(staff.id, roleMap[staff.role] || 'staff', restaurant.id);
    await storeRefreshToken(staff.id, tokens.refreshToken);

    res.json({
      success: true,
      data: {
        staff: {
          id: staff.id,
          fullName: staff.fullName,
          role: roleMap[staff.role] || 'staff',
          restaurantId: restaurant.id,
        },
        tokens,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name,
          slug: restaurant.slug,
        },
      },
    });
  })
);

// DELETE /logout - Invalidate tokens
router.delete(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const userId = req.user!.userId;

    if (refreshToken) {
      const decoded = jwt.decode(refreshToken) as any;
      if (decoded?.tokenId) {
        await redis.del(`refresh_token:${userId}:${decoded.tokenId}`);
      }
    }

    const keys = await redis.keys(`refresh_token:${userId}:*`);
    if (keys.length) {
      await redis.del(...keys);
    }

    logger.info('User logged out', { userId });

    res.json({
      success: true,
      data: { message: 'Logged out successfully', messageSwahili: 'Umetoka kwa mafanikio' },
    });
  })
);

export default router;

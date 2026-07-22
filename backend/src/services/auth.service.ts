import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import Redis from 'ioredis';
import { hashPassword, comparePassword } from '../utils/encryption';
import { AppError } from '../utils/errors';
import logger from '../utils/logger';
import { sendOTP } from '../integrations/africasTalking';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
});

const ACCESS_TOKEN_EXPIRY = '7d';
const REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60;
const OTP_EXPIRY = 600;
const OTP_LENGTH = 6;
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_LOCKOUT_MINUTES = 15;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface RegisterData {
  email: string;
  phone: string;
  password: string;
  name: string;
  restaurantName?: string;
}

interface LoginData {
  email?: string;
  phone?: string;
  password: string;
}

interface StaffLoginData {
  restaurantId: string;
  pin: string;
}

interface UserRecord {
  id: string;
  email: string;
  phone: string;
  name: string;
  passwordHash: string;
  isVerified: boolean;
  role: string;
  restaurantId?: string;
}

function generateOTP(): string {
  const digits = '0123456789';
  let otp = '';
  for (let i = 0; i < OTP_LENGTH; i++) {
    otp += digits[Math.floor(Math.random() * 10)];
  }
  return otp;
}

function generateTokens(userId: string, role: string, restaurantId?: string): TokenPair {
  const accessSecret = process.env.JWT_ACCESS_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;

  if (!accessSecret || !refreshSecret) {
    throw new AppError(500, 'JWT_CONFIG_ERROR', 'JWT secrets not configured', 'Siri za JWT hazijasanidiwa');
  }

  const accessToken = jwt.sign(
    { userId, role, type: 'access', restaurantId: restaurantId || null },
    accessSecret,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { userId, role, type: 'refresh', restaurantId: restaurantId || null, tokenId: uuidv4() },
    refreshSecret,
    { expiresIn: '30d' }
  );

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  return { accessToken, refreshToken, expiresAt };
}

async function storeRefreshToken(userId: string, refreshToken: string): Promise<void> {
  try {
    const decoded = jwt.decode(refreshToken) as any;
    const tokenId = decoded?.tokenId || uuidv4();
    const key = `refresh_token:${userId}:${tokenId}`;
    await redis.setex(key, REFRESH_TOKEN_EXPIRY, refreshToken);
  } catch (error) {
    logger.error('Failed to store refresh token', { error });
    throw new AppError(500, 'TOKEN_STORE_ERROR', 'Failed to store refresh token', 'Imeshindwa kuhifadhi token');
  }
}

async function invalidateRefreshToken(userId: string, tokenId?: string): Promise<void> {
  try {
    if (tokenId) {
      await redis.del(`refresh_token:${userId}:${tokenId}`);
    } else {
      const keys = await redis.keys(`refresh_token:${userId}:*`);
      if (keys.length) await redis.del(...keys);
    }
  } catch (error) {
    logger.error('Failed to invalidate refresh token', { error });
  }
}

async function validateRefreshToken(userId: string, refreshToken: string): Promise<boolean> {
  try {
    const decoded = jwt.decode(refreshToken) as any;
    const tokenId = decoded?.tokenId;
    if (!tokenId) return false;

    const stored = await redis.get(`refresh_token:${userId}:${tokenId}`);
    return stored === refreshToken;
  } catch {
    return false;
  }
}

async function checkLoginAttempts(identifier: string): Promise<void> {
  const key = `login_attempts:${identifier}`;
  const attempts = await redis.incr(key);

  if (attempts === 1) {
    await redis.expire(key, LOGIN_LOCKOUT_MINUTES * 60);
  }

  if (attempts > MAX_LOGIN_ATTEMPTS) {
    const ttl = await redis.ttl(key);
    throw new AppError(429, 'ACCOUNT_LOCKED', `Too many login attempts. Try again in ${Math.ceil(ttl / 60)} minutes.`, 'Majaribio mengi ya kuingia. Jaribu tena baada ya dakika chache.');
  }
}

async function resetLoginAttempts(identifier: string): Promise<void> {
  await redis.del(`login_attempts:${identifier}`);
}

function getLoginIdentifier(data: LoginData): string {
  return data.email || data.phone || 'unknown';
}

export async function register(
  data: RegisterData,
  saveUser: (user: RegisterData & { passwordHash: string }) => Promise<UserRecord>
): Promise<{ user: Omit<UserRecord, 'passwordHash'>; tokens: TokenPair; otp: string }> {
  if (!data.email && !data.phone) {
    throw AppError.validation('Email or phone is required', 'Barua pepe au nambari ya simu inahitajika');
  }

  if (!data.password || data.password.length < 8) {
    throw AppError.validation('Password must be at least 8 characters', 'Neno la siri lazima liwe na angalau herufi 8');
  }

  if (data.phone) {
    const cleaned = data.phone.replace(/[^0-9]/g, '');
    if (!cleaned.startsWith('254') && !cleaned.startsWith('0')) {
      throw AppError.validation('Invalid phone number format', 'Fomati batili ya nambari ya simu');
    }
  }

  const otp = generateOTP();
  const passwordHash = await hashPassword(data.password);

  const user = await saveUser({
    ...data,
    passwordHash,
  });

  const tokens = generateTokens(user.id, user.role, user.restaurantId);
  await storeRefreshToken(user.id, tokens.refreshToken);

  try {
    if (user.phone) {
      await sendOTP(user.phone, otp);
      logger.info('OTP sent during registration', { userId: user.id });
    }
  } catch (error) {
    logger.warn('Failed to send OTP during registration, continuing', { error });
  }

  const { passwordHash: _, ...userWithoutPassword } = user;

  return { user: userWithoutPassword, tokens, otp };
}

export async function verifyOTP(
  userId: string,
  otp: string,
  getStoredOTP: (userId: string) => Promise<string | null>,
  markVerified: (userId: string) => Promise<void>
): Promise<void> {
  if (!otp || otp.length !== OTP_LENGTH) {
    throw AppError.validation('Invalid OTP format', 'Fomati batili ya OTP');
  }

  const storedOTP = await getStoredOTP(userId);

  if (!storedOTP) {
    throw new AppError(404, 'OTP_NOT_FOUND', 'OTP not found or expired. Request a new one.', 'OTP haikupatikana au imeisha. Omba mpya.');
  }

  if (storedOTP !== otp) {
    throw AppError.validation('Invalid OTP code', 'Nambari ya OTP si sahihi');
  }

  await markVerified(userId);
  await redis.del(`otp:${userId}`);

  logger.info('User verified successfully', { userId });
}

export async function login(
  data: LoginData,
  findUser: (identifier: string) => Promise<UserRecord | null>
): Promise<{ user: Omit<UserRecord, 'passwordHash'>; tokens: TokenPair }> {
  const identifier = getLoginIdentifier(data);

  if (!data.password) {
    throw AppError.validation('Password is required', 'Neno la siri linahitajika');
  }

  await checkLoginAttempts(identifier);

  const user = await findUser(identifier);
  if (!user) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password', 'Barua pepe/simu au neno la siri si sahihi');
  }

  const isValidPassword = await comparePassword(data.password, user.passwordHash);
  if (!isValidPassword) {
    await checkLoginAttempts(identifier);
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email/phone or password', 'Barua pepe/simu au neno la siri si sahihi');
  }

  await resetLoginAttempts(identifier);

  const tokens = generateTokens(user.id, user.role, user.restaurantId);
  await storeRefreshToken(user.id, tokens.refreshToken);

  const { passwordHash: _, ...userWithoutPassword } = user;

  logger.info('User logged in', { userId: user.id });

  return { user: userWithoutPassword, tokens };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenPair> {
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

  const isValid = await validateRefreshToken(decoded.userId, refreshToken);
  if (!isValid) {
    throw new AppError(401, 'REFRESH_TOKEN_INVALIDATED', 'Refresh token has been invalidated', 'Token imebatilishwa');
  }

  const decodedOld = decoded;
  await invalidateRefreshToken(decodedOld.userId, decodedOld.tokenId);

  const tokens = generateTokens(decodedOld.userId, decodedOld.role, decodedOld.restaurantId);
  await storeRefreshToken(decodedOld.userId, tokens.refreshToken);

  return tokens;
}

export async function forgotPassword(
  phone: string,
  generateAndStoreOTP: (phone: string, otp: string) => Promise<void>
): Promise<{ otp: string }> {
  if (!phone) {
    throw AppError.validation('Phone number is required', 'Nambari ya simu inahitajika');
  }

  const otp = generateOTP();
  await generateAndStoreOTP(phone, otp);

  try {
    await sendOTP(phone, otp);
  } catch (error) {
    logger.error('Failed to send OTP for password reset', { phone: phone.replace(/\d{4}$/, '****') });
    throw new AppError(502, 'OTP_SEND_FAILED', 'Failed to send OTP. Please try again.', 'Imeshindwa kutuma OTP. Tafadhali jaribu tena.');
  }

  return { otp };
}

export async function resetPassword(
  phone: string,
  otp: string,
  newPassword: string,
  verifyOTPAndUpdatePassword: (phone: string, otp: string, newPasswordHash: string) => Promise<void>
): Promise<void> {
  if (!phone || !otp || !newPassword) {
    throw AppError.validation('Phone, OTP, and new password are required', 'Simu, OTP, na neno la siri mpya zinahitajika');
  }

  if (newPassword.length < 8) {
    throw AppError.validation('Password must be at least 8 characters', 'Neno la siri lazima liwe na angalau herufi 8');
  }

  const passwordHash = await hashPassword(newPassword);
  await verifyOTPAndUpdatePassword(phone, otp, passwordHash);

  logger.info('Password reset successful', { phone: phone.replace(/\d{4}$/, '****') });
}

export async function staffLogin(
  data: StaffLoginData,
  findStaff: (restaurantId: string, pin: string) => Promise<{ id: string; role: string; name: string } | null>
): Promise<{ staff: { id: string; role: string; name: string }; tokens: TokenPair }> {
  if (!data.restaurantId || !data.pin) {
    throw AppError.validation('Restaurant ID and PIN are required', 'Kitambulisho cha mgahawa na PIN vinahitajika');
  }

  const staff = await findStaff(data.restaurantId, data.pin);
  if (!staff) {
    throw new AppError(401, 'INVALID_STAFF_PIN', 'Invalid restaurant ID or PIN', 'Kitambulisho cha mgahawa au PIN si sahihi');
  }

  const tokens = generateTokens(staff.id, staff.role, data.restaurantId);
  await storeRefreshToken(staff.id, tokens.refreshToken);

  return { staff, tokens };
}

export async function logout(
  userId: string,
  refreshToken?: string
): Promise<void> {
  try {
    if (refreshToken) {
      const decoded = jwt.decode(refreshToken) as any;
      await invalidateRefreshToken(userId, decoded?.tokenId);
    } else {
      await invalidateRefreshToken(userId);
    }

    logger.info('User logged out', { userId });
  } catch (error) {
    logger.error('Logout error', { error, userId });
  }
}

export async function generateStaffPIN(
  restaurantId: string,
  savePIN: (restaurantId: string, pin: string, hashedPin: string) => Promise<void>
): Promise<{ pin: string }> {
  const pin = String(Math.floor(100000 + Math.random() * 900000));

  const salt = await (await import('bcryptjs')).genSalt(10);
  const hashedPin = await (await import('bcryptjs')).hash(pin, salt);

  await savePIN(restaurantId, pin, hashedPin);

  return { pin };
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  getUserPasswordHash: (userId: string) => Promise<string>,
  updatePassword: (userId: string, newHash: string) => Promise<void>
): Promise<void> {
  if (!currentPassword || !newPassword) {
    throw AppError.validation('Current and new passwords are required', 'Neno la siri la sasa na jipya vinahitajika');
  }

  if (newPassword.length < 8) {
    throw AppError.validation('New password must be at least 8 characters', 'Neno la siri jipya lazima liwe na angalau herufi 8');
  }

  const currentHash = await getUserPasswordHash(userId);
  const isValid = await comparePassword(currentPassword, currentHash);
  if (!isValid) {
    throw new AppError(401, 'INVALID_PASSWORD', 'Current password is incorrect', 'Neno la siri la sasa si sahihi');
  }

  const newHash = await hashPassword(newPassword);
  await updatePassword(userId, newHash);

  await invalidateRefreshToken(userId);

  logger.info('Password changed', { userId });
}

export default {
  register,
  verifyOTP,
  login,
  refreshAccessToken,
  forgotPassword,
  resetPassword,
  staffLogin,
  logout,
  generateStaffPIN,
  changePassword,
};

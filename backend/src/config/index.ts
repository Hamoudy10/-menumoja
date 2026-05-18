import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface Config {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  redisUrl: string;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  encryptionKey: string;
  frontendUrl: string;
  apiUrl: string;
  adminEmail: string;
  cloudinaryCloudName: string;
  cloudinaryApiKey: string;
  cloudinaryApiSecret: string;
  openaiApiKey: string;
  deepseekApiKey: string;
  aiProvider: 'openai' | 'deepseek';
  deepseekModel: string;
  mpesaConsumerKey: string;
  mpesaConsumerSecret: string;
  mpesaPasskey: string;
  mpesaShortcode: string;
  mpesaCallbackUrl: string;
  atApiKey: string;
  atUsername: string;
  atUssdCode: string;
  atSenderId: string;
  metaAppId: string;
  metaAppSecret: string;
  whatsappToken: string;
  whatsappPhoneNumberId: string;
  googleMapsApiKey: string;
  resendApiKey: string;
  sentryDsn: string;
}

function loadConfig(): Config {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const isProd = nodeEnv === 'production';

  const jwtAccessSecret = process.env.JWT_ACCESS_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (isProd) {
    const required: Record<string, string | undefined> = {
      DATABASE_URL: process.env.DATABASE_URL,
      JWT_ACCESS_SECRET: jwtAccessSecret,
      JWT_REFRESH_SECRET: jwtRefreshSecret,
      ENCRYPTION_KEY: encryptionKey,
    };

    const missing = Object.entries(required)
      .filter(([, v]) => !v)
      .map(([k]) => k);

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables in production: ${missing.join(', ')}`);
    }

    if (!process.env.OPENAI_API_KEY && !process.env.DEEPSEEK_API_KEY) {
      throw new Error('Missing required environment variable: OPENAI_API_KEY or DEEPSEEK_API_KEY');
    }
  }

  const cfg: Config = {
    nodeEnv,
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/menumoja',
    redisUrl: process.env.REDIS_URL || '',
    jwtAccessSecret: jwtAccessSecret || '',
    jwtRefreshSecret: jwtRefreshSecret || '',
    encryptionKey: encryptionKey || '',
    frontendUrl: process.env.FRONTEND_URL || '',
    apiUrl: process.env.API_URL || '',
    adminEmail: process.env.ADMIN_EMAIL || '',
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
    cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    deepseekApiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || '',
    aiProvider: (process.env.AI_PROVIDER === 'deepseek' || !!process.env.DEEPSEEK_API_KEY) ? 'deepseek' : 'openai',
    deepseekModel: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
    mpesaConsumerKey: process.env.MPESA_CONSUMER_KEY || '',
    mpesaConsumerSecret: process.env.MPESA_CONSUMER_SECRET || '',
    mpesaPasskey: process.env.MPESA_PASSKEY || '',
    mpesaShortcode: process.env.MPESA_SHORTCODE || '174379',
    mpesaCallbackUrl: process.env.MPESA_CALLBACK_URL || '',
    atApiKey: process.env.AT_API_KEY || '',
    atUsername: process.env.AT_USERNAME || 'sandbox',
    atUssdCode: process.env.AT_USSD_CODE || '*384*001#',
    atSenderId: process.env.AT_SENDER_ID || 'MenuMoja',
    metaAppId: process.env.META_APP_ID || '',
    metaAppSecret: process.env.META_APP_SECRET || '',
    whatsappToken: process.env.WHATSAPP_TOKEN || '',
    whatsappPhoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    sentryDsn: process.env.SENTRY_DSN || '',
  };

  return cfg;
}

export const config = loadConfig();

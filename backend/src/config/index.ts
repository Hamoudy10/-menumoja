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
  const cfg: Config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),
    databaseUrl: process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/menumoja',
    redisUrl: process.env.REDIS_URL || '',
    jwtAccessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret-not-for-production',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-not-for-production',
    encryptionKey: process.env.ENCRYPTION_KEY || 'dev-encryption-key-32chars!!!!!',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
    apiUrl: process.env.API_URL || 'http://localhost:3001',
    adminEmail: process.env.ADMIN_EMAIL || 'admin@menumoja.co.ke',
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

  if (cfg.nodeEnv === 'production') {
    const required: (keyof Config)[] = [
      'databaseUrl',
      'jwtAccessSecret',
      'jwtRefreshSecret',
      'encryptionKey',
    ];

    for (const key of required) {
      if (!cfg[key]) {
        throw new Error(`Missing required environment variable: ${key}`);
      }
    }

    if (!cfg.openaiApiKey && !cfg.deepseekApiKey) {
      throw new Error('Missing required environment variable: OPENAI_API_KEY or DEEPSEEK_API_KEY');
    }
  }

  return cfg;
}

export const config = loadConfig();

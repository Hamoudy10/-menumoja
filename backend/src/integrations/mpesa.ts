import axios, { AxiosInstance, AxiosError } from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryStrategy: (times) => Math.min(times * 100, 3000),
  lazyConnect: true,
});

const MPESA_API_URL = process.env.NODE_ENV === 'production'
  ? 'https://api.safaricom.co.ke'
  : 'https://sandbox.safaricom.co.ke';

const TOKEN_CACHE_KEY = 'mpesa:access_token';
const TOKEN_EXPIRY_BUFFER = 60;
const IDEMPOTENCY_PREFIX = 'mpesa:idempotency:';

function createApiClient(): AxiosInstance {
  const client = axios.create({
    baseURL: MPESA_API_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
  });

  client.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.code === 'ECONNABORTED') {
        logger.error('M-Pesa request timed out', { url: error.config?.url });
        throw new AppError(504, 'MPESA_TIMEOUT', 'M-Pesa request timed out', 'Muda wa M-Pesa umeisha');
      }
      if (!error.response) {
        logger.error('M-Pesa network error', { message: error.message });
        throw new AppError(502, 'MPESA_NETWORK_ERROR', 'M-Pesa network unavailable', 'Mtandao wa M-Pesa haupatikani');
      }
      logger.error('M-Pesa API error', {
        status: error.response.status,
        data: error.response.data,
      });
      throw error;
    }
  );

  return client;
}

const api = createApiClient();

export function generateTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

export function generatePassword(shortcode: string, passkey: string, timestamp: string): string {
  const str = shortcode + passkey + timestamp;
  return crypto.createHash('sha256').update(str).digest('base64');
}

function validateKenyanPhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');

  if (cleaned.startsWith('0')) {
    const prefix = cleaned.substring(0, 3);
    if (!/^07[0-9]|^01[0-9]/.test(prefix)) {
      throw AppError.validation('Phone must be a Safaricom number (07XX or 01XX)', 'Nambari ya simu lazima iwe ya Safaricom (07XX au 01XX)');
    }
    return '254' + cleaned.substring(1);
  }

  if (cleaned.startsWith('254')) {
    const prefix = cleaned.substring(0, 5);
    if (!/^2547[0-9]|^2541[0-9]/.test(prefix)) {
      throw AppError.validation('Phone must be a Safaricom number (2547XX or 2541XX)', 'Nambari ya simu lazima iwe ya Safaricom (2547XX au 2541XX)');
    }
    return cleaned;
  }

  if (cleaned.startsWith('+')) {
    return validateKenyanPhone(cleaned.substring(1));
  }

  throw AppError.validation('Phone must be a valid Kenyan number', 'Nambari ya simu lazima iwe halali ya Kenya');
}

export async function getAccessToken(): Promise<string> {
  try {
    const cached = await redis.get(TOKEN_CACHE_KEY);
    if (cached) return cached;

    const consumerKey = process.env.MPESA_CONSUMER_KEY;
    const consumerSecret = process.env.MPESA_CONSUMER_SECRET;

    if (!consumerKey || !consumerSecret) {
      throw new AppError(500, 'MPESA_CONFIG_ERROR', 'M-Pesa credentials not configured', 'Vitambulisho vya M-Pesa havijasanidiwa');
    }

    const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');

    const response = await api.post('/oauth/v1/generate?grant_type=client_credentials', null, {
      headers: { Authorization: `Basic ${auth}` },
      timeout: 10000,
    });

    const { access_token, expires_in } = response.data;

    if (!access_token) {
      throw new AppError(502, 'MPESA_TOKEN_ERROR', 'Failed to get M-Pesa access token', 'Imeshindwa kupata token ya M-Pesa');
    }

    const ttl = Math.max(expires_in - TOKEN_EXPIRY_BUFFER, 60);
    await redis.setex(TOKEN_CACHE_KEY, ttl, access_token);

    return access_token;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('getAccessToken failed', { error });
    throw new AppError(502, 'MPESA_TOKEN_ERROR', 'Failed to authenticate with M-Pesa', 'Imeshindwa kuthibitishwa na M-Pesa');
  }
}

async function retryableRequest<T>(fn: () => Promise<T>, retries: number = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (error instanceof AppError && error.statusCode < 500) throw error;
      if (attempt < retries) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        logger.warn(`M-Pesa retry attempt ${attempt}/${retries}`, { delay });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

export async function stkPush(
  phone: string,
  amount: number,
  orderNumber: string,
  shortCode?: string
): Promise<{
  checkoutRequestId: string;
  MerchantRequestID: string;
  ResponseDescription: string;
}> {
  return retryableRequest(async () => {
    const formattedPhone = validateKenyanPhone(phone);

    if (amount < 1 || amount > 150000) {
      throw AppError.validation('Amount must be between 1 and 150,000 KES', 'Kiasi lazima kiwe kati ya 1 na 150,000 KES');
    }

    const token = await getAccessToken();
    const timestamp = generateTimestamp();
    const businessShortCode = shortCode || process.env.MPESA_SHORTCODE || '174379';
    const passkey = process.env.MPESA_PASSKEY || '';
    const password = generatePassword(businessShortCode, passkey, timestamp);
    const callbackUrl = process.env.MPESA_CALLBACK_URL || '';

    const payload = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.round(amount),
      PartyA: formattedPhone,
      PartyB: businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: orderNumber.substring(0, 12),
      TransactionDesc: `Payment for Order ${orderNumber}`,
    };

    const response = await api.post('/mpesa/stkpush/v1/processrequest', payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    const { CheckoutRequestID, MerchantRequestID, ResponseDescription, ResponseCode } = response.data;

    if (ResponseCode !== '0') {
      throw new AppError(502, 'MPESA_STK_FAILED', ResponseDescription || 'STK Push failed', 'M-Pesa STK haikufanikiwa');
    }

    await redis.setex(`${IDEMPOTENCY_PREFIX}${CheckoutRequestID}`, 86400, 'pending');

    return {
      checkoutRequestId: CheckoutRequestID,
      MerchantRequestID,
      ResponseDescription,
    };
  });
}

export async function queryStatus(
  checkoutRequestId: string
): Promise<{
  ResultCode: number;
  ResultDesc: string;
  ReceiptNumber?: string;
  Amount?: number;
}> {
  if (!checkoutRequestId) {
    throw AppError.validation('CheckoutRequestID is required', 'CheckoutRequestID inahitajika');
  }

  return retryableRequest(async () => {
    const token = await getAccessToken();
    const timestamp = generateTimestamp();
    const businessShortCode = process.env.MPESA_SHORTCODE || '174379';
    const passkey = process.env.MPESA_PASSKEY || '';
    const password = generatePassword(businessShortCode, passkey, timestamp);

    const payload = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    };

    const response = await api.post('/mpesa/stkpushquery/v1/query', payload, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 10000,
    });

    const { ResultCode, ResultDesc, Result } = response.data;

    let receiptNumber: string | undefined;
    let amount: number | undefined;

    if (Result && Result.ResultParameters && Result.ResultParameters.ResultParameter) {
      for (const param of Result.ResultParameters.ResultParameter) {
        if (param.Key === 'MpesaReceiptNumber') receiptNumber = param.Value;
        if (param.Key === 'Amount') amount = Number(param.Value);
      }
    }

    return {
      ResultCode: parseInt(ResultCode || '1'),
      ResultDesc: ResultDesc || 'Unknown status',
      ReceiptNumber: receiptNumber,
      Amount: amount,
    };
  });
}

export async function checkIdempotency(checkoutRequestId: string): Promise<'pending' | 'completed' | null> {
  try {
    const status = await redis.get(`${IDEMPOTENCY_PREFIX}${checkoutRequestId}`);
    return status as 'pending' | 'completed' | null;
  } catch {
    return null;
  }
}

export async function markIdempotencyComplete(checkoutRequestId: string): Promise<void> {
  try {
    await redis.setex(`${IDEMPOTENCY_PREFIX}${checkoutRequestId}`, 86400, 'completed');
  } catch {
  }
}

export function validateCallback(body: {
  Body?: {
    stkCallback?: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item?: Array<{ Name: string; Value: string | number }>;
      };
    };
  };
}): {
  success: boolean;
  mpesaReceiptNumber?: string;
  amount?: number;
  transactionDate?: string;
  phone?: string;
} {
  if (!body?.Body?.stkCallback) {
    throw new AppError(400, 'INVALID_CALLBACK', 'Invalid M-Pesa callback body', 'Maelezo batili ya M-Pesa');
  }

  const callback = body.Body.stkCallback;
  const resultCode = parseInt(String(callback.ResultCode));

  if (resultCode !== 0) {
    return {
      success: false,
    };
  }

  let mpesaReceiptNumber: string | undefined;
  let amount: number | undefined;
  let transactionDate: string | undefined;
  let phone: string | undefined;

  if (callback.CallbackMetadata?.Item) {
    for (const item of callback.CallbackMetadata.Item) {
      switch (item.Name) {
        case 'MpesaReceiptNumber':
          mpesaReceiptNumber = String(item.Value);
          break;
        case 'Amount':
          amount = Number(item.Value);
          break;
        case 'TransactionDate':
          transactionDate = String(item.Value);
          break;
        case 'PhoneNumber':
          phone = String(item.Value);
          break;
      }
    }
  }

  return {
    success: true,
    mpesaReceiptNumber,
    amount,
    transactionDate,
    phone,
  };
}

export async function simulateC2B(
    phone: string,
    amount: number,
    receiptNumber: string
): Promise<{ ConversationID: string; OriginatorCoversationID: string; ResponseDescription: string }> {
    const formattedPhone = validateKenyanPhone(phone);
    const token = await getAccessToken();
    const shortCode = process.env.MPESA_SHORTCODE || '174379';

    const payload = {
        ShortCode: shortCode,
        CommandID: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        Msisdn: formattedPhone,
        BillRefNumber: receiptNumber,
    };

    const response = await api.post('/mpesa/c2b/v1/simulate', payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
    });

    return {
        ConversationID: response.data.ConversationID,
        OriginatorCoversationID: response.data.OriginatorCoversationID,
        ResponseDescription: response.data.ResponseDescription,
    };
}

export async function initiateB2CPayment(
    phone: string,
    amount: number,
    remarks: string,
    occassion?: string
): Promise<{ ConversationID: string; OriginatorConversationID: string; ResponseDescription: string }> {
    const formattedPhone = validateKenyanPhone(phone);
    const token = await getAccessToken();
    const shortCode = process.env.MPESA_SHORTCODE || '174379';
    const initiatorName = process.env.MPESA_INITIATOR_NAME || 'testapi';
    const securityCredential = process.env.MPESA_SECURITY_CREDENTIAL || '';

    const payload = {
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'BusinessPayment',
        Amount: Math.round(amount),
        PartyA: shortCode,
        PartyB: formattedPhone,
        Remarks: remarks.substring(0, 100),
        QueueTimeOutURL: `${process.env.API_URL || ''}/api/v1/payments/mpesa/timeout`,
        ResultURL: `${process.env.API_URL || ''}/api/v1/payments/mpesa/result`,
        Occassion: (occassion || remarks).substring(0, 100),
    };

    const response = await api.post('/mpesa/b2c/v1/paymentrequest', payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
    });

    return {
        ConversationID: response.data.ConversationID,
        OriginatorConversationID: response.data.OriginatorConversationID,
        ResponseDescription: response.data.ResponseDescription,
    };
}

export async function registerUrl(): Promise<{ OriginatorCoversationID: string; ResponseDescription: string }> {
    const token = await getAccessToken();
    const shortCode = process.env.MPESA_SHORTCODE || '174379';
    const confirmationUrl = `${process.env.API_URL || ''}/api/v1/payments/mpesa/confirmation`;
    const validationUrl = `${process.env.API_URL || ''}/api/v1/payments/mpesa/validation`;

    const payload = {
        ShortCode: shortCode,
        ResponseType: 'Completed',
        ConfirmationURL: confirmationUrl,
        ValidationURL: validationUrl,
    };

    const response = await api.post('/mpesa/c2b/v1/registerurl', payload, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 10000,
    });

    return {
        OriginatorCoversationID: response.data.OriginatorCoversationID,
        ResponseDescription: response.data.ResponseDescription,
    };
}

export default {
    getAccessToken,
    stkPush,
    queryStatus,
    validateCallback,
    checkIdempotency,
    markIdempotencyComplete,
    generatePassword,
    generateTimestamp,
    simulateC2B,
    initiateB2CPayment,
    registerUrl,
};

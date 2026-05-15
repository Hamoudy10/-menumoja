import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

const WHATSAPP_API_BASE = 'https://graph.facebook.com/v21.0';
const MAX_RETRIES = 3;

let apiClient: AxiosInstance | null = null;

function getClient(): AxiosInstance {
  if (apiClient) return apiClient;

  apiClient = axios.create({
    baseURL: WHATSAPP_API_BASE,
    timeout: 10000,
  });

  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNABORTED') {
        throw new AppError(504, 'WA_TIMEOUT', 'WhatsApp API timed out', 'Muda wa WhatsApp API umeisha');
      }
      if (!error.response) {
        throw new AppError(502, 'WA_NETWORK', 'WhatsApp API unavailable', 'WhatsApp API haipatikani');
      }
      const fbError = error.response.data?.error;
      if (fbError) {
        logger.error('WhatsApp API error', { code: fbError.code, message: fbError.message });

        if (fbError.code === 190) {
          throw new AppError(401, 'WA_TOKEN_EXPIRED', 'WhatsApp token expired', 'Token ya WhatsApp imeisha muda');
        }
        if (fbError.code === 100) {
          throw AppError.validation(fbError.message || 'Invalid request', 'Ombi batili');
        }
        if (fbError.code === 4 || fbError.code === 429) {
          throw new AppError(429, 'WA_RATE_LIMIT', 'WhatsApp rate limit exceeded', 'Kikomo cha WhatsApp kimezidiwa');
        }
      }
      throw error;
    }
  );

  return apiClient;
}

function getPhoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) {
    throw new AppError(500, 'WA_CONFIG_ERROR', 'WhatsApp phone number ID not configured', 'Kitambulisho cha namba ya WhatsApp hakijasanidiwa');
  }
  return id;
}

function getToken(): string {
  const token = process.env.WHATSAPP_TOKEN;
  if (!token) {
    throw new AppError(500, 'WA_CONFIG_ERROR', 'WhatsApp token not configured', 'Token ya WhatsApp haijasanidiwa');
  }
  return token;
}

function validatePhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.startsWith('0')) return '254' + cleaned.substring(1);
  if (cleaned.startsWith('+')) return cleaned.substring(1);
  if (cleaned.startsWith('254') && cleaned.length === 12) return cleaned;
  throw AppError.validation('Invalid phone number format', 'Fomati batili ya nambari ya simu');
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error instanceof AppError && error.statusCode !== 429 && error.statusCode !== 502) {
        throw error;
      }
      if (attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 8000);
        logger.warn('WhatsApp retry', { attempt, delay });
        await new Promise((r) => setTimeout(r, delay));
      } else {
        throw error;
      }
    }
  }
  throw new AppError(502, 'WA_RETRY_FAILED', 'WhatsApp request failed after retries', 'Ombi la WhatsApp limeshindwa baada ya majaribio');
}

export async function sendTemplateMessage(
  phone: string,
  templateName: string,
  params: Record<string, string>
): Promise<{ messageId: string }> {
  return withRetry(async () => {
    const client = getClient();
    const to = validatePhone(phone);
    const phoneNumberId = getPhoneNumberId();
    const token = getToken();

    const components: Array<{ type: string; parameters: Array<{ type: string; text?: string }> }> = [
      {
        type: 'body',
        parameters: Object.values(params).map((value) => ({
          type: 'text',
          text: value,
        })),
      },
    ];

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: 'en' },
        components,
      },
    };

    const response = await client.post(`/${phoneNumberId}/messages`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const messageId = response.data?.messages?.[0]?.id || '';
    return { messageId };
  });
}

export async function sendTextMessage(
  phone: string,
  text: string
): Promise<{ messageId: string }> {
  return withRetry(async () => {
    const client = getClient();
    const to = validatePhone(phone);
    const phoneNumberId = getPhoneNumberId();
    const token = getToken();

    const payload = {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text.substring(0, 4096) },
    };

    const response = await client.post(`/${phoneNumberId}/messages`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const messageId = response.data?.messages?.[0]?.id || '';
    if (!messageId) {
      throw new AppError(502, 'WA_SEND_FAILED', 'Failed to send WhatsApp message', 'Imeshindwa kutuma ujumbe wa WhatsApp');
    }

    return { messageId };
  });
}

export async function sendImageMessage(
  phone: string,
  imageUrl: string,
  caption?: string
): Promise<{ messageId: string }> {
  return withRetry(async () => {
    const client = getClient();
    const to = validatePhone(phone);
    const phoneNumberId = getPhoneNumberId();
    const token = getToken();

    const payload: Record<string, any> = {
      messaging_product: 'whatsapp',
      to,
      type: 'image',
      image: {
        link: imageUrl,
      },
    };

    if (caption) payload.image.caption = caption.substring(0, 1024);

    const response = await client.post(`/${phoneNumberId}/messages`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const messageId = response.data?.messages?.[0]?.id || '';
    return { messageId };
  });
}

export interface WhatsAppInteractiveReply {
  type: string;
  title: string;
  description?: string;
  id: string;
}

export async function sendInteractiveMessage(
  phone: string,
  body: string,
  buttons: Array<{ id: string; title: string }>,
  footer?: string
): Promise<{ messageId: string }> {
  return withRetry(async () => {
    const client = getClient();
    const to = validatePhone(phone);
    const phoneNumberId = getPhoneNumberId();
    const token = getToken();

    if (buttons.length > 3) {
      return sendListMessage(phone, body, buttons, footer);
    }

    const payload: Record<string, any> = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body.substring(0, 1024) },
        action: {
          buttons: buttons.map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.substring(0, 20) },
          })),
        },
      },
    };

    if (footer) payload.interactive.footer = { text: footer.substring(0, 60) };

    const response = await client.post(`/${phoneNumberId}/messages`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { messageId: response.data?.messages?.[0]?.id || '' };
  });
}

export async function sendListMessage(
  phone: string,
  body: string,
  options: Array<{ id: string; title: string; description?: string }>,
  footer?: string
): Promise<{ messageId: string }> {
  return withRetry(async () => {
    const client = getClient();
    const to = validatePhone(phone);
    const phoneNumberId = getPhoneNumberId();
    const token = getToken();

    const payload: Record<string, any> = {
      messaging_product: 'whatsapp',
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body.substring(0, 1024) },
        action: {
          button: 'View Options',
          sections: [
            {
              title: 'Options',
              rows: options.slice(0, 10).map((o) => ({
                id: o.id,
                title: o.title.substring(0, 24),
                description: o.description?.substring(0, 72),
              })),
            },
          ],
        },
      },
    };

    if (footer) payload.interactive.footer = { text: footer.substring(0, 60) };

    const response = await client.post(`/${phoneNumberId}/messages`, payload, {
      headers: { Authorization: `Bearer ${token}` },
    });

    return { messageId: response.data?.messages?.[0]?.id || '' };
  });
}

export async function sendOTP(phone: string, otp: string): Promise<{ messageId: string }> {
  const message = `Your MenuMoja verification code is: ${otp}\n\nNambari yako ya uthibitisho ya MenuMoja ni: ${otp}\n\nThis code expires in 10 minutes. Do not share it.`;
  return sendTextMessage(phone, message);
}

export async function sendOrderConfirmation(
  phone: string,
  orderNumber: string,
  items: Array<{ name: string; quantity: number; price: number }>,
  total: number,
  restaurantName: string
): Promise<{ messageId: string }> {
  const itemList = items.map((i) => `${i.quantity}x ${i.name} - KSh ${(i.price * i.quantity).toLocaleString()}`).join('\n');

  const message = [
    `🛵 *Order Confirmed!*`,
    `Order #: ${orderNumber}`,
    `Restaurant: ${restaurantName}`,
    ``,
    `*Items:*`,
    itemList,
    ``,
    `*Total: KSh ${total.toLocaleString()}*`,
    ``,
    `Thank you for ordering with MenuMoja!`,
    `\nAsante kwa kuagiza na MenuMoja!`,
  ].join('\n');

  return sendTextMessage(phone, message);
}

export async function markAsRead(messageId: string): Promise<void> {
  try {
    const client = getClient();
    const phoneNumberId = getPhoneNumberId();
    const token = getToken();

    await client.post(`/${phoneNumberId}/messages`, {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (error) {
    logger.warn('Failed to mark WhatsApp message as read', { messageId });
  }
}

export interface IncomingMessage {
  type: 'text' | 'image' | 'interactive' | 'button' | 'unknown';
  from: string;
  text?: string;
  image?: { id: string; link?: string };
  interactive?: { id: string; title: string };
  messageId?: string;
  timestamp?: string;
}

export function handleIncomingWebhook(body: any): IncomingMessage {
  try {
    const entry = body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const messages = value?.messages;

    if (!messages || !messages.length) {
      return { type: 'unknown', from: '' };
    }

    const msg = messages[0];
    const from = msg.from || '';
    const result: IncomingMessage = {
      type: 'unknown',
      from,
      messageId: msg.id,
      timestamp: msg.timestamp,
    };

    switch (msg.type) {
      case 'text':
        result.type = 'text';
        result.text = msg.text?.body;
        break;
      case 'image':
        result.type = 'image';
        result.image = {
          id: msg.image?.id,
          link: msg.image?.link,
        };
        break;
      case 'interactive':
        if (msg.interactive?.button_reply) {
          result.type = 'interactive';
          result.interactive = {
            id: msg.interactive.button_reply.id,
            title: msg.interactive.button_reply.title,
          };
        } else if (msg.interactive?.list_reply) {
          result.type = 'interactive';
          result.interactive = {
            id: msg.interactive.list_reply.id,
            title: msg.interactive.list_reply.title,
          };
        }
        break;
      case 'button':
        result.type = 'button';
        result.interactive = {
          id: msg.button?.payload,
          title: msg.button?.text,
        };
        break;
    }

    return result;
  } catch (error) {
    logger.error('Failed to parse WhatsApp webhook', { error });
    return { type: 'unknown', from: '' };
  }
}

export function verifyWebhook(mode: string, token: string, challenge: string): string | null {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || 'menumoja_wa_verify_2024';

  if (mode === 'subscribe' && token === verifyToken) {
    logger.info('WhatsApp webhook verified');
    return challenge;
  }

  logger.warn('WhatsApp webhook verification failed', { mode, token: token ? 'provided' : 'missing' });
  return null;
}

export default {
  sendTemplateMessage,
  sendTextMessage,
  sendImageMessage,
  sendInteractiveMessage,
  sendListMessage,
  sendOTP,
  sendOrderConfirmation,
  markAsRead,
  handleIncomingWebhook,
  verifyWebhook,
};

import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

const AT_API_URL = 'https://api.africastalking.com/version1';
const AT_SANDBOX_URL = 'https://api.sandbox.africastalking.com/version1';
const USSD_MAX_LENGTH = 182;

function getBaseUrl(): string {
  return process.env.NODE_ENV === 'production' && process.env.AT_USERNAME !== 'sandbox'
    ? AT_API_URL
    : AT_SANDBOX_URL;
}

let apiClient: AxiosInstance | null = null;

function getApiClient(): AxiosInstance {
  if (apiClient) return apiClient;

  const apiKey = process.env.AT_API_KEY;
  const username = process.env.AT_USERNAME;

  if (!apiKey || !username) {
    throw new AppError(500, 'AT_CONFIG_ERROR', "Africa's Talking credentials not configured", "Vitambulisho vya Africa's Talking havijasanidiwa");
  }

  apiClient = axios.create({
    baseURL: getBaseUrl(),
    timeout: 10000,
    headers: {
      apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
  });

  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNABORTED') {
        logger.error("Africa's Talking timeout", { url: error.config?.url });
        throw new AppError(504, 'AT_TIMEOUT', "Africa's Talking request timed out", "Muda wa Africa's Talking umeisha");
      }
      if (!error.response) {
        logger.error("Africa's Talking network error", { message: error.message });
        throw new AppError(502, 'AT_NETWORK', "Africa's Talking unavailable", "Africa's Talking haipatikani");
      }
      logger.error("Africa's Talking API error", {
        status: error.response.status,
        data: error.response.data,
      });
      throw error;
    }
  );

  return apiClient;
}

function validatePhone(phone: string): string {
  const cleaned = phone.replace(/[^0-9]/g, '');

  if (cleaned.startsWith('0')) {
    return '254' + cleaned.substring(1);
  }

  if (cleaned.startsWith('+')) {
    return cleaned.substring(1);
  }

  if (cleaned.startsWith('254') && cleaned.length === 12) {
    return cleaned;
  }

  if (cleaned.length === 9) {
    return '254' + cleaned;
  }

  throw AppError.validation('Invalid phone number format', 'Fomati batili ya nambari ya simu');
}

function sanitizeMessage(message: string): string {
  return message.trim().substring(0, 1600);
}

export async function sendSMS(
  phone: string,
  message: string
): Promise<{ status: string; messageId: string }> {
  try {
    const client = getApiClient();
    const formattedPhone = validatePhone(phone);
    const senderId = process.env.AT_SENDER_ID || 'MenuMoja';
    const username = process.env.AT_USERNAME || 'sandbox';

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('to', formattedPhone);
    params.append('message', sanitizeMessage(message));
    if (senderId) params.append('from', senderId);

    const response = await client.post('/messaging', params.toString());

    const result = response.data?.SMSMessageData;
    if (!result || result.Message !== 'Sent to 1 recipients') {
      const errMsg = result?.Message || 'Failed to send SMS';
      logger.error('SMS send failed', { result, phone: formattedPhone });
      throw new AppError(502, 'SMS_SEND_FAILED', errMsg, 'Imeshindwa kutuma SMS');
    }

    const recipient = result.Recipients?.[0];
    return {
      status: recipient?.status || 'Sent',
      messageId: recipient?.messageId || '',
    };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('sendSMS failed', { error });
    throw new AppError(502, 'SMS_SEND_FAILED', 'Failed to send SMS', 'Imeshindwa kutuma SMS');
  }
}

export async function sendBulkSMS(
  phones: string[],
  message: string
): Promise<{ results: Array<{ phone: string; status: string; messageId: string }> }> {
  try {
    if (!phones.length) throw AppError.validation('At least one phone required', 'Angalau nambari moja inahitajika');

    const client = getApiClient();
    const formattedPhones = phones.map((p) => validatePhone(p)).join(',');
    const senderId = process.env.AT_SENDER_ID || 'MenuMoja';
    const username = process.env.AT_USERNAME || 'sandbox';

    const params = new URLSearchParams();
    params.append('username', username);
    params.append('to', formattedPhones);
    params.append('message', sanitizeMessage(message));
    if (senderId) params.append('from', senderId);
    params.append('bulkSMSMode', '1');

    const response = await client.post('/messaging', params.toString());
    const result = response.data?.SMSMessageData;

    const results = (result?.Recipients || []).map((r: any) => ({
      phone: r.number,
      status: r.status || 'Unknown',
      messageId: r.messageId || '',
    }));

    return { results };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('sendBulkSMS failed', { error });
    throw new AppError(502, 'BULK_SMS_FAILED', 'Failed to send bulk SMS', 'Imeshindwa kutuma SMS nyingi');
  }
}

export async function sendOTP(phone: string, otp: string): Promise<void> {
  const englishMsg = `Your MenuMoja verification code is: ${otp}. It expires in 10 minutes. Do not share this code.`;
  const swahiliMsg = `Nambari yako ya uthibitisho ya MenuMoja ni: ${otp}. Inaisha kwa dakika 10. Usishiriki nambari hii.`;

  try {
    await sendSMS(phone, `${englishMsg}\n\n${swahiliMsg}`);
    logger.info('OTP sent', { phone: phone.replace(/\d{4}$/, '****') });
  } catch (error) {
    logger.error('Failed to send OTP', { phone: phone.replace(/\d{4}$/, '****') });
    throw error;
  }
}

// USSD state machine
export enum USSDState {
  MAIN_MENU = 'MAIN_MENU',
  CATEGORY_SELECTED = 'CATEGORY_SELECTED',
  ITEM_SELECTED = 'ITEM_SELECTED',
  CONFIRM_ORDER = 'CONFIRM_ORDER',
  PAYMENT = 'PAYMENT',
  ORDER_PLACED = 'ORDER_PLACED',
}

export interface USSDContext {
  state: USSDState;
  restaurantName: string;
  categories?: Array<{ id: string; name: string }>;
  menuItems?: Array<{ id: string; name: string; price: number }>;
  selectedCategoryId?: string;
  selectedItemId?: string;
  selectedItem?: { id: string; name: string; price: number };
  quantity?: number;
  totalAmount?: number;
  orderNumber?: string;
  phone: string;
}

function formatCurrency(amount: number): string {
  return `KSh ${amount.toLocaleString('en-KE')}`;
}

function truncateResponse(text: string): string {
  if (text.length <= USSD_MAX_LENGTH) return text;
  return text.substring(0, USSD_MAX_LENGTH - 3) + '...';
}

function buildMainMenu(context: USSDContext): string {
  return `CON Welcome to ${context.restaurantName}\n1. View Menu\n2. Order Status\n3. Contact Us\n4. About Us\n\n0. Exit`;
}

function buildCategoryMenu(context: USSDContext): string {
  if (!context.categories || context.categories.length === 0) {
    return `END Sorry, no menu available at this time.\n\nTafadhali jaribu tena baadaye.`;
  }

  let response = `CON Select Category:\n`;
  context.categories.forEach((cat, index) => {
    response += `${index + 1}. ${cat.name}\n`;
  });
  response += `\n99. Main Menu\n0. Exit`;
  return truncateResponse(response);
}

function buildItemMenu(context: USSDContext): string {
  if (!context.menuItems || context.menuItems.length === 0) {
    return `END No items in this category.\n\nHamna bidhaa katika kategoria hii.`;
  }

  let response = `CON Select Item:\n`;
  context.menuItems.forEach((item, index) => {
    response += `${index + 1}. ${item.name} - ${formatCurrency(item.price)}\n`;
  });
  response += `\n99. Main Menu\n0. Exit`;
  return truncateResponse(response);
}

function buildConfirmOrder(context: USSDContext): string {
  if (!context.selectedItem) return `END Session expired. Please start again.`;

  const item = context.selectedItem;
  const qty = context.quantity || 1;
  const total = item.price * qty;

  return truncateResponse(
    `CON Confirm Order:\n${item.name} x${qty}\nTotal: ${formatCurrency(total)}\n\n1. Confirm\n2. Change Quantity\n99. Main Menu\n0. Exit`
  );
}

function buildPaymentInfo(context: USSDContext): string {
  const total = context.totalAmount || 0;
  return truncateResponse(
    `CON Choose Payment:\n1. M-Pesa\n2. Airtel Money\n3. Cash on Pickup\n\n99. Main Menu\n0. Cancel`
  );
}

function buildOrderPlaced(context: USSDContext): string {
  const orderNum = context.orderNumber || 'N/A';
  const total = context.totalAmount || 0;
  return truncateResponse(
    `END Order Placed!\nOrder #: ${orderNum}\nTotal: ${formatCurrency(total)}\n\nThank you for ordering from ${context.restaurantName}!\n\nAsante kwa kuagiza!`
  );
}

function buildOrderStatus(context: USSDContext): string {
  return `CON Enter your order number:\n\n99. Main Menu\n0. Exit`;
}

function buildContactInfo(context: USSDContext): string {
  return `END Contact ${context.restaurantName}:\nPhone: Call restaurant\nFor support: help@menumoja.co.ke\n\nAsante!`;
}

function buildAbout(context: USSDContext): string {
  return `END ${context.restaurantName}\nPowered by MenuMoja - Digital Restaurant Platform\nOrder food easily via USSD.\n\nAsante!`;
}

function handleMainMenuInput(input: string, context: USSDContext): string {
  switch (input) {
    case '1':
      context.state = USSDState.CATEGORY_SELECTED;
      return buildCategoryMenu(context);
    case '2':
      return buildOrderStatus(context);
    case '3':
      return buildContactInfo(context);
    case '4':
      return buildAbout(context);
    case '0':
      return `END Thank you for using ${context.restaurantName}. Goodbye!\n\nKwaheri!`;
    default:
      return `CON Invalid option. Please try again.\n\n${buildMainMenu(context)}`;
  }
}

function handleCategorySelectedInput(input: string, context: USSDContext): string {
  if (input === '99') {
    context.state = USSDState.MAIN_MENU;
    context.selectedCategoryId = undefined;
    return buildMainMenu(context);
  }
  if (input === '0') {
    return `END Thank you. Goodbye!\n\nKwaheri!`;
  }

  const index = parseInt(input) - 1;
  if (isNaN(index) || !context.categories || index < 0 || index >= context.categories.length) {
    return `CON Invalid selection. Try again.\n\n${buildCategoryMenu(context)}`;
  }

  context.selectedCategoryId = context.categories[index].id;
  context.state = USSDState.ITEM_SELECTED;
  return buildItemMenu(context);
}

function handleItemSelectedInput(input: string, context: USSDContext): string {
  if (input === '99') {
    context.state = USSDState.MAIN_MENU;
    context.selectedCategoryId = undefined;
    context.selectedItemId = undefined;
    return buildMainMenu(context);
  }
  if (input === '0') {
    return `END Thank you. Goodbye!\n\nKwaheri!`;
  }

  const index = parseInt(input) - 1;
  if (isNaN(index) || !context.menuItems || index < 0 || index >= context.menuItems.length) {
    return `CON Invalid selection. Try again.\n\n${buildItemMenu(context)}`;
  }

  context.selectedItem = context.menuItems[index];
  context.selectedItemId = context.menuItems[index].id;
  context.quantity = 1;
  context.state = USSDState.CONFIRM_ORDER;
  return buildConfirmOrder(context);
}

function handleConfirmOrderInput(input: string, context: USSDContext): string {
  switch (input) {
    case '1': {
      context.totalAmount = (context.selectedItem?.price || 0) * (context.quantity || 1);
      context.state = USSDState.PAYMENT;
      return buildPaymentInfo(context);
    }
    case '2': {
      return `CON Enter quantity:\n\n99. Main Menu\n0. Exit`;
    }
    case '99': {
      context.state = USSDState.MAIN_MENU;
      context.selectedCategoryId = undefined;
      context.selectedItemId = undefined;
      context.selectedItem = undefined;
      context.quantity = undefined;
      return buildMainMenu(context);
    }
    case '0':
      return `END Order cancelled.\n\nAgizo limeghairiwa.`;
    default:
      return `CON Invalid option.\n\n${buildConfirmOrder(context)}`;
  }
}

function handlePaymentInput(input: string, context: USSDContext): string {
  switch (input) {
    case '1': {
      context.orderNumber = `USD${Date.now().toString(36).toUpperCase()}`;
      context.state = USSDState.ORDER_PLACED;
      return buildOrderPlaced(context);
    }
    case '2': {
      context.orderNumber = `USD${Date.now().toString(36).toUpperCase()}`;
      context.state = USSDState.ORDER_PLACED;
      return buildOrderPlaced(context);
    }
    case '3': {
      context.orderNumber = `USD${Date.now().toString(36).toUpperCase()}`;
      context.state = USSDState.ORDER_PLACED;
      return buildOrderPlaced(context);
    }
    case '99': {
      context.state = USSDState.MAIN_MENU;
      context.selectedItem = undefined;
      context.quantity = undefined;
      context.totalAmount = undefined;
      return buildMainMenu(context);
    }
    case '0':
      return `END Order cancelled.\n\nAgizo limeghairiwa.`;
    default:
      return `CON Invalid option.\n\n${buildPaymentInfo(context)}`;
  }
}

function handleQuantityInput(input: string, context: USSDContext): string {
  if (input === '99') {
    context.state = USSDState.MAIN_MENU;
    context.selectedItem = undefined;
    context.selectedItemId = undefined;
    context.selectedCategoryId = undefined;
    context.quantity = undefined;
    return buildMainMenu(context);
  }
  if (input === '0') {
    return `END Order cancelled.\n\nAgizo limeghairiwa.`;
  }

  const qty = parseInt(input);
  if (isNaN(qty) || qty < 1 || qty > 100) {
    return `CON Invalid quantity (1-100). Try again:\n\n99. Main Menu\n0. Exit`;
  }

  context.quantity = qty;
  context.state = USSDState.CONFIRM_ORDER;
  return buildConfirmOrder(context);
}

function handleOrderStatusInput(input: string, context: USSDContext): string {
  if (input === '99') {
    context.state = USSDState.MAIN_MENU;
    return buildMainMenu(context);
  }
  if (input === '0') {
    return `END Thank you. Goodbye!\n\nKwaheri!`;
  }
  return `END For order status, please contact the restaurant directly.\n\nUSSD order tracking coming soon!`;
}

export function handleUSSDWebhook(
  body: { text?: string; phoneNumber?: string; sessionId?: string },
  sessionState?: Partial<USSDContext>
): string {
  const phone = body.phoneNumber || '';
  const text = body.text || '';
  const inputParts = text.split('*');
  const currentInput = inputParts[inputParts.length - 1] || '';

  const context: USSDContext = {
    state: sessionState?.state || USSDState.MAIN_MENU,
    restaurantName: sessionState?.restaurantName || 'MenuMoja',
    categories: sessionState?.categories,
    menuItems: sessionState?.menuItems,
    selectedCategoryId: sessionState?.selectedCategoryId,
    selectedItemId: sessionState?.selectedItemId,
    selectedItem: sessionState?.selectedItem,
    quantity: sessionState?.quantity,
    totalAmount: sessionState?.totalAmount,
    orderNumber: sessionState?.orderNumber,
    phone,
  };

  if (!context.categories) context.categories = [];
  if (!context.menuItems) context.menuItems = [];

  if (text === '' || text === '0') {
    context.state = USSDState.MAIN_MENU;
    return buildMainMenu(context);
  }

  try {
    switch (context.state) {
      case USSDState.MAIN_MENU:
        return handleMainMenuInput(currentInput, context);
      case USSDState.CATEGORY_SELECTED:
        return handleCategorySelectedInput(currentInput, context);
      case USSDState.ITEM_SELECTED:
        return handleItemSelectedInput(currentInput, context);
      case USSDState.CONFIRM_ORDER: {
        if (context.quantity && context.selectedItem && currentInput === '2') {
          return handleQuantityInput(currentInput, context);
        }
        return handleConfirmOrderInput(currentInput, context);
      }
      case USSDState.PAYMENT:
        return handlePaymentInput(currentInput, context);
      case USSDState.ORDER_PLACED:
        return `END Your order #${context.orderNumber || 'N/A'} is being processed.\n\nAsante!`;
      default:
        context.state = USSDState.MAIN_MENU;
        return buildMainMenu(context);
    }
  } catch (error) {
    logger.error('USSD handler error', { error, text, phone });
    return `END An error occurred. Please try again.\n\nHitilafu imetokea. Tafadhali jaribu tena.`;
  }
}

export default {
  sendSMS,
  sendBulkSMS,
  sendOTP,
  handleUSSDWebhook,
  USSDState,
};

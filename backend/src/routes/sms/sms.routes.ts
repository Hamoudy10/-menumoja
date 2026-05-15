import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../utils/helpers';
import * as africasTalking from '../../integrations/africasTalking';
import logger from '../../utils/logger';
import { AppError } from '../../utils/errors';

const router = Router();

function detectLanguage(text: string): 'sw' | 'en' {
  const swahiliWords = ['asante', 'tafadhali', 'samahani', 'karibu', 'kwaheri', 'sawa', 'ndio', 'hapana', 'menyu', 'agiza', 'bei', 'sahihi', 'hali', 'nafasi', 'siku', 'leo', 'kesho', 'chakula', 'kinywaji', 'jumla', 'namba', 'pesa', 'simu', 'mtu', 'taka', 'njoo', 'enda', 'kuja', 'kula'];
  const lower = text.toLowerCase();
  const swahiliCount = swahiliWords.filter((w) => lower.includes(w)).length;
  return swahiliCount >= 2 ? 'sw' : 'en';
}

function getResponseInLanguage(lang: 'sw' | 'en', swahili: string, english: string): string {
  return lang === 'sw' ? swahili : english;
}

router.post('/incoming', asyncHandler(async (req: Request, res: Response) => {
  const { from, text, date, id } = req.body;

  if (!from || !text) {
    logger.warn('SMS webhook missing required fields', { body: req.body });
    return res.status(200).json({ status: 'ok' });
  }

  const lang = detectLanguage(text);
  const cleanedText = text.trim().toUpperCase();

  await prisma.smsLog.create({
    data: {
      phone: from,
      direction: 'INBOUND',
      message: text,
      providerMessageId: id || null,
      status: 'SENT',
      restaurantId: null,
    },
  }).catch((err) => {
    logger.error('Failed to log incoming SMS', { error: err, from });
  });

  let responseMessage: string;

  if (cleanedText === 'MENU' || cleanedText === 'MENYU' || cleanedText === 'MENU' || cleanedText === '1') {
    responseMessage = await handleMenuCommand(from, lang);
  } else if (cleanedText.startsWith('ORDER') || cleanedText.startsWith('AGIZA') || cleanedText.startsWith('2')) {
    responseMessage = await handleOrderCommand(text, from, lang);
  } else if (cleanedText.startsWith('STATUS') || cleanedText.startsWith('HALI') || cleanedText.startsWith('3')) {
    responseMessage = await handleStatusCommand(text, from, lang);
  } else if (cleanedText === 'HELP' || cleanedText === 'SAIDIA' || cleanedText === '0') {
    responseMessage = getHelpMessage(lang);
  } else {
    responseMessage = getHelpMessage(lang);
  }

  try {
    await africasTalking.sendSMS(from, responseMessage);

    await prisma.smsLog.create({
      data: {
        phone: from,
        direction: 'OUTBOUND',
        message: responseMessage.substring(0, 1600),
        status: 'SENT',
        restaurantId: null,
      },
    }).catch((err) => {
      logger.error('Failed to log outbound SMS', { error: err, from });
    });
  } catch (err) {
    logger.error('Failed to send SMS response', { error: err, from, originalText: text });
  }

  res.status(200).json({ status: 'ok' });
}));

async function handleMenuCommand(from: string, lang: 'sw' | 'en'): Promise<string> {
  const restaurant = await findRestaurantByPhone(from);

  if (!restaurant) {
    return getResponseInLanguage(lang,
      'Samahani, nambari yako ya simu haijatambuliwa. Tafadhali tembelea tovuti ya mgahawa au uje ana kwa ana.',
      'Sorry, your phone number is not recognized. Please visit the restaurant website or come in person.'
    );
  }

  const categories = await prisma.menuCategory.findMany({
    where: { restaurantId: restaurant.id, isActive: true },
    select: { id: true, name: true, nameSw: true },
    orderBy: { sortOrder: 'asc' },
    take: 5,
  });

  if (!categories.length) {
    return getResponseInLanguage(lang,
      `Samahani, ${restaurant.name} haina menyu kwa sasa. Tafadhali jaribu tena baadaye.`,
      `Sorry, ${restaurant.name} has no menu available right now. Please try again later.`
    );
  }

  const categoryList = categories.map((c) => `${c.nameSw || c.name}`).join(', ');

  const items = await prisma.menuItem.findMany({
    where: { restaurantId: restaurant.id, isAvailable: true },
    select: { id: true, name: true, nameSw: true, price: true },
    orderBy: { sortOrder: 'asc' },
    take: 10,
  });

  if (!items.length) {
    return getResponseInLanguage(lang,
      `${restaurant.name} - Kategoria: ${categoryList}. Hakuna bidhaa kwa sasa.`,
      `${restaurant.name} - Categories: ${categoryList}. No items available right now.`
    );
  }

  const itemList = items.map((i) => `${i.nameSw || i.name} - KSh ${Number(i.price).toLocaleString()}`).join('\n');

  return getResponseInLanguage(lang,
    `${restaurant.name}\nKategoria: ${categoryList}\n\nBidhaa:\n${itemList}\n\nTuma AGIZA [jina la bidhaa] kuagiza au tuma SAIDIA kwa msaada.`,
    `${restaurant.name}\nCategories: ${categoryList}\n\nItems:\n${itemList}\n\nSend ORDER [item name] to order or send HELP for assistance.`
  );
}

async function handleOrderCommand(text: string, from: string, lang: 'sw' | 'en'): Promise<string> {
  const restaurant = await findRestaurantByPhone(from);

  if (!restaurant) {
    return getResponseInLanguage(lang,
      'Samahani, nambari yako haijatambuliwa. Tafadhali jiandikisha kwenye mgahawa.',
      'Sorry, your number is not recognized. Please register at the restaurant.'
    );
  }

  const parts = text.split(' ');
  const itemQuery = parts.slice(1).join(' ').trim();

  if (!itemQuery) {
    return getResponseInLanguage(lang,
      'Tafadhali tumia: AGIZA [jina la bidhaa]. Mfano: AGIZA chai',
      'Please use: ORDER [item name]. Example: ORDER chai'
    );
  }

  const items = await prisma.menuItem.findMany({
    where: {
      restaurantId: restaurant.id,
      isAvailable: true,
      OR: [
        { name: { contains: itemQuery, mode: 'insensitive' } },
        { nameSw: { contains: itemQuery, mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, nameSw: true, price: true },
    take: 5,
  });

  if (!items.length) {
    return getResponseInLanguage(lang,
      `Samahani, "${itemQuery}" haikupatikana. Tafadhali angalia tahajia au tuma MENYU kuona orodha kamili.`,
      `Sorry, "${itemQuery}" not found. Please check spelling or send MENU to see full list.`
    );
  }

  if (items.length > 1) {
    const list = items.map((i, idx) => `${idx + 1}. ${i.nameSw || i.name} - KSh ${Number(i.price).toLocaleString()}`).join('\n');
    return getResponseInLanguage(lang,
      `Tafadhali chagua:\n${list}\n\nTuma jina kamili la bidhaa.`,
      `Please select:\n${list}\n\nSend the exact item name.`
    );
  }

  const item = items[0];
  const orderNumber = `SMS${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  try {
    await prisma.order.create({
      data: {
        restaurantId: restaurant.id,
        orderNumber,
        sessionId: `sms:${from}:${Date.now()}`,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
        paymentMethod: 'PENDING',
        subtotal: Number(item.price),
        serviceCharge: 0,
        taxAmount: 0,
        tipAmount: 0,
        totalAmount: Number(item.price),
        customerPhone: from,
        items: {
          create: {
            menuItemId: item.id,
            itemName: item.name,
            itemPrice: Number(item.price),
            quantity: 1,
            subtotal: Number(item.price),
          },
        },
      },
    });
  } catch (err) {
    logger.error('Failed to create SMS order', { error: err, from, itemQuery });
    return getResponseInLanguage(lang,
      'Samahani, kuna tatizo la kiufundi. Tafadhali jaribu tena baadaye au piga simu mgahawa moja kwa moja.',
      'Sorry, a technical error occurred. Please try again later or call the restaurant directly.'
    );
  }

  return getResponseInLanguage(lang,
    `Agizo limewekwa!\nBidhaa: ${item.nameSw || item.name}\nBei: KSh ${Number(item.price).toLocaleString()}\nNamba ya Agizo: ${orderNumber}\n\nAsante! Tuma HALI [namba] kuangalia hali ya agizo.`,
    `Order placed!\nItem: ${item.name}\nPrice: KSh ${Number(item.price).toLocaleString()}\nOrder Number: ${orderNumber}\n\nThank you! Send STATUS [number] to check order status.`
  );
}

async function handleStatusCommand(text: string, from: string, lang: 'sw' | 'en'): Promise<string> {
  const parts = text.split(' ');
  const orderNumber = parts.slice(1).join(' ').trim().toUpperCase();

  if (!orderNumber) {
    return getResponseInLanguage(lang,
      'Tafadhali tumia: HALI [namba ya agizo]. Mfano: HALI USD1A2B3C',
      'Please use: STATUS [order number]. Example: STATUS USD1A2B3C'
    );
  }

  const order = await prisma.order.findUnique({
    where: { orderNumber },
    select: { status: true, totalAmount: true, createdAt: true },
  });

  if (!order) {
    return getResponseInLanguage(lang,
      `Agizo #${orderNumber} halikupatikana. Tafadhali angalia namba ya agizo na jaribu tena.`,
      `Order #${orderNumber} not found. Please check the order number and try again.`
    );
  }

  const statusMap: Record<string, { en: string; sw: string }> = {
    PENDING: { en: 'Pending', sw: 'Inasubiri' },
    CONFIRMED: { en: 'Confirmed', sw: 'Imethibitishwa' },
    PREPARING: { en: 'Being Prepared', sw: 'Inatayarishwa' },
    READY: { en: 'Ready for Pickup', sw: 'Iko Tayari' },
    SERVED: { en: 'Served', sw: 'Imehudumiwa' },
    CANCELLED: { en: 'Cancelled', sw: 'Imegairiwa' },
  };

  const statusInfo = statusMap[order.status] || { en: order.status, sw: order.status };
  const statusText = lang === 'sw' ? statusInfo.sw : statusInfo.en;

  return getResponseInLanguage(lang,
    `Agizo #${orderNumber}\nHali: ${statusText}\nJumla: KSh ${Number(order.totalAmount).toLocaleString()}\nTarehe: ${order.createdAt.toISOString().slice(0, 10)}\n\nAsante!`,
    `Order #${orderNumber}\nStatus: ${statusText}\nTotal: KSh ${Number(order.totalAmount).toLocaleString()}\nDate: ${order.createdAt.toISOString().slice(0, 10)}\n\nThank you!`
  );
}

function getHelpMessage(lang: 'sw' | 'en'): string {
  if (lang === 'sw') {
    return `MenuMoja - Amri za SMS:
MENYU - Tazama menyu
AGIZA [jina] - Weka agizo
HALI [namba] - Angalia hali ya agizo
SAIDIA - Ujumbe huu

Tuma ujumbe kwa namba hii kupata huduma.`;
  }

  return `MenuMoja - SMS Commands:
MENU - View menu
ORDER [name] - Place an order
STATUS [number] - Check order status
HELP - This message

Send a message to this number for service.`;
}

async function findRestaurantByPhone(phone: string) {
  const restaurant = await prisma.restaurant.findFirst({
    where: { phone },
    select: { id: true, name: true },
  });

  if (restaurant) return restaurant;

  return prisma.restaurant.findFirst({
    where: { whatsapp: phone },
    select: { id: true, name: true },
  });
}

export default router;

import { Router, Request, Response } from 'express';
import { prisma } from '../../config/database';
import { asyncHandler } from '../../utils/helpers';
import { USSDState } from '../../integrations/africasTalking';
import { redis } from '../../config/redis';
import logger from '../../utils/logger';

const router = Router();

const USSD_SESSION_PREFIX = 'ussd:session:';
const USSD_TTL = 300;
const USSD_MAX_LENGTH = 182;

function truncateResponse(text: string): string {
  if (text.length <= USSD_MAX_LENGTH) return text;
  return text.substring(0, USSD_MAX_LENGTH - 3) + '...';
}

function buildMainMenu(restaurantName: string): string {
  return truncateResponse(`CON Karibu ${restaurantName}\n1. Tazama Menyu\n2. Hali ya Agizo\n3. Wasiliana Nasi\n4. Kuhusu Sisi\n\n0. Toka`);
}

function buildCategoryMenu(categories: Array<{ id: string; name: string; nameSw?: string | null }>): string {
  if (!categories.length) {
    return `END Samahani, hakuna menyu kwa sasa.\n\nTafadhali jaribu tena baadaye.`;
  }
  let response = `CON Chagua Kategoria:\n`;
  categories.forEach((cat, index) => {
    response += `${index + 1}. ${cat.nameSw || cat.name}\n`;
  });
  response += `\n99. Menyu Kuu\n0. Toka`;
  return truncateResponse(response);
}

function buildItemMenu(items: Array<{ id: string; name: string; nameSw?: string | null; price: number }>): string {
  if (!items.length) {
    return `END Hakuna bidhaa katika kategoria hii.\n\nHamna bidhaa katika kategoria hii.`;
  }
  let response = `CON Chagua Bidhaa:\n`;
  items.forEach((item, index) => {
    const itemName = item.nameSw || item.name;
    response += `${index + 1}. ${itemName} - KSh ${item.price.toLocaleString()}\n`;
  });
  response += `\n99. Menyu Kuu\n0. Toka`;
  return truncateResponse(response);
}

interface SessionData {
  state: string;
  restaurantId?: string;
  restaurantName: string;
  selectedCategoryId?: string;
  selectedItemId?: string;
  selectedItem?: { id: string; name: string; price: number };
  quantity: number;
  totalAmount: number;
  orderNumber?: string;
  phone: string;
}

router.post('/handler', asyncHandler(async (req: Request, res: Response) => {
  const { sessionId, phoneNumber, text, serviceCode } = req.body;

  if (!sessionId || !phoneNumber) {
    logger.warn('USSD request missing required fields', { body: req.body });
    return res.json({ response: 'END Invalid request. Tafadhali jaribu tena.' });
  }

  const sessionKey = `${USSD_SESSION_PREFIX}${sessionId}`;
  let session: SessionData | null = null;

  try {
    const sessionRaw = await redis.get(sessionKey);
    if (sessionRaw) {
      session = JSON.parse(sessionRaw) as SessionData;
    }
  } catch (err) {
    logger.warn('Failed to parse USSD session', { sessionId, error: err });
  }

  const inputParts = text ? text.split('*') : [];
  const currentInput = inputParts.length > 0 ? inputParts[inputParts.length - 1] : '';

  if (!session) {
    const ussdSession = await prisma.ussdSession.findUnique({
      where: { sessionId },
      include: { restaurant: { select: { id: true, name: true } } },
    });

    session = {
      state: USSDState.MAIN_MENU,
      restaurantId: ussdSession?.restaurant?.id,
      restaurantName: ussdSession?.restaurant?.name || 'MenuMoja',
      quantity: 1,
      totalAmount: 0,
      phone: phoneNumber,
    };
  }

  const saveSession = async (): Promise<void> => {
    try {
      await redis.setex(sessionKey, USSD_TTL, JSON.stringify(session));
    } catch (err) {
      logger.error('Failed to save USSD session to Redis', { sessionId, error: err });
    }
  };

  let responseText: string;

  try {
    switch (session.state) {
      case USSDState.MAIN_MENU:
        responseText = await handleMainMenu(session, currentInput, saveSession);
        break;
      case USSDState.CATEGORY_SELECTED:
        responseText = await handleCategorySelected(session, currentInput, saveSession);
        break;
      case USSDState.ITEM_SELECTED:
        responseText = await handleItemSelected(session, currentInput, saveSession, sessionId, phoneNumber);
        break;
      case USSDState.CONFIRM_ORDER:
        responseText = await handleConfirmOrder(session, currentInput, saveSession);
        break;
      case USSDState.PAYMENT:
        responseText = await handlePayment(session, currentInput, saveSession, sessionId, phoneNumber);
        break;
      case USSDState.ORDER_PLACED:
        responseText = `END Agizo lako #${session.orderNumber || 'N/A'} linashughulikiwa.\n\nAsante!`;
        break;
      default:
        session.state = USSDState.MAIN_MENU;
        await saveSession();
        responseText = buildMainMenu(session.restaurantName);
    }
  } catch (err) {
    logger.error('USSD handler error', { error: err, sessionId, phoneNumber, text });
    responseText = 'END Hitilafu imetokea. Tafadhali jaribu tena.\n\nSamahani, kuna tatizo. Jaribu tena.';
  }

  res.json({ response: responseText });
}));

async function handleMainMenu(session: SessionData, input: string, save: () => Promise<void>): Promise<string> {
  switch (input) {
    case '1': {
      let categories;
      if (session.restaurantId) {
        categories = await prisma.menuCategory.findMany({
          where: { restaurantId: session.restaurantId, isActive: true },
          select: { id: true, name: true, nameSw: true },
          orderBy: { sortOrder: 'asc' },
        });
      }
      session.state = USSDState.CATEGORY_SELECTED;
      await save();
      if (!categories || !categories.length) {
        return `END Samahani, hakuna kategoria kwa sasa.\n\nTafadhali jaribu tena baadaye.`;
      }
      return buildCategoryMenu(categories);
    }
    case '2':
      return `CON Ingiza nambari ya agizo lako:\n\n99. Menyu Kuu\n0. Toka`;
    case '3':
      return `END Wasiliana ${session.restaurantName}:\nPiga simu mgahawa\nMsaada: help@menumoja.co.ke\n\nAsante!`;
    case '4':
      return `END ${session.restaurantName}\nInaendeshwa na MenuMoja - Jukwaa la Digital Restaurant\n\nAsante!`;
    case '0':
      return `END Asante kwa kutumia ${session.restaurantName}. Kwaheri!\n\nKwaheri!`;
    case '99':
      session.state = USSDState.MAIN_MENU;
      await save();
      return buildMainMenu(session.restaurantName);
    default:
      return `CON Chaguo batili. Tafadhali jaribu tena.\n\n${buildMainMenu(session.restaurantName)}`;
  }
}

async function handleCategorySelected(session: SessionData, input: string, save: () => Promise<void>): Promise<string> {
  if (input === '99') {
    session.state = USSDState.MAIN_MENU;
    session.selectedCategoryId = undefined;
    await save();
    return buildMainMenu(session.restaurantName);
  }
  if (input === '0') {
    return `END Asante. Kwaheri!\n\nKwaheri!`;
  }

  const categories = session.restaurantId
    ? await prisma.menuCategory.findMany({
        where: { restaurantId: session.restaurantId, isActive: true },
        select: { id: true, name: true, nameSw: true },
        orderBy: { sortOrder: 'asc' },
      })
    : [];

  const index = parseInt(input) - 1;
  if (isNaN(index) || !categories[index]) {
    return `CON Chaguo batili. Jaribu tena.\n\n${buildCategoryMenu(categories)}`;
  }

  session.selectedCategoryId = categories[index].id;
  session.state = USSDState.ITEM_SELECTED;
  await save();

  const items = await prisma.menuItem.findMany({
    where: { categoryId: categories[index].id, isAvailable: true },
    select: { id: true, name: true, nameSw: true, price: true },
    orderBy: { sortOrder: 'asc' },
  });

  if (!items.length) {
    return `END Hakuna bidhaa katika kategoria hii.\n\nHamna bidhaa katika kategoria hii.`;
  }

  return buildItemMenu(items);
}

async function handleItemSelected(
  session: SessionData, input: string, save: () => Promise<void>,
  sessionId: string, phoneNumber: string
): Promise<string> {
  if (input === '99') {
    session.state = USSDState.MAIN_MENU;
    session.selectedCategoryId = undefined;
    session.selectedItemId = undefined;
    session.selectedItem = undefined;
    await save();
    return buildMainMenu(session.restaurantName);
  }
  if (input === '0') {
    return `END Asante. Kwaheri!\n\nKwaheri!`;
  }

  const items = await prisma.menuItem.findMany({
    where: { categoryId: session.selectedCategoryId, isAvailable: true },
    select: { id: true, name: true, nameSw: true, price: true },
    orderBy: { sortOrder: 'asc' },
  });

  const index = parseInt(input) - 1;
  if (isNaN(index) || !items[index]) {
    return `CON Chaguo batili. Jaribu tena.\n\n${buildItemMenu(items)}`;
  }

  session.selectedItem = {
    id: items[index].id,
    name: items[index].nameSw || items[index].name,
    price: Number(items[index].price),
  };
  session.selectedItemId = items[index].id;
  session.quantity = 1;
  session.state = USSDState.CONFIRM_ORDER;
  await save();

  const total = session.selectedItem.price * session.quantity;
  return truncateResponse(
    `CON Thibitisha Agizo:\n${session.selectedItem.name} x${session.quantity}\nJumla: KSh ${total.toLocaleString()}\n\n1. Thibitisha\n2. Badilisha Idadi\n99. Menyu Kuu\n0. Toka`
  );
}

async function handleConfirmOrder(session: SessionData, input: string, save: () => Promise<void>): Promise<string> {
  if (input === '99') {
    session.state = USSDState.MAIN_MENU;
    session.selectedCategoryId = undefined;
    session.selectedItemId = undefined;
    session.selectedItem = undefined;
    session.quantity = 1;
    await save();
    return buildMainMenu(session.restaurantName);
  }
  if (input === '0') {
    return `END Agizo limeghairiwa.\n\nAgizo limeghairiwa.`;
  }

  if (input === '2') {
    return `CON Ingiza idadi:\n\n99. Menyu Kuu\n0. Toka`;
  }

  if (input === '1') {
    const total = (session.selectedItem?.price || 0) * (session.quantity || 1);
    session.totalAmount = total;
    session.state = USSDState.PAYMENT;
    await save();
    return truncateResponse(
      `CON Chagua Njia ya Malipo:\n1. M-Pesa\n2. Cash\n\n99. Menyu Kuu\n0. Ghairi`
    );
  }

  // Handle quantity input when in confirm_order state
  const qty = parseInt(input);
  if (!isNaN(qty) && qty >= 1 && qty <= 100) {
    session.quantity = qty;
    session.state = USSDState.CONFIRM_ORDER;
    await save();
    const total = (session.selectedItem?.price || 0) * qty;
    return truncateResponse(
      `CON Thibitisha Agizo:\n${session.selectedItem?.name || ''} x${qty}\nJumla: KSh ${total.toLocaleString()}\n\n1. Thibitisha\n2. Badilisha Idadi\n99. Menyu Kuu\n0. Toka`
    );
  }

  const total = (session.selectedItem?.price || 0) * (session.quantity || 1);
  return `CON Chaguo batili.\n\nThibitisha Agizo:\n${session.selectedItem?.name || ''} x${session.quantity}\nJumla: KSh ${total.toLocaleString()}\n\n1. Thibitisha\n2. Badilisha Idadi\n99. Menyu Kuu\n0. Toka`;
}

async function handlePayment(
  session: SessionData, input: string, save: () => Promise<void>,
  sessionId: string, phoneNumber: string
): Promise<string> {
  if (input === '99') {
    session.state = USSDState.MAIN_MENU;
    session.selectedItem = undefined;
    session.totalAmount = 0;
    await save();
    return buildMainMenu(session.restaurantName);
  }
  if (input === '0') {
    return `END Agizo limeghairiwa.\n\nAgizo limeghairiwa.`;
  }

  if (input === '1' || input === '2') {
    const orderNumber = `USD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    session.orderNumber = orderNumber;
    session.state = USSDState.ORDER_PLACED;

    if (session.restaurantId && session.selectedItem) {
      try {
        await prisma.order.create({
          data: {
            restaurantId: session.restaurantId,
            orderNumber,
            sessionId,
            status: 'PENDING',
            paymentStatus: 'UNPAID',
            paymentMethod: input === '1' ? 'MPESA' : 'CASH',
            subtotal: session.totalAmount,
            serviceCharge: 0,
            taxAmount: 0,
            tipAmount: 0,
            totalAmount: session.totalAmount,
            customerPhone: phoneNumber,
            items: {
              create: {
                menuItemId: session.selectedItem.id,
                itemName: session.selectedItem.name,
                itemPrice: session.selectedItem.price,
                quantity: session.quantity || 1,
                subtotal: session.selectedItem.price * (session.quantity || 1),
              },
            },
          },
        });
      } catch (err) {
        logger.error('Failed to create USSD order', { error: err, sessionId, phoneNumber });
      }
    }

    await save();
    return truncateResponse(
      `END Agizo Limewekwa!\nNamba ya Agizo: ${orderNumber}\nJumla: KSh ${session.totalAmount.toLocaleString()}\n\nAsante kwa kuagiza kutoka ${session.restaurantName}!\n\nAsante!`
    );
  }

  return `CON Chaguo batili.\n\nChagua Njia ya Malipo:\n1. M-Pesa\n2. Cash\n\n99. Menyu Kuu\n0. Ghairi`;
}

export default router;

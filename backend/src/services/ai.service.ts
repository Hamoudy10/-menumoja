import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import * as openai from '../integrations/openai';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MenuItemRecord {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: { name: string };
  imageUrl?: string;
  totalOrders?: number;
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isHalal?: boolean;
  isTodaysSpecial?: boolean;
  isFeatured?: boolean;
  spiceLevel?: string;
}

interface FaqRecord {
  question: string;
  answer: string;
}

export async function processCustomerMessage(
  restaurantId: string,
  sessionId: string,
  message: string,
  language: string = 'en'
): Promise<{
  reply: string;
  suggestedItems: string[];
  quickReplies: string[];
}> {
  try {
    if (!message || !message.trim()) {
      throw AppError.validation('Message is required', 'Ujumbe unahitajika');
    }

    const sanitizedMessage = message.trim().substring(0, 2000);

    const [restaurant, menuItems, faqs] = await Promise.all([
      prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { name: true },
      }),
      prisma.menuItem.findMany({
        where: { restaurantId, isAvailable: true },
        select: {
          id: true,
          name: true,
          description: true,
          price: true,
          totalOrders: true,
          isVegetarian: true,
          isVegan: true,
          isGlutenFree: true,
          isHalal: true,
          isTodaysSpecial: true,
          isFeatured: true,
          spiceLevel: true,
          category: { select: { name: true } },
        },
        take: 50,
      }),
      prisma.restaurantFaq.findMany({
        where: { restaurantId },
        select: { question: true, answer: true },
      }),
    ]);

    const menuContext = buildMenuContext(restaurant, menuItems.map((m) => ({ ...m, price: Number(m.price) })));
    const faqContext = buildFaqContext(faqs);

    let conversation = await prisma.aiConversation.findFirst({
      where: { restaurantId, sessionId },
    });

    if (!conversation) {
      conversation = await prisma.aiConversation.create({
        data: {
          restaurantId,
          sessionId,
          messages: [],
        },
      });
    }

    const updatedMessages = [
      ...(conversation.messages as Array<{ role: string; content: string }> || []),
      { role: 'user', content: sanitizedMessage },
    ];

    if (updatedMessages.length > 50) {
      updatedMessages.splice(0, updatedMessages.length - 40);
    }

    let result: { reply: string; suggestedItems: string[]; quickReplies: string[] };
    try {
      result = await openai.customerChat(
        restaurantId,
        updatedMessages,
        language,
        menuContext,
        faqContext
      );
    } catch (error) {
      logger.warn('LLM unavailable, using local chef fallback', { error: (error as any)?.message, restaurantId });
      result = buildSmartReply(sanitizedMessage, menuItems.map((m) => ({ ...m, price: Number(m.price) })), faqs, restaurant, language);
    }

    updatedMessages.push({ role: 'assistant', content: result.reply });

    await prisma.aiConversation.update({
      where: { id: conversation.id },
      data: { messages: updatedMessages, updatedAt: new Date() },
    });

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('processCustomerMessage failed', { error: { message: (error as any)?.message, name: (error as any)?.name, stack: (error as any)?.stack }, restaurantId, sessionId });

    return {
      reply: language === 'sw'
        ? 'Samahani, nina shida ya kiufundi. Tafadhali jaribu tena baadaye.'
        : 'Sorry, I am having a technical issue. Please try again later.',
      suggestedItems: [],
      quickReplies: language === 'sw'
        ? ['Tazama Menyu', 'Weka Agizo', 'Wasiliana Nasi']
        : ['View Menu', 'Place Order', 'Contact Us'],
    };
  }
}

export async function processOwnerSetup(
  restaurantId: string,
  message: string,
  step: string
): Promise<{
  reply: string;
  action?: { type: string; data: Record<string, unknown> };
}> {
  try {
    if (!message || !message.trim()) {
      throw AppError.validation('Message is required', 'Ujumbe unahitajika');
    }

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
    });

    const messages = [
      { role: 'system', content: `Setting up restaurant: ${restaurant?.name || 'Unknown'}. Current step: ${step}` },
      { role: 'user', content: message.trim() },
    ];

    return await openai.ownerSetupChat(restaurantId, messages, step);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('processOwnerSetup failed', { error, restaurantId, step });

    return {
      reply: 'I encountered an error. Please try again or contact support.',
      action: undefined,
    };
  }
}

function buildMenuContext(restaurant: { name?: string; cuisine?: string } | null, items: MenuItemRecord[]): string {
  if (!items.length) return 'No menu items available.';

  const header = restaurant ? `Restaurant: ${restaurant.name}\nCuisine: ${restaurant.cuisine || 'Various'}\n\n` : '';
  const itemList = items
    .map((item) => `- ${item.name}${item.description ? `: ${item.description}` : ''} (KSh ${item.price})${item.category ? ` [${item.category.name}]` : ''}`)
    .join('\n');

  return `${header}Menu Items:\n${itemList}`;
}

function buildFaqContext(faqs: FaqRecord[]): string {
  if (!faqs.length) return '';

  return faqs
    .map((faq) => `Q: ${faq.question}\nA: ${faq.answer}`)
    .join('\n\n');
}

const FALLBACK_QUICK_REPLIES = ['View Menu', 'Place Order', 'Contact Restaurant', 'Operating Hours', 'Specials'];

function formatItemLine(item: MenuItemRecord): string {
  const tags: string[] = [];
  if (item.isVegetarian) tags.push('vegetarian');
  if (item.isVegan) tags.push('vegan');
  if (item.isGlutenFree) tags.push('gluten-free');
  if (item.isHalal) tags.push('halal');
  if (item.isTodaysSpecial) tags.push("today's special");
  if (item.isFeatured) tags.push('popular');
  const suffix = tags.length ? ` (${tags.join(', ')})` : '';
  return `${item.name} — KSh ${item.price}${suffix}`;
}

function findFaqAnswer(faqs: FaqRecord[], keywords: string[]): string | null {
  const lower = faqs
    .map((f) => ({ ...f, q: f.question.toLowerCase() }))
    .sort((a, b) => (a.answer || '').length - (b.answer || '').length);
  for (const kw of keywords) {
    const hit = lower.find((f) => f.q.includes(kw));
    if (hit) return hit.answer;
  }
  return null;
}

function buildSmartReply(
  message: string,
  items: MenuItemRecord[],
  faqs: FaqRecord[],
  restaurant: { name?: string; cuisine?: string } | null,
  language: string
): { reply: string; suggestedItems: string[]; quickReplies: string[] } {
  const lower = message.toLowerCase();
  const top = [...items].sort((a, b) => (b.totalOrders || 0) - (a.totalOrders || 0));

  if (items.length === 0) {
    return {
      reply: 'Our menu is being updated right now — please check back shortly!',
      suggestedItems: [],
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }

  // Item-specific question: mention a dish by name
  const nameMatch = items.find((i) => {
    const name = i.name.toLowerCase();
    const words = lower.replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => name.includes(w));
  });

  if (nameMatch && /(what|about|is|how|tell|spicy|halal|vegetarian|vegan|price|cost|calorie|ingredient|recommend|order)/.test(lower)) {
    const desc = nameMatch.description ? ` ${nameMatch.description}` : '';
    const dietary: string[] = [];
    if (nameMatch.isVegetarian) dietary.push('vegetarian');
    if (nameMatch.isVegan) dietary.push('vegan');
    if (nameMatch.isGlutenFree) dietary.push('gluten-free');
    if (nameMatch.isHalal) dietary.push('halal');
    const diet = dietary.length ? ` It is ${dietary.join(', ')}.` : '';
    const spice = nameMatch.spiceLevel && nameMatch.spiceLevel !== 'NONE' ? ` Spice level: ${nameMatch.spiceLevel}.` : '';
    return {
      reply: `${nameMatch.name} is KSh ${nameMatch.price}.${desc}${diet}${spice} Would you like to add it to your order?`,
      suggestedItems: [nameMatch.id],
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }

  // Popular / best / recommend
  if (/(popular|best|recommend|favourite|favorite|delicious|what.*(good|try|eat|order))/.test(lower)) {
    const picks = top.slice(0, 3);
    const list = picks.map(formatItemLine).join('\n');
    return {
      reply: `Our most loved dishes right now:\n${list}\n\nWant me to add one of these to your order?`,
      suggestedItems: picks.map((i) => i.id),
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }

  // Today's specials
  if (/(special|offer|deal|promo|discount|giveaway)/.test(lower)) {
    const specials = items.filter((i) => i.isTodaysSpecial);
    if (specials.length > 0) {
      return {
        reply: `Today's specials:\n${specials.slice(0, 3).map(formatItemLine).join('\n')}\n\nAsk me to add any of these to your order!`,
        suggestedItems: specials.slice(0, 3).map((i) => i.id),
        quickReplies: FALLBACK_QUICK_REPLIES,
      };
    }
    return {
      reply: 'We run daily specials — check the menu for today\'s highlighted dishes, or ask about any dish you like!',
      suggestedItems: top.slice(0, 3).map((i) => i.id),
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }

  // Dietary filters
  const veggie = items.filter((i) => i.isVegetarian || i.isVegan);
  if (/(vegetarian|veggie|vegan|plant)/.test(lower)) {
    if (veggie.length > 0) {
      return {
        reply: `Great vegetarian/vegan options:\n${veggie.slice(0, 3).map(formatItemLine).join('\n')}\n\nAll made fresh to order!`,
        suggestedItems: veggie.slice(0, 3).map((i) => i.id),
        quickReplies: FALLBACK_QUICK_REPLIES,
      };
    }
    return { reply: 'We currently have limited vegetarian options — our staff would be happy to help!', suggestedItems: [], quickReplies: FALLBACK_QUICK_REPLIES };
  }
  if (/(halal)/.test(lower)) {
    const halal = items.filter((i) => i.isHalal);
    if (halal.length > 0) {
      return {
        reply: `These dishes are halal:\n${halal.slice(0, 3).map(formatItemLine).join('\n')}`,
        suggestedItems: halal.slice(0, 3).map((i) => i.id),
        quickReplies: FALLBACK_QUICK_REPLIES,
      };
    }
    return { reply: 'Most of our menu is halal — ask our staff for details on any dish!', suggestedItems: [], quickReplies: FALLBACK_QUICK_REPLIES };
  }
  if (/(gluten|allergen|allergy)/.test(lower)) {
    const gf = items.filter((i) => i.isGlutenFree);
    if (gf.length > 0) {
      return {
        reply: `These options are gluten-free:\n${gf.slice(0, 3).map(formatItemLine).join('\n')}\n\nPlease inform staff of any allergies when ordering.`,
        suggestedItems: gf.slice(0, 3).map((i) => i.id),
        quickReplies: FALLBACK_QUICK_REPLIES,
      };
    }
    return { reply: 'Please check with our staff about gluten-free options — they will be happy to guide you.', suggestedItems: [], quickReplies: FALLBACK_QUICK_REPLIES };
  }
  if (/(spicy|hot)/.test(lower)) {
    const spicy = items.filter((i) => i.spiceLevel && i.spiceLevel.toUpperCase() !== 'NONE');
    if (spicy.length > 0) {
      return {
        reply: `These dishes have some spice:\n${spicy.slice(0, 3).map(formatItemLine).join('\n')}\n\nWe can adjust spice levels on request!`,
        suggestedItems: spicy.slice(0, 3).map((i) => i.id),
        quickReplies: FALLBACK_QUICK_REPLIES,
      };
    }
    return { reply: 'Most of our dishes are mild — just add a note if you would like extra spice!', suggestedItems: [], quickReplies: FALLBACK_QUICK_REPLIES };
  }

  // Price
  if (/(price|cost|cheap|affordable|expensive|budget)/.test(lower)) {
    const sorted = [...items].sort((a, b) => a.price - b.price);
    return {
      reply: `Affordable picks:\n${sorted.slice(0, 3).map(formatItemLine).join('\n')}\n\nFor something special, try ${formatItemLine(sorted[sorted.length - 1])}`,
      suggestedItems: sorted.slice(0, 3).map((i) => i.id),
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }

  // FAQs (hours, payment, contact, location)
  const faqKeywords: Record<string, string[]> = {
    hours: ['hour', 'open', 'close', 'time', 'when'],
    payment: ['payment', 'pay', 'mpesa', 'cash', 'card', 'mobile'],
    contact: ['contact', 'phone', 'call', 'reach'],
    location: ['location', 'where', 'address', 'direction', 'find'],
    delivery: ['delivery', 'takeaway', 'take-away', 'deliver'],
  };
  for (const [key, keywords] of Object.entries(faqKeywords)) {
    if (keywords.some((kw) => lower.includes(kw))) {
      const faqAnswer = findFaqAnswer(faqs, keywords);
      if (faqAnswer) {
        return { reply: faqAnswer, suggestedItems: [], quickReplies: FALLBACK_QUICK_REPLIES };
      }
      const generic: Record<string, string> = {
        hours: 'We would love to share our hours! Check the menu footer for opening hours, or call the restaurant directly.',
        payment: 'We accept cash and M-Pesa mobile money — you can choose at checkout. Payment is quick and easy!',
        contact: 'You can reach the restaurant by phone or visit us in person — the contact details are at the bottom of the menu.',
        location: 'You can find our address at the bottom of the menu — we look forward to serving you!',
        delivery: 'We offer takeaway orders — place your order here and collect it at the restaurant!',
      };
      return { reply: generic[key], suggestedItems: [], quickReplies: FALLBACK_QUICK_REPLIES };
    }
  }

  // General questions (small talk, jokes, facts, etc.)
  if (/(hi|hello|hey|jambo|sasa|habari|how are you|how's it going)/.test(lower) && lower.length < 30) {
    return {
      reply: `Hello! 😊 I'm your chef assistant at ${restaurant?.name || 'our restaurant'}. Ask me anything about the menu, or just chat — I'm all ears!`,
      suggestedItems: top.slice(0, 2).map((i) => i.id),
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }
  if (/(thank|thanks|asante|shukran)/.test(lower)) {
    return {
      reply: `You're very welcome! 😊 We hope you enjoy your meal at ${restaurant?.name || 'our restaurant'} — ask me anything else anytime!`,
      suggestedItems: [],
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }
  if (/(joke|funny|make me laugh)/.test(lower)) {
    return {
      reply: `Why did the tomato turn red? Because it saw the salad dressing! 🍅😄 Here at ${restaurant?.name || 'our restaurant'} we serve jokes as fresh as our ingredients — ask about the menu for the real main course!`,
      suggestedItems: [],
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }
  if (/(weather|rain|sunny|hot day|cold)/.test(lower)) {
    return {
      reply: 'I wish I could check the weather for you! 🌦️ Whatever the forecast, we\'ve got the perfect dish to match — something warm on a cold day, or something light and fresh when it\'s sunny. Ask me for a suggestion!',
      suggestedItems: top.slice(0, 2).map((i) => i.id),
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }
  if (/(capital of|who is|what is the|history of|recipe for|how to cook|interesting fact|trivia|math|what is \d+\s*[+x*\/-]|\d+\s*[+x*\/-]\s*\d+)/.test(lower)) {
    const math = lower.match(/(-?\d+(?:\.\d+)?)\s*([+\-*/x])\s*(-?\d+(?:\.\d+)?)/);
    if (math && /^[0-9+\-*/x. ]+$/.test(math[0].replace(/ /g, ''))) {
      const a = parseFloat(math[1]);
      const b = parseFloat(math[3]);
      const op = math[2];
      const val = op === '+' ? a + b : op === '-' ? a - b : (op === 'x' || op === '*') ? a * b : b !== 0 ? a / b : null;
      if (val !== null) {
        return {
          reply: `${a} ${op} ${b} = ${val} 😊 Anything else you'd like to know — about our menu or otherwise?`,
          suggestedItems: [],
          quickReplies: FALLBACK_QUICK_REPLIES,
        };
      }
    }
    return {
      reply: `That's a fun question! 🤔 My local knowledge is mostly about food and ${restaurant?.name || 'our restaurant'}'s menu — for deeper general-knowledge questions, our full AI brain usually kicks in. Try asking again, or explore our menu while you're here!`,
      suggestedItems: top.slice(0, 2).map((i) => i.id),
      quickReplies: FALLBACK_QUICK_REPLIES,
    };
  }

  // Generic fallback
  const picks = top.slice(0, 3);
  return {
    reply: `Here is what our guests love most:\n${picks.map(formatItemLine).join('\n')}\n\nYou can ask me about ingredients, dietary options, prices, opening hours or payments — or add anything to your order!`,
    suggestedItems: picks.map((i) => i.id),
    quickReplies: FALLBACK_QUICK_REPLIES,
  };
}

export default {
  processCustomerMessage,
  processOwnerSetup,
};

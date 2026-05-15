import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import * as openai from '../integrations/openai';
import * as cloudinary from '../integrations/cloudinary';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface MenuItemRecord {
  id: string;
  name: string;
  description?: string;
  price: number;
  category?: { name: string };
  imageUrl?: string;
}

interface FaqRecord {
  question: string;
  answer: string;
}

interface RestaurantRecord {
  id: string;
  name: string;
  cuisine?: string;
  description?: string;
  location?: string;
  phone?: string;
  socialMedia?: Record<string, any>;
}

interface ConversationRecord {
  id: string;
  restaurantId: string;
  sessionId: string;
  messages: Array<{ role: string; content: string }>;
  metadata?: Record<string, any>;
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
        select: { name: true, cuisine: true },
      }),
      prisma.menuItem.findMany({
        where: { restaurantId, isAvailable: true },
        select: { id: true, name: true, description: true, price: true, category: { select: { name: true } } },
        take: 50,
      }),
      prisma.faq.findMany({
        where: { restaurantId },
        select: { question: true, answer: true },
      }),
    ]);

    const menuContext = buildMenuContext(restaurant, menuItems);
    const faqContext = buildFaqContext(faqs);

    let conversation = await prisma.conversation.findFirst({
      where: { restaurantId, sessionId },
    });

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          restaurantId,
          sessionId,
          messages: [],
          metadata: { language },
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

    const result = await openai.customerChat(
      restaurantId,
      updatedMessages,
      language,
      menuContext,
      faqContext
    );

    updatedMessages.push({ role: 'assistant', content: result.reply });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { messages: updatedMessages, updatedAt: new Date() },
    });

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('processCustomerMessage failed', { error, restaurantId, sessionId });

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

export async function generateAndSaveImage(
  itemId: string,
  prompt: string
): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  try {
    const menuItem = await prisma.menuItem.findUnique({
      where: { id: itemId },
      select: { id: true, name: true, restaurantId: true },
    });

    if (!menuItem) {
      throw new AppError(404, 'ITEM_NOT_FOUND', 'Menu item not found', 'Bidhaa haikupatikana');
    }

    const aiImage = await openai.generateImage(prompt, menuItem.name);

    if (!aiImage.imageUrl) {
      throw new AppError(502, 'AI_IMAGE_FAILED', 'Failed to generate image', 'Imeshindwa kutengeneza picha');
    }

    const uploaded = await cloudinary.uploadImage(aiImage.imageUrl, `restaurants/${menuItem.restaurantId}/items`);

    await prisma.menuItem.update({
      where: { id: itemId },
      data: {
        imageUrl: uploaded.url,
        imageThumbnail: uploaded.thumbnailUrl,
      },
    });

    logger.info('Generated and saved AI image', { itemId, prompt: prompt.substring(0, 100) });

    return { imageUrl: uploaded.url, thumbnailUrl: uploaded.thumbnailUrl };
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('generateAndSaveImage failed', { error, itemId });
    throw new AppError(502, 'IMAGE_GENERATION_FAILED', 'Failed to generate and save image', 'Imeshindwa kutengeneza na kuhifadhi picha');
  }
}

export async function createDailySocialPosts(
  restaurantId: string
): Promise<void> {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        cuisine: true,
        description: true,
        location: true,
        socialMedia: true,
        phone: true,
      },
    });

    if (!restaurant) {
      logger.warn('Restaurant not found for social post generation', { restaurantId });
      return;
    }

    const socialMedia = (restaurant.socialMedia || {}) as Record<string, any>;
    const enabledPlatforms: string[] = [];

    if (socialMedia.facebookPageId) enabledPlatforms.push('facebook');
    if (socialMedia.instagramBusinessId) enabledPlatforms.push('instagram');
    if (socialMedia.whatsappNumber) enabledPlatforms.push('whatsapp');

    if (!enabledPlatforms.length) {
      logger.info('No social media platforms configured', { restaurantId });
      return;
    }

    const postTypes = ['daily_special', 'customer_favorite', 'behind_the_scenes', 'promotion'];
    const postType = postTypes[Math.floor(Math.random() * postTypes.length)];

    const restaurantInfo = {
      name: restaurant.name,
      cuisine: restaurant.cuisine,
      description: restaurant.description,
      location: restaurant.location,
      phone: restaurant.phone,
    };

    for (const platform of enabledPlatforms) {
      try {
        const post = await openai.generateSocialPost(restaurantInfo, postType, platform, 'en');

        const scheduledTime = new Date();
        scheduledTime.setHours(scheduledTime.getHours() + 2);

        await prisma.scheduledPost.create({
          data: {
            restaurantId,
            platform,
            caption: post.caption,
            imageUrl: post.imageUrl,
            hashtags: post.hashtags,
            scheduledAt: scheduledTime,
            status: 'pending',
          },
        });

        logger.info('Scheduled social post', { restaurantId, platform, postType });
      } catch (platformError) {
        logger.error('Failed to create social post for platform', {
          error: platformError,
          restaurantId,
          platform,
        });
      }
    }
  } catch (error) {
    logger.error('createDailySocialPosts failed', { error, restaurantId });
  }
}

export async function generateMenuDescriptions(
  restaurantId: string
): Promise<number> {
  try {
    const items = await prisma.menuItem.findMany({
      where: {
        restaurantId,
        OR: [
          { description: null },
          { descriptionSwahili: null },
        ],
      },
      select: { id: true, name: true, ingredients: true },
    });

    let generated = 0;

    for (const item of items) {
      try {
        const ingredients = (item.ingredients as string[]) || [];
        const desc = await openai.generateDescription(item.name, ingredients);

        await prisma.menuItem.update({
          where: { id: item.id },
          data: {
            description: desc.english,
            descriptionSwahili: desc.swahili,
          },
        });

        generated++;
      } catch (itemError) {
        logger.error('Failed to generate description for item', {
          error: itemError,
          itemId: item.id,
        });
      }
    }

    return generated;
  } catch (error) {
    logger.error('generateMenuDescriptions failed', { error, restaurantId });
    throw error;
  }
}

export async function analyzeFoodImage(
  imageUrl: string,
  restaurantId: string,
  menuItemId?: string
): Promise<{ anomalies: Array<{ type: string; confidence: number; description: string }> }> {
  try {
    const result = await openai.analyzeCameraImage(imageUrl);

    if (result.anomalies.length > 0) {
      await prisma.foodAnomaly.create({
        data: {
          restaurantId,
          menuItemId: menuItemId || null,
          imageUrl,
          anomalies: result.anomalies as any,
          detectedAt: new Date(),
        },
      });

      logger.warn('Food anomalies detected', {
        restaurantId,
        anomalyCount: result.anomalies.length,
        types: result.anomalies.map((a) => a.type),
      });
    }

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('analyzeFoodImage failed', { error, restaurantId });
    throw new AppError(502, 'IMAGE_ANALYSIS_FAILED', 'Failed to analyze food image', 'Imeshindwa kuchambua picha ya chakula');
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

export async function getOrCreateConversation(
  restaurantId: string,
  sessionId: string
): Promise<ConversationRecord> {
  let conversation = await prisma.conversation.findFirst({
    where: { restaurantId, sessionId },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        restaurantId,
        sessionId,
        messages: [],
      },
    });
  }

  return conversation;
}

export default {
  processCustomerMessage,
  processOwnerSetup,
  generateAndSaveImage,
  createDailySocialPosts,
  generateMenuDescriptions,
  analyzeFoodImage,
  getOrCreateConversation,
};

import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/config/database';
import { authenticate, enforceRestaurantScope, validate, validateParams, aiChatLimiter, asyncHandler } from '@/middleware';
import { AppError, NotFoundError } from '@/utils/errors';
import { generateDescriptionSchema, generateImageSchema } from '@/utils/validation';
import { aiService } from '@/services';
import * as openai from '@/integrations/openai';
import * as cloudinary from '@/integrations/cloudinary';
import logger from '@/utils/logger';

const router = Router();

const sessionIdParamSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

const customerChatSchema = z.object({
  restaurantId: z.string().uuid('Invalid restaurant ID'),
  sessionId: z.string().min(1, 'Session ID is required'),
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
  language: z.enum(['en', 'sw']).default('en'),
}).strict();

const ownerSetupChatSchema = z.object({
  message: z.string().min(1, 'Message is required').max(2000, 'Message too long'),
  onboardingStep: z.string().min(1, 'Onboarding step is required'),
}).strict();

const generateRestaurantDescSchema = z.object({
  restaurantName: z.string().min(1, 'Restaurant name is required').max(200),
  cuisineType: z.string().min(1, 'Cuisine type is required').max(100),
  location: z.string().min(1, 'Location is required').max(200),
}).strict();

const enhanceImageSchema = z.object({
  imageUrl: z.string().url('Invalid image URL'),
}).strict();

const generateFaqSchema = z.object({
  restaurantType: z.string().min(1, 'Restaurant type is required').max(200),
  cuisineType: z.string().min(1, 'Cuisine type is required').max(100),
}).strict();

const generateSocialPostSchema = z.object({
  restaurantId: z.string().uuid('Invalid restaurant ID'),
  postType: z.string().min(1, 'Post type is required'),
  platform: z.enum(['instagram', 'facebook', 'twitter', 'whatsapp']),
  menuItemId: z.string().uuid('Invalid menu item ID').optional(),
  language: z.enum(['en', 'sw']).default('en'),
}).strict();

// ── Customer Chat Routes ──

router.post('/chat/customer',
  aiChatLimiter,
  validate(customerChatSchema),
  asyncHandler(async (req, res) => {
    const { restaurantId, sessionId, message, language } = req.body;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { id: true, name: true, isActive: true },
    });

    if (!restaurant) {
      throw new NotFoundError('Restaurant not found', 'Mgahawa haukupatikana');
    }

    if (!restaurant.isActive) {
      throw new AppError(403, 'RESTAURANT_INACTIVE', 'Restaurant is not active', 'Mgahawa haufanyi kazi');
    }

    const searchResult = await aiService.processCustomerMessage(
      restaurantId,
      sessionId,
      message,
      language
    );

    res.json({
      success: true,
      data: {
        reply: searchResult.reply,
        suggestedItems: searchResult.suggestedItems,
        quickReplies: searchResult.quickReplies,
      },
    });
  })
);

// ── Owner Setup Routes ──

router.post('/chat/owner-setup',
  authenticate,
  validate(ownerSetupChatSchema),
  asyncHandler(async (req, res) => {
    const { message, onboardingStep } = req.body;
    const userId = req.user!.userId;

    const owner = await prisma.owner.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        restaurants: { select: { id: true, name: true }, take: 1 },
      },
    });

    if (!owner) {
      throw new NotFoundError('Owner not found', 'Mmiliki hajakupatikana');
    }

    const restaurantId = owner.restaurants[0]?.id;

    if (!restaurantId) {
      throw new AppError(400, 'NO_RESTAURANT', 'No restaurant found for this owner. Please create a restaurant first.', 'Hakuna mgahawa uliopatikana kwa mmiliki huyu. Tafadhali unda mgahawa kwanza.');
    }

    const result = await aiService.processOwnerSetup(
      restaurantId,
      message,
      onboardingStep
    );

    res.json({
      success: true,
      data: {
        reply: result.reply,
        action: result.action || null,
        onboardingStep,
      },
    });
  })
);

// ── AI Content Generation Routes ──

router.post('/generate/description',
  authenticate,
  enforceRestaurantScope,
  validate(generateDescriptionSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { itemName, keywords, tone, maxLength } = req.body;

    const ingredients = keywords || [];

    const result = await openai.generateDescription(itemName, ingredients, tone);

    const data = await prisma.aiGeneratedContent.create({
      data: {
        restaurantId,
        contentType: 'MENU_DESCRIPTION',
        promptUsed: `Generate description for: ${itemName} (style: ${tone})`,
        generatedContent: JSON.stringify(result),
      },
    });

    logger.info('Menu item description generated', { itemName, restaurantId, contentId: data.id });

    res.status(201).json({
      success: true,
      data: {
        description: result.english,
        descriptionSw: result.swahili,
      },
    });
  })
);

router.post('/generate/restaurant-description',
  authenticate,
  enforceRestaurantScope,
  validate(generateRestaurantDescSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { restaurantName, cuisineType, location } = req.body;

    const result = await openai.generateRestaurantDescription(
      restaurantName,
      cuisineType,
      location
    );

    const data = await prisma.aiGeneratedContent.create({
      data: {
        restaurantId,
        contentType: 'RESTAURANT_DESC',
        promptUsed: `Generate restaurant description for: ${restaurantName} (${cuisineType}, ${location})`,
        generatedContent: JSON.stringify(result),
      },
    });

    logger.info('Restaurant description generated', { restaurantName, restaurantId, contentId: data.id });

    res.status(201).json({
      success: true,
      data: {
        description: result.english,
        descriptionSw: result.swahili,
      },
    });
  })
);

router.post('/generate/image',
  authenticate,
  enforceRestaurantScope,
  validate(generateImageSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { prompt, style, size } = req.body;

    const enhancedPrompt = `Professional food photography. ${prompt}. ${style ? `${style} style,` : ''} High resolution, studio lighting, appetizing presentation.`;

    const result = await openai.generateImage(enhancedPrompt, 'menu-item');

    if (!result.imageUrl) {
      throw new AppError(502, 'AI_IMAGE_FAILED', 'Failed to generate image', 'Imeshindwa kutengeneza picha');
    }

    const uploaded = await cloudinary.uploadImage(
      result.imageUrl,
      `restaurants/${restaurantId}/ai-generated`
    );

    const data = await prisma.aiGeneratedContent.create({
      data: {
        restaurantId,
        contentType: 'IMAGE',
        promptUsed: enhancedPrompt.substring(0, 500),
        generatedContent: prompt,
        imageUrl: uploaded.url,
      },
    });

    logger.info('AI image generated and saved', { restaurantId, contentId: data.id });

    res.status(201).json({
      success: true,
      data: {
        imageUrl: uploaded.url,
        thumbnailUrl: uploaded.thumbnailUrl,
      },
    });
  })
);

router.post('/enhance/image',
  authenticate,
  enforceRestaurantScope,
  validate(enhanceImageSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { imageUrl } = req.body;

    const result = await cloudinary.enhanceImage(imageUrl, restaurantId);

    logger.info('Image enhanced', { restaurantId, originalUrl: imageUrl.substring(0, 100) });

    res.json({
      success: true,
      data: {
        enhancedImageUrl: result.url,
        thumbnailUrl: result.thumbnailUrl,
      },
    });
  })
);

router.post('/generate/faq',
  authenticate,
  enforceRestaurantScope,
  validate(generateFaqSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { restaurantType, cuisineType } = req.body;

    const faqs = await openai.generateFAQSuggestions(restaurantType, cuisineType);

    const data = await prisma.aiGeneratedContent.create({
      data: {
        restaurantId,
        contentType: 'SOCIAL_POST',
        promptUsed: `Generate FAQ for: ${restaurantType} (${cuisineType})`,
        generatedContent: JSON.stringify(faqs),
      },
    });

    logger.info('FAQ suggestions generated', { restaurantId, faqCount: faqs.length, contentId: data.id });

    res.status(201).json({
      success: true,
      data: {
        faqs,
      },
    });
  })
);

router.post('/generate/social-post',
  authenticate,
  enforceRestaurantScope,
  validate(generateSocialPostSchema),
  asyncHandler(async (req, res) => {
    const restaurantId = (req as any).restaurantId;
    const { postType, platform, menuItemId, language } = req.body;

    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: {
        id: true,
        name: true,
        cuisine: true,
        description: true,
        location: true,
        phone: true,
      },
    });

    if (!restaurant) {
      throw new NotFoundError('Restaurant not found', 'Mgahawa haukupatikana');
    }

    const restaurantInfo: Record<string, any> = {
      name: restaurant.name,
      cuisine: restaurant.cuisine || '',
      description: restaurant.description || '',
      location: restaurant.location || '',
      phone: restaurant.phone || '',
    };

    if (menuItemId) {
      const menuItem = await prisma.menuItem.findFirst({
        where: { id: menuItemId, restaurantId },
        select: { id: true, name: true, price: true, description: true, photoUrl: true },
      });

      if (menuItem) {
        restaurantInfo.featuredItem = {
          id: menuItem.id,
          name: menuItem.name,
          price: Number(menuItem.price),
          description: menuItem.description,
          imageUrl: menuItem.photoUrl,
        };
      }
    }

    const result = await openai.generateSocialPost(restaurantInfo, postType, platform, language);

    const hashtagsStr = Array.isArray(result.hashtags)
      ? result.hashtags.join(' ')
      : typeof result.hashtags === 'string'
        ? result.hashtags
        : '';

    const data = await prisma.aiGeneratedContent.create({
      data: {
        restaurantId,
        contentType: 'SOCIAL_POST',
        promptUsed: `Generate ${platform} ${postType} post for: ${restaurant.name}`,
        generatedContent: JSON.stringify({ caption: result.caption, hashtags: hashtagsStr }),
        imageUrl: result.imageUrl,
      },
    });

    logger.info('Social post generated', { restaurantId, platform, postType, contentId: data.id });

    res.status(201).json({
      success: true,
      data: {
        caption: result.caption,
        imageUrl: result.imageUrl,
        hashtags: hashtagsStr,
      },
    });
  })
);

// ── Conversation History Routes ──

router.get('/conversations/:sessionId',
  validateParams(sessionIdParamSchema),
  asyncHandler(async (req, res) => {
    const { sessionId } = req.params;
    const restaurantId = req.query.restaurantId as string | undefined;

    const where: any = { sessionId };
    if (restaurantId) where.restaurantId = restaurantId;

    const conversations = await prisma.aiConversation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        id: true,
        restaurantId: true,
        sessionId: true,
        conversationType: true,
        messages: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (conversations.length === 0) {
      return res.json({
        success: true,
        data: {
          sessionId,
          messages: [],
          conversationType: 'CUSTOMER_CHAT',
        },
      });
    }

    const conversation = conversations[0];
    const messages = (conversation.messages as Array<{ role: string; content: string }>) || [];

    res.json({
      success: true,
      data: {
        id: conversation.id,
        sessionId: conversation.sessionId,
        conversationType: conversation.conversationType,
        messages: messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
    });
  })
);

export default router;

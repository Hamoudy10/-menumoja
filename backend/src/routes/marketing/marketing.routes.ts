import { Router, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../../config/database';
import { authenticate, enforceRestaurantScope, validate, validateQuery, auditLog } from '../../middleware';
import { AppError, NotFoundError } from '../../utils/errors';
import { parsePagination, buildPaginationMeta, asyncHandler } from '../../utils/helpers';
import { encrypt, decrypt } from '../../utils/encryption';
import logger from '../../utils/logger';
import * as metaIntegration from '../../integrations/meta';
import * as whatsappIntegration from '../../integrations/whatsapp';
import * as queue from '../../jobs/queue';
import { AuthenticatedRequest } from '../../types';

const router = Router();

router.use(authenticate, enforceRestaurantScope);

const SocialPlatform = z.enum(['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'WHATSAPP']);

const createPostSchema = z.object({
  platform: SocialPlatform,
  contentText: z.string().min(1).max(10000),
  contentTextSw: z.string().max(10000).optional(),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
  postType: z.enum(['DAILY_SPECIAL', 'PROMOTION', 'ANNOUNCEMENT', 'ENGAGEMENT', 'SEASONAL', 'CUSTOM']).default('CUSTOM'),
});

const aiGenerateSchema = z.object({
  frequency: z.enum(['1x', '2x', 'daily']),
  platforms: z.array(SocialPlatform).min(1).max(5),
  style: z.string().max(500),
  autoApprove: z.boolean().default(false),
});

const editPostSchema = z.object({
  contentText: z.string().min(1).max(10000).optional(),
  contentTextSw: z.string().max(10000).optional(),
  imageUrl: z.string().url().optional(),
  scheduledAt: z.string().datetime().optional(),
});

const broadcastSchema = z.object({
  message: z.string().min(1).max(5000),
  imageUrl: z.string().url().optional(),
  recipientType: z.enum(['all', 'active']).default('all'),
});

function maskToken(token: string): string {
  if (token.length <= 8) return '****';
  return token.slice(0, 4) + '****' + token.slice(-4);
}

// ==================== SOCIAL CONNECTIONS ====================

router.get('/connections', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;

  const connections = await prisma.socialMediaConnection.findMany({
    where: { restaurantId },
    orderBy: { createdAt: 'desc' },
  });

  const masked = connections.map((c) => ({
    ...c,
    accessToken: maskToken(c.accessToken),
    refreshToken: c.refreshToken ? maskToken(c.refreshToken) : null,
  }));

  res.json({ success: true, data: masked });
}));

router.post('/connect/facebook', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const appId = process.env.META_APP_ID;
  const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/marketing/connect/facebook/callback`;

  if (!appId) {
    throw new AppError(500, 'META_CONFIG_ERROR', 'Meta App ID not configured', 'Kitambulisho cha Meta hakijasanidiwa');
  }

  const state = Buffer.from(JSON.stringify({ restaurantId, timestamp: Date.now() })).toString('base64');

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish`;

  res.json({ success: true, data: { authUrl } });
}));

router.post('/connect/facebook/callback', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const { code } = req.body;

  if (!code) {
    throw AppError.validation('Authorization code is required', 'Nambari ya uidhinisho inahitajika');
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/marketing/connect/facebook/callback`;

  if (!appId || !appSecret) {
    throw new AppError(500, 'META_CONFIG_ERROR', 'Meta credentials not configured', 'Vitambulisho vya Meta havijasanidiwa');
  }

  const tokenResponse = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`);
  const tokenData = await tokenResponse.json() as any;

  if (!tokenData.access_token) {
    throw new AppError(502, 'META_TOKEN_EXCHANGE_FAILED', 'Failed to exchange authorization code', 'Imeshindwa kubadilisha nambari ya uidhinisho');
  }

  const shortLivedToken = tokenData.access_token;
  const longLivedToken = await metaIntegration.exchangeForLongLivedToken(shortLivedToken);

  const meResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,accounts{id,name,access_token}&access_token=${longLivedToken}`);
  const meData = await meResponse.json() as any;

  const pages = meData.accounts?.data || [];
  if (pages.length === 0) {
    throw new AppError(400, 'NO_PAGES', 'No Facebook pages found. Create a page first.', 'Hakuna kurasa za Facebook. Unda ukurasa kwanza.');
  }

  const page = pages[0];
  const pageAccessToken = page.access_token;

  await prisma.socialMediaConnection.upsert({
    where: { restaurantId_platform: { restaurantId, platform: 'FACEBOOK' } },
    update: {
      accountName: page.name,
      accessToken: longLivedToken,
      refreshToken: pageAccessToken,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      pageId: page.id,
      isActive: true,
    },
    create: {
      restaurantId,
      platform: 'FACEBOOK',
      accountName: page.name,
      accessToken: longLivedToken,
      refreshToken: pageAccessToken,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      pageId: page.id,
      isActive: true,
    },
  });

  try {
    const igAccounts = await metaIntegration.getInstagramBusinessAccounts(page.id, pageAccessToken);
    if (igAccounts.length > 0) {
      const ig = igAccounts[0];
      const existing = await prisma.socialMediaConnection.findUnique({
        where: { restaurantId_platform: { restaurantId, platform: 'INSTAGRAM' } },
      });

      if (!existing) {
        await prisma.socialMediaConnection.create({
          data: {
            restaurantId,
            platform: 'INSTAGRAM',
            accountName: ig.name,
            accessToken: pageAccessToken,
            refreshToken: longLivedToken,
            tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            pageId: ig.id,
            isActive: true,
          },
        });
      }
    }
  } catch (err) {
    logger.warn('Could not link Instagram account automatically', { error: err });
  }

  const connection = await prisma.socialMediaConnection.findUnique({
    where: { restaurantId_platform: { restaurantId, platform: 'FACEBOOK' } },
  });

  res.json({ success: true, data: { connection } });
}));

router.post('/connect/instagram', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const appId = process.env.META_APP_ID;
  const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/marketing/connect/instagram/callback`;

  if (!appId) {
    throw new AppError(500, 'META_CONFIG_ERROR', 'Meta App ID not configured', 'Kitambulisho cha Meta hakijasanidiwa');
  }

  const state = Buffer.from(JSON.stringify({ restaurantId, timestamp: Date.now() })).toString('base64');

  const authUrl = `https://www.facebook.com/v21.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&scope=instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement`;

  res.json({ success: true, data: { authUrl } });
}));

router.post('/connect/instagram/callback', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const { code } = req.body;

  if (!code) {
    throw AppError.validation('Authorization code is required', 'Nambari ya uidhinisho inahitajika');
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/marketing/connect/instagram/callback`;

  if (!appId || !appSecret) {
    throw new AppError(500, 'META_CONFIG_ERROR', 'Meta credentials not configured', 'Vitambulisho vya Meta havijasanidiwa');
  }

  const tokenResponse = await fetch(`https://graph.facebook.com/v21.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`);
  const tokenData = await tokenResponse.json() as any;

  if (!tokenData.access_token) {
    throw new AppError(502, 'META_TOKEN_EXCHANGE_FAILED', 'Failed to exchange authorization code', 'Imeshindwa kubadilisha nambari ya uidhinisho');
  }

  const longLivedToken = await metaIntegration.exchangeForLongLivedToken(tokenData.access_token);

  const meResponse = await fetch(`https://graph.facebook.com/me?fields=id,name,accounts{id,name,access_token}&access_token=${longLivedToken}`);
  const meData = await meResponse.json() as any;

  const pages = meData.accounts?.data || [];
  if (pages.length === 0) {
    throw new AppError(400, 'NO_PAGES', 'No Facebook pages found. An Instagram Business account must be linked to a Facebook page.', 'Hakuna kurasa za Facebook. Akaunti ya Instagram Business lazima iunganishwe na ukurasa wa Facebook.');
  }

  const page = pages[0];
  const pageToken = page.access_token;

  const igAccounts = await metaIntegration.getInstagramBusinessAccounts(page.id, pageToken);
  if (igAccounts.length === 0) {
    throw new AppError(400, 'NO_INSTAGRAM', 'No Instagram Business account linked to this Facebook page.', 'Hakuna akaunti ya Instagram Business iliyounganishwa na ukurasa huu wa Facebook.');
  }

  const ig = igAccounts[0];

  await prisma.socialMediaConnection.upsert({
    where: { restaurantId_platform: { restaurantId, platform: 'INSTAGRAM' } },
    update: {
      accountName: ig.name,
      accessToken: longLivedToken,
      refreshToken: pageToken,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      pageId: ig.id,
      isActive: true,
    },
    create: {
      restaurantId,
      platform: 'INSTAGRAM',
      accountName: ig.name,
      accessToken: longLivedToken,
      refreshToken: pageToken,
      tokenExpiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
      pageId: ig.id,
      isActive: true,
    },
  });

  const connection = await prisma.socialMediaConnection.findUnique({
    where: { restaurantId_platform: { restaurantId, platform: 'INSTAGRAM' } },
  });

  res.json({ success: true, data: { connection } });
}));

router.post('/connect/tiktok', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/marketing/connect/tiktok/callback`;

  if (!clientKey) {
    throw new AppError(500, 'TIKTOK_CONFIG_ERROR', 'TikTok client key not configured', 'Ufunguo wa TikTok haujasanidiwa');
  }

  const state = Buffer.from(JSON.stringify({ restaurantId, timestamp: Date.now() })).toString('base64');
  const authUrl = `https://www.tiktok.com/v2/auth/authorize?client_key=${clientKey}&scope=user.info.basic,video.publish&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;

  res.json({ success: true, data: { authUrl } });
}));

router.post('/connect/tiktok/callback', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const { code } = req.body;

  if (!code) {
    throw AppError.validation('Authorization code is required', 'Nambari ya uidhinisho inahitajika');
  }

  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const redirectUri = `${process.env.API_URL || 'http://localhost:3001'}/api/v1/marketing/connect/tiktok/callback`;

  if (!clientKey || !clientSecret) {
    throw new AppError(500, 'TIKTOK_CONFIG_ERROR', 'TikTok credentials not configured', 'Vitambulisho vya TikTok havijasanidiwa');
  }

  const tokenResponse = await fetch('https://open.tiktokapis.com/v2/oauth/token/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    }),
  });
  const tokenData = await tokenResponse.json() as any;

  if (!tokenData.access_token) {
    throw new AppError(502, 'TIKTOK_TOKEN_EXCHANGE_FAILED', 'Failed to exchange TikTok authorization code', 'Imeshindwa kubadilisha nambari ya uidhinisho ya TikTok');
  }

  const userResponse = await fetch('https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const userData = await userResponse.json() as any;
  const userInfo = userData.data?.user || {};

  await prisma.socialMediaConnection.upsert({
    where: { restaurantId_platform: { restaurantId, platform: 'TIKTOK' } },
    update: {
      accountName: userInfo.display_name || 'TikTok Account',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in || 86400) * 1000),
      pageId: userInfo.open_id,
      isActive: true,
    },
    create: {
      restaurantId,
      platform: 'TIKTOK',
      accountName: userInfo.display_name || 'TikTok Account',
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      tokenExpiresAt: new Date(Date.now() + (tokenData.expires_in || 86400) * 1000),
      pageId: userInfo.open_id,
      isActive: true,
    },
  });

  const connection = await prisma.socialMediaConnection.findUnique({
    where: { restaurantId_platform: { restaurantId, platform: 'TIKTOK' } },
  });

  res.json({ success: true, data: { connection } });
}));

router.delete('/connect/:platform', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const platform = String(req.params.platform).toUpperCase();

  const validPlatforms = ['FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'TWITTER', 'WHATSAPP'];
  if (!validPlatforms.includes(platform)) {
    throw AppError.validation(`Invalid platform: ${platform}`, `Jukwaa batili: ${platform}`);
  }

  const connection = await prisma.socialMediaConnection.findUnique({
    where: { restaurantId_platform: { restaurantId, platform: platform as any } },
  });

  if (!connection) {
    throw new NotFoundError('Social media connection not found', 'Muunganisho wa mitandao ya kijamii haukupatikana');
  }

  await prisma.socialMediaConnection.delete({
    where: { id: connection.id },
  });

  res.json({ success: true, data: { message: `Disconnected from ${platform}` } });
}));

// ==================== POSTS ====================

router.get('/posts', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const { page, perPage, sortBy, sortOrder } = parsePagination(req.query as any);
  const status = req.query.status as string | undefined;
  const platform = req.query.platform as string | undefined;

  const where: any = { restaurantId };
  if (status) where.status = status;
  if (platform) where.platform = platform;

  const [posts, total] = await Promise.all([
    prisma.marketingPost.findMany({
      where,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.marketingPost.count({ where }),
  ]);

  res.json({
    success: true,
    data: posts,
    meta: buildPaginationMeta(total, page, perPage),
  });
}));

router.get('/posts/calendar', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;

  const posts = await prisma.marketingPost.findMany({
    where: {
      restaurantId,
      scheduledAt: { not: null },
    },
    select: {
      id: true,
      platform: true,
      contentText: true,
      contentTextSw: true,
      imageUrl: true,
      postType: true,
      status: true,
      scheduledAt: true,
    },
    orderBy: { scheduledAt: 'asc' },
  });

  const grouped: Record<string, { date: string; count: number; posts: typeof posts }> = {};
  for (const post of posts) {
    if (!post.scheduledAt) continue;
    const dateKey = post.scheduledAt.toISOString().split('T')[0];
    if (!grouped[dateKey]) {
      grouped[dateKey] = { date: dateKey, count: 0, posts: [] };
    }
    grouped[dateKey].count++;
    grouped[dateKey].posts.push(post);
  }

  res.json({ success: true, data: { posts: Object.values(grouped) } });
}));

router.post('/posts/create', validate(createPostSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const data = req.body as z.infer<typeof createPostSchema>;

  const connection = await prisma.socialMediaConnection.findUnique({
    where: { restaurantId_platform: { restaurantId, platform: data.platform } },
  });

  if (!connection || !connection.isActive) {
    throw new AppError(400, 'PLATFORM_NOT_CONNECTED', `${data.platform} is not connected. Connect it first.`, `${data.platform} haijaunganishwa. Unganisha kwanza.`);
  }

  let status: string = 'SCHEDULED';
  if (data.scheduledAt) {
    const scheduledDate = new Date(data.scheduledAt);
    if (scheduledDate <= new Date()) {
      status = 'FAILED';
    }
  }

  const post = await prisma.marketingPost.create({
    data: {
      restaurantId,
      platform: data.platform,
      contentText: data.contentText,
      contentTextSw: data.contentTextSw || null,
      imageUrl: data.imageUrl || null,
      postType: data.postType,
      status: status as any,
      scheduledAt: data.scheduledAt ? new Date(data.scheduledAt) : null,
    },
  });

  res.json({ success: true, data: post });
}));

router.post('/posts/ai-generate', validate(aiGenerateSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const data = req.body as z.infer<typeof aiGenerateSchema>;

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { id: true, name: true, cuisine: true, description: true, location: true },
  });

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found', 'Mgahawa haukupatikana');
  }

  const restaurantInfo = {
    name: restaurant.name,
    cuisine: restaurant.cuisine,
    description: restaurant.description,
    location: restaurant.location,
  };

  const postTypes: string[] = ['DAILY_SPECIAL', 'PROMOTION', 'ANNOUNCEMENT', 'ENGAGEMENT'];
  const status = data.autoApprove ? 'SCHEDULED' : 'DRAFT';
  const postsCreated: Array<{ id: string; platform: string }> = [];

  for (const platform of data.platforms) {
    const connection = await prisma.socialMediaConnection.findUnique({
      where: { restaurantId_platform: { restaurantId, platform } },
    });

    if (!connection || !connection.isActive) continue;

    try {
      const { generateSocialPost } = await import('../../integrations/openai');
      const postType = postTypes[Math.floor(Math.random() * postTypes.length)];

      const generated = await generateSocialPost(restaurantInfo, postType, platform.toLowerCase(), 'en');

      const scheduledTime = new Date();
      if (data.frequency === 'daily') {
        scheduledTime.setHours(scheduledTime.getHours() + 2);
      } else if (data.frequency === '2x') {
        scheduledTime.setHours(scheduledTime.getHours() + 6);
      } else {
        scheduledTime.setHours(scheduledTime.getHours() + 12);
      }

      const post = await prisma.marketingPost.create({
        data: {
          restaurantId,
          platform,
          contentText: generated.caption,
          imageUrl: generated.imageUrl || null,
          postType: 'CUSTOM',
          status: status as any,
          aiGenerated: true,
          scheduledAt: status === 'SCHEDULED' ? scheduledTime : null,
        },
      });

      postsCreated.push({ id: post.id, platform: post.platform });
    } catch (err) {
      logger.error('AI post generation failed for platform', { platform, error: err });
    }
  }

  const nextPostTime = new Date();
  nextPostTime.setHours(nextPostTime.getHours() + 2);

  res.json({
    success: true,
    data: {
      postsCreated: postsCreated.length,
      nextPostTime: nextPostTime.toISOString(),
      posts: postsCreated,
    },
  });
}));

router.put('/posts/:id/approve', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const postId = req.params.id;

  const post = await prisma.marketingPost.findFirst({
    where: { id: postId, restaurantId },
  });

  if (!post) {
    throw new NotFoundError('Post not found', 'Chapisho halikupatikana');
  }

  if (post.status !== 'DRAFT' && post.status !== 'SCHEDULED') {
    throw new AppError(400, 'INVALID_STATUS', 'Only DRAFT or SCHEDULED posts can be approved', 'Chapisho la DRAFT au SCHEDULED pekee linaweza kuidhinishwa');
  }

  const now = new Date();
  const shouldPublishNow = !post.scheduledAt || post.scheduledAt <= new Date(now.getTime() + 5 * 60 * 1000);

  await prisma.marketingPost.update({
    where: { id: postId },
    data: {
      approvedByOwner: true,
      status: shouldPublishNow ? 'PUBLISHED' : 'SCHEDULED',
      publishedAt: shouldPublishNow ? now : null,
    },
  });

  if (shouldPublishNow) {
    const connection = await prisma.socialMediaConnection.findUnique({
      where: { restaurantId_platform: { restaurantId, platform: post.platform } },
    });

    if (connection && connection.pageId) {
      try {
        if (post.platform === 'FACEBOOK') {
          const result = await metaIntegration.postToFacebook(connection.pageId, connection.accessToken, post.contentText, post.imageUrl || undefined);
          await prisma.marketingPost.update({
            where: { id: postId },
            data: { platformPostId: result.postId },
          });
        } else if (post.platform === 'INSTAGRAM' && post.imageUrl) {
          const result = await metaIntegration.postToInstagram(connection.pageId, connection.accessToken, post.imageUrl, post.contentText);
          await prisma.marketingPost.update({
            where: { id: postId },
            data: { platformPostId: result.mediaId },
          });
        }
      } catch (err: any) {
        logger.error('Failed to publish approved post immediately', { postId, error: err });
        await prisma.marketingPost.update({
          where: { id: postId },
          data: { status: 'FAILED' },
        });
      }
    }
  }

  res.json({ success: true, data: { id: postId, approved: true } });
}));

router.put('/posts/:id/edit', validate(editPostSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const postId = req.params.id;

  const post = await prisma.marketingPost.findFirst({
    where: { id: postId, restaurantId },
  });

  if (!post) {
    throw new NotFoundError('Post not found', 'Chapisho halikupatikana');
  }

  if (post.status !== 'DRAFT' && post.status !== 'SCHEDULED') {
    throw new AppError(400, 'INVALID_STATUS', 'Only DRAFT or SCHEDULED posts can be edited', 'Chapisho la DRAFT au SCHEDULED pekee linaweza kuhaririwa');
  }

  const data = req.body as z.infer<typeof editPostSchema>;
  const updateData: any = {};
  if (data.contentText !== undefined) updateData.contentText = data.contentText;
  if (data.contentTextSw !== undefined) updateData.contentTextSw = data.contentTextSw;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl;
  if (data.scheduledAt !== undefined) updateData.scheduledAt = new Date(data.scheduledAt);

  const changes: Record<string, { from: any; to: any }> = {};
  for (const key of Object.keys(updateData)) {
    changes[key] = { from: (post as any)[key], to: updateData[key] };
  }

  const updated = await prisma.marketingPost.update({
    where: { id: postId },
    data: updateData,
  });

  logger.info('Post edited', { postId, restaurantId, changes });

  res.json({ success: true, data: updated });
}));

router.delete('/posts/:id', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const postId = req.params.id;

  const post = await prisma.marketingPost.findFirst({
    where: { id: postId, restaurantId },
  });

  if (!post) {
    throw new NotFoundError('Post not found', 'Chapisho halikupatikana');
  }

  if (post.status !== 'DRAFT' && post.status !== 'SCHEDULED') {
    throw new AppError(400, 'INVALID_STATUS', 'Only DRAFT or SCHEDULED posts can be deleted', 'Chapisho la DRAFT au SCHEDULED pekee linaweza kufutwa');
  }

  await prisma.marketingPost.update({
    where: { id: postId },
    data: { status: 'CANCELLED' },
  });

  res.json({ success: true, data: { message: 'Post cancelled' } });
}));

router.post('/posts/:id/publish-now', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const postId = req.params.id;

  const post = await prisma.marketingPost.findFirst({
    where: { id: postId, restaurantId },
  });

  if (!post) {
    throw new NotFoundError('Post not found', 'Chapisho halikupatikana');
  }

  const connection = await prisma.socialMediaConnection.findUnique({
    where: { restaurantId_platform: { restaurantId, platform: post.platform } },
  });

  if (!connection || !connection.isActive) {
    throw new AppError(400, 'PLATFORM_NOT_CONNECTED', `${post.platform} is not connected`, `${post.platform} haijaunganishwa`);
  }

  let platformPostId: string | null = null;
  let url: string | null = null;

  if (post.platform === 'FACEBOOK') {
    const result = await metaIntegration.postToFacebook(connection.pageId!, connection.accessToken, post.contentText, post.imageUrl || undefined);
    platformPostId = result.postId;
    url = `https://facebook.com/${connection.pageId}/posts/${result.postId}`;
  } else if (post.platform === 'INSTAGRAM') {
    if (!post.imageUrl) {
      throw AppError.validation('Instagram posts require an image', 'Chapisho la Instagram linahitaji picha');
    }
    const result = await metaIntegration.postToInstagram(connection.pageId!, connection.accessToken, post.imageUrl, post.contentText);
    platformPostId = result.mediaId;
    url = `https://instagram.com/p/${result.mediaId}`;
  } else if (post.platform === 'WHATSAPP' && connection.pageId) {
    if (post.imageUrl) {
      await whatsappIntegration.sendImageMessage(connection.pageId, post.imageUrl, post.contentText);
    } else {
      await whatsappIntegration.sendTextMessage(connection.pageId, post.contentText);
    }
  }

  const now = new Date();
  await prisma.marketingPost.update({
    where: { id: postId },
    data: {
      status: 'PUBLISHED',
      publishedAt: now,
      platformPostId,
    },
  });

  res.json({
    success: true,
    data: {
      published: true,
      platformPostId,
      url,
      publishedAt: now,
    },
  });
}));

// ==================== ANALYTICS ====================

router.get('/analytics', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;

  const posts = await prisma.marketingPost.findMany({
    where: { restaurantId, status: 'PUBLISHED' },
  });

  const totalPosts = posts.length;
  const totalReach = posts.reduce((s, p) => s + (p.reach || 0), 0);
  const totalLikes = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments || 0), 0);
  const avgEngagement = totalReach > 0 ? ((totalLikes + totalComments) / totalReach) * 100 : 0;

  const byPlatform: Record<string, { posts: number; reach: number; likes: number; comments: number }> = {};
  for (const post of posts) {
    if (!byPlatform[post.platform]) {
      byPlatform[post.platform] = { posts: 0, reach: 0, likes: 0, comments: 0 };
    }
    byPlatform[post.platform].posts++;
    byPlatform[post.platform].reach += post.reach || 0;
    byPlatform[post.platform].likes += post.likes || 0;
    byPlatform[post.platform].comments += post.comments || 0;
  }

  const bestPost = posts.length > 0
    ? posts.reduce((best, p) => ((p.reach || 0) > (best.reach || 0) ? p : best), posts[0])
    : null;

  res.json({
    success: true,
    data: {
      totalPosts,
      totalReach,
      totalLikes,
      totalComments,
      avgEngagement: Math.round(avgEngagement * 100) / 100,
      byPlatform,
      bestPost: bestPost ? {
        id: bestPost.id,
        contentText: bestPost.contentText.substring(0, 200),
        platform: bestPost.platform,
        reach: bestPost.reach,
        likes: bestPost.likes,
        comments: bestPost.comments,
        publishedAt: bestPost.publishedAt,
      } : null,
    },
  });
}));

// ==================== WHATSAPP ====================

router.get('/whatsapp/subscribers', asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const { page, perPage } = parsePagination(req.query as any);

  const [subscribers, total] = await Promise.all([
    prisma.whatsappSubscriber.findMany({
      where: { restaurantId },
      orderBy: { subscribedAt: 'desc' },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.whatsappSubscriber.count({ where: { restaurantId } }),
  ]);

  res.json({
    success: true,
    data: subscribers,
    meta: buildPaginationMeta(total, page, perPage),
  });
}));

router.post('/whatsapp/broadcast', validate(broadcastSchema), asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  const restaurantId = (req as any).restaurantId;
  const { message, imageUrl, recipientType } = req.body as z.infer<typeof broadcastSchema>;

  const where: any = { restaurantId, isActive: true };
  if (recipientType === 'active') {
    where.isActive = true;
  }

  const subscribers = await prisma.whatsappSubscriber.findMany({
    where,
    select: { phone: true, name: true },
  });

  if (subscribers.length === 0) {
    throw new AppError(400, 'NO_SUBSCRIBERS', 'No active subscribers found', 'Hakuna waliojisajili wanaofanya kazi');
  }

  const BATCH_SIZE = 10;
  const BATCH_DELAY_MS = 1000;
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);

    const batchResults = await Promise.allSettled(
      batch.map(async (sub) => {
        try {
          if (imageUrl) {
            await whatsappIntegration.sendImageMessage(sub.phone, imageUrl, message);
          } else {
            await whatsappIntegration.sendTextMessage(sub.phone, message);
          }

          await prisma.smsLog.create({
            data: {
              restaurantId,
              phone: sub.phone,
              direction: 'OUTBOUND',
              message: `[WhatsApp Broadcast] ${message.substring(0, 500)}`,
              status: 'SENT',
            },
          });

          return 'sent';
        } catch (err) {
          logger.error('WhatsApp broadcast failed for subscriber', { phone: sub.phone, error: err });
          return 'failed';
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value === 'sent') sent++;
      else failed++;
    }

    if (i + BATCH_SIZE < subscribers.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  res.json({
    success: true,
    data: {
      total: subscribers.length,
      sent,
      failed,
    },
  });
}));

export default router;

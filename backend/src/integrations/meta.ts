import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

const GRAPH_API_BASE = 'https://graph.facebook.com/v21.0';
const MAX_RETRIES = 3;

let apiClient: AxiosInstance;

function getClient(): AxiosInstance {
  if (apiClient) return apiClient;

  apiClient = axios.create({
    baseURL: GRAPH_API_BASE,
    timeout: 15000,
  });

  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNABORTED') {
        throw new AppError(504, 'META_TIMEOUT', 'Meta API request timed out', 'Muda wa Meta API umeisha');
      }
      if (!error.response) {
        throw new AppError(502, 'META_NETWORK', 'Meta API unavailable', 'Meta API haipatikani');
      }
      const fbError = error.response.data?.error;
      if (fbError) {
        logger.error('Meta API error', { code: fbError.code, message: fbError.message, fbtrace_id: fbError.fbtrace_id });

        if (fbError.code === 190) {
          throw new AppError(401, 'META_TOKEN_EXPIRED', 'Facebook token expired', 'Token ya Facebook imeisha muda');
        }
        if (fbError.code === 4 || fbError.code === 17) {
          throw new AppError(429, 'META_RATE_LIMIT', 'Meta API rate limit exceeded', 'Kikomo cha Meta API kimezidiwa');
        }
        if (fbError.error_subcode === 1349191) {
          throw new AppError(429, 'META_RATE_LIMIT', 'Meta API rate limit exceeded', 'Kikomo cha Meta API kimezidiwa');
        }
      }
      throw error;
    }
  );

  return apiClient;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error instanceof AppError && error.statusCode !== 429) {
        if (attempt < MAX_RETRIES && error.statusCode >= 500) {
          await new Promise((r) => setTimeout(r, 1000 * attempt));
          continue;
        }
        throw error;
      }
      if (error instanceof AppError && error.statusCode === 429 && attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        logger.warn('Meta rate limit, retrying', { attempt, delay });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new AppError(502, 'META_RETRY_FAILED', 'Meta API failed after retries', 'Meta API imeshindwa baada ya majaribio');
}

export async function exchangeForLongLivedToken(shortLivedToken: string): Promise<string> {
  return withRetry(async () => {
    const client = getClient();
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;

    if (!appId || !appSecret) {
      throw new AppError(500, 'META_CONFIG_ERROR', 'Meta credentials not configured', 'Vitambulisho vya Meta havijasanidiwa');
    }

    const response = await client.get('/oauth/access_token', {
      params: {
        grant_type: 'fb_exchange_token',
        client_id: appId,
        client_secret: appSecret,
        fb_exchange_token: shortLivedToken,
      },
    });

    const token = response.data?.access_token;
    if (!token) {
      throw new AppError(502, 'META_TOKEN_EXCHANGE_FAILED', 'Failed to exchange token', 'Imeshindwa kubadilisha token');
    }

    return token;
  });
}

export async function refreshToken(token: string): Promise<string> {
  return withRetry(async () => {
    const client = getClient();
    const response = await client.get('/me', {
      params: {
        fields: 'id',
        access_token: token,
      },
    });

    if (!response.data?.id) {
      throw new AppError(401, 'META_TOKEN_INVALID', 'Token is invalid or expired', 'Token ni batili au imeisha muda');
    }

    const newToken = await exchangeForLongLivedToken(token);
    return newToken;
  });
}

export async function postToFacebook(
  pageId: string,
  token: string,
  message: string,
  imageUrl?: string
): Promise<{ postId: string }> {
  return withRetry(async () => {
    const client = getClient();
    let response;

    if (imageUrl) {
      response = await client.post(`/${pageId}/photos`, {
        url: imageUrl,
        caption: message,
        access_token: token,
      });
      return { postId: response.data?.id || '' };
    }

    response = await client.post(`/${pageId}/feed`, {
      message,
      access_token: token,
    });

    const postId = response.data?.id || '';
    if (!postId) {
      throw new AppError(502, 'META_POST_FAILED', 'Failed to post to Facebook', 'Imeshindwa kuchapisha kwenye Facebook');
    }

    return { postId };
  });
}

export async function postToInstagram(
  businessId: string,
  token: string,
  imageUrl: string,
  caption: string
): Promise<{ mediaId: string }> {
  return withRetry(async () => {
    const client = getClient();

    const mediaResponse = await client.post(`/${businessId}/media`, {
      image_url: imageUrl,
      caption: caption.substring(0, 2200),
      access_token: token,
    });

    const creationId = mediaResponse.data?.id;
    if (!creationId) {
      throw new AppError(502, 'META_INSTA_CREATION_FAILED', 'Failed to create Instagram media', 'Imeshindwa kuunda media ya Instagram');
    }

    const publishResponse = await client.post(`/${businessId}/media_publish`, {
      creation_id: creationId,
      access_token: token,
    });

    const mediaId = publishResponse.data?.id || '';
    if (!mediaId) {
      throw new AppError(502, 'META_INSTA_PUBLISH_FAILED', 'Failed to publish to Instagram', 'Imeshindwa kuchapisha kwenye Instagram');
    }

    return { mediaId };
  });
}

export async function scheduleFacebookPost(
  pageId: string,
  token: string,
  message: string,
  imageUrl: string,
  scheduledTime: string
): Promise<{ postId: string }> {
  return withRetry(async () => {
    const client = getClient();
    const scheduledTimestamp = Math.floor(new Date(scheduledTime).getTime() / 1000);

    if (scheduledTimestamp <= Math.floor(Date.now() / 1000)) {
      throw AppError.validation('Scheduled time must be in the future', 'Muda uliopangwa lazima uwe wa baadaye');
    }

    const payload: Record<string, any> = {
      message,
      access_token: token,
      published: false,
      scheduled_publish_time: scheduledTimestamp,
    };

    if (imageUrl) {
      payload.attached_media = [{ media_fbid: imageUrl }];
    }

    const response = await client.post(`/${pageId}/feed`, payload);

    const postId = response.data?.id || '';
    if (!postId) {
      throw new AppError(502, 'META_SCHEDULE_FAILED', 'Failed to schedule Facebook post', 'Imeshindwa kupanga chapisho la Facebook');
    }

    return { postId };
  });
}

export async function getPostInsights(
  postId: string,
  token: string
): Promise<{ reach: number; likes: number; comments: number; clicks: number }> {
  return withRetry(async () => {
    const client = getClient();

    const response = await client.get(`/${postId}/insights`, {
      params: {
        metric: 'post_impressions,post_engaged_users,post_clicks',
        access_token: token,
      },
    });

    const data = response.data?.data || [];
    const result: Record<string, number> = { reach: 0, likes: 0, comments: 0, clicks: 0 };

    for (const metric of data) {
      const value = metric.values?.[0]?.value || 0;
      switch (metric.name) {
        case 'post_impressions':
          result.reach = value;
          break;
        case 'post_engaged_users':
          result.likes = value;
          break;
        case 'post_clicks':
          result.clicks = value;
          break;
      }
    }

    const reactionsResponse = await client.get(`/${postId}`, {
      params: {
        fields: 'likes.summary(true).limit(0),comments.limit(0)',
        access_token: token,
      },
    });

    result.likes = reactionsResponse.data?.likes?.summary?.total_count || 0;
    result.comments = reactionsResponse.data?.comments?.length || 0;

    return {
      reach: result.reach,
      likes: result.likes,
      comments: result.comments,
      clicks: result.clicks,
    };
  });
}

export async function getPageAccessToken(
  pageId: string,
  userAccessToken: string
): Promise<string> {
  return withRetry(async () => {
    const client = getClient();
    const response = await client.get(`/${pageId}`, {
      params: {
        fields: 'access_token',
        access_token: userAccessToken,
      },
    });

    const pageToken = response.data?.access_token;
    if (!pageToken) {
      throw new AppError(403, 'META_PAGE_TOKEN_FAILED', 'Failed to get page access token. Ensure user is admin of page.', 'Imeshindwa kupata token ya ukurasa. Hakikisha mtumiaji ni msimamizi wa ukurasa.');
    }

    return pageToken;
  });
}

export async function getBusinessInfo(
  businessId: string,
  token: string
): Promise<{ id: string; name: string; username?: string; profile_picture_url?: string }> {
  return withRetry(async () => {
    const client = getClient();
    const response = await client.get(`/${businessId}`, {
      params: {
        fields: 'id,name,username,profile_picture_url',
        access_token: token,
      },
    });

    return response.data;
  });
}

export async function getInstagramBusinessAccounts(
  pageId: string,
  token: string
): Promise<Array<{ id: string; name: string; username: string }>> {
  return withRetry(async () => {
    const client = getClient();
    const response = await client.get(`/${pageId}`, {
      params: {
        fields: 'instagram_business_account{id,name,username}',
        access_token: token,
      },
    });

    const igAccount = response.data?.instagram_business_account;
    if (!igAccount) return [];

    return [igAccount];
  });
}

export default {
  exchangeForLongLivedToken,
  refreshToken,
  postToFacebook,
  postToInstagram,
  scheduleFacebookPost,
  getPostInsights,
  getPageAccessToken,
  getBusinessInfo,
  getInstagramBusinessAccounts,
};

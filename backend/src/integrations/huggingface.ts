import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import { config } from '../config';

const HF_API_BASE = 'https://api-inference.huggingface.co/models';
const TIMEOUT_MS = 30000;
const MAX_RETRIES = 2;

let apiClient: AxiosInstance;

function getClient(): AxiosInstance {
  if (apiClient) return apiClient;

  const apiKey = process.env.HUGGINGFACE_API_KEY || '';
  if (!apiKey) {
    throw new AppError(500, 'HF_CONFIG_ERROR', 'Hugging Face API key not configured');
  }

  apiClient = axios.create({
    baseURL: HF_API_BASE,
    timeout: TIMEOUT_MS,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === 'ECONNABORTED') {
        throw new AppError(504, 'HF_TIMEOUT', 'Hugging Face request timed out');
      }
      if (!error.response) {
        throw new AppError(502, 'HF_NETWORK', 'Hugging Face API unavailable');
      }
      if (error.response.status === 503) {
        logger.warn('HF model is loading...');
      }
      throw error;
    }
  );

  return apiClient;
}

async function withRetry<T>(fn: () => Promise<T>, fallback?: T): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      const isModelLoading = error?.response?.status === 503;
      if (isModelLoading && attempt < MAX_RETRIES) {
        const delay = 15000 * attempt;
        logger.warn('HF model loading, retrying', { attempt, delay });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      if (fallback !== undefined) {
        logger.warn('HF API call failed, using fallback', { error: error?.message });
        return fallback;
      }
      throw error;
    }
  }
  if (fallback !== undefined) return fallback;
  throw new AppError(502, 'HF_SERVICE_ERROR', 'Hugging Face service unavailable after retries');
}

export async function generateImage(
  prompt: string,
  itemName: string,
  modelId: string = 'black-forest-labs/FLUX.1-dev'
): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  return withRetry(async () => {
    const client = getClient();
    const enhancedPrompt = `Professional food photography of ${itemName}. ${prompt}. High resolution, studio lighting, appetizing presentation, shallow depth of field, 8K quality`;

    const response = await client.post(
      `/${modelId}`,
      { inputs: enhancedPrompt.substring(0, 500) },
      { responseType: 'arraybuffer', timeout: 60000 }
    );

    const base64Image = Buffer.from(response.data).toString('base64');
    const dataUri = `data:image/jpeg;base64,${base64Image}`;

    const { uploadImage } = await import('./cloudinary');
    const uploaded = await uploadImage(dataUri, `ai-generated/free`);

    logger.info('Hugging Face image generated', { modelId, prompt: prompt.substring(0, 100) });

    return { imageUrl: uploaded.url, thumbnailUrl: uploaded.thumbnailUrl };
  }, {
    imageUrl: '',
    thumbnailUrl: '',
  });
}

export async function generateImageWithMultipleModels(
  prompt: string,
  itemName: string
): Promise<{ imageUrl: string; thumbnailUrl: string; model: string }> {
  const models = [
    'black-forest-labs/FLUX.1-dev',
    'stabilityai/stable-diffusion-3.5-large',
    'stabilityai/stable-diffusion-xl-base-1.0',
    'prompthero/openjourney-v4',
  ];

  for (const model of models) {
    try {
      const result = await generateImage(prompt, itemName, model);
      if (result.imageUrl) {
        return { ...result, model };
      }
    } catch (error) {
      logger.warn(`HF model ${model} failed, trying next`, { error: (error as any)?.message });
      continue;
    }
  }

  throw new AppError(502, 'ALL_HF_MODELS_FAILED', 'All Hugging Face image models failed');
}

export async function generateVideo(
  prompt: string,
  duration: number = 5
): Promise<{ videoUrl: string }> {
  return withRetry(async () => {
    const client = getClient();
    const modelId = 'tencent/HunyuanVideo';

    const response = await client.post(
      `/${modelId}`,
      {
        inputs: prompt,
        parameters: { duration, fps: 24 },
      },
      { timeout: 120000 }
    );

    const responseData = response.data;

    if (Buffer.isBuffer(responseData)) {
      const base64Video = Buffer.from(responseData).toString('base64');
      return { videoUrl: `data:video/mp4;base64,${base64Video}` };
    }

    if (responseData?.video?.url) {
      return { videoUrl: responseData.video.url };
    }

    throw new AppError(502, 'HF_VIDEO_FAILED', 'Failed to generate video with HF');
  }, {
    videoUrl: '',
  });
}

export async function getAvailableModels(): Promise<string[]> {
  try {
    const client = getClient();
    const response = await client.get('', {
      headers: { Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}` },
    });
    return response.data || [];
  } catch {
    return [
      'black-forest-labs/FLUX.1-dev',
      'stabilityai/stable-diffusion-3.5-large',
      'stabilityai/stable-diffusion-xl-base-1.0',
      'tencent/HunyuanVideo',
    ];
  }
}

export default {
  generateImage,
  generateImageWithMultipleModels,
  generateVideo,
  getAvailableModels,
};

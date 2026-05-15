import OpenAI from 'openai';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';
import { config } from '../config';

const MAX_RETRIES = 3;
const TIMEOUT_MS = 15000;
const MAX_TOKENS_CHAT = 500;
const MAX_TOKENS_DESCRIPTION = 300;
const MAX_HISTORY_MESSAGES = 20;

let aiClient: OpenAI | null = null;

const AI_MODEL = config.aiProvider === 'deepseek' ? config.deepseekModel : 'gpt-4o';
const AI_BASE_URL = config.aiProvider === 'deepseek' ? 'https://api.deepseek.com/v1' : undefined;

function getClient(): OpenAI {
  if (aiClient) return aiClient;

  const apiKey = config.deepseekApiKey;
  if (!apiKey) {
    throw new AppError(500, 'AI_CONFIG_ERROR', 'AI API key not configured', 'Ufunguo wa AI haujasanidiwa');
  }

  aiClient = new OpenAI({
    apiKey,
    baseURL: AI_BASE_URL,
    timeout: TIMEOUT_MS,
    maxRetries: 2,
  });

  return aiClient;
}

async function withRetry<T>(fn: () => Promise<T>, fallback?: T): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      if (error instanceof AppError) throw error;

      const isRateLimit = error?.status === 429;
      const isTimeout = error?.code === 'ECONNABORTED' || error?.message?.includes('timeout');
      const isServerError = error?.status >= 500;

      if (isRateLimit && attempt < MAX_RETRIES) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
        logger.warn('OpenAI rate limited, retrying', { attempt, delay });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if ((isTimeout || isServerError) && attempt < MAX_RETRIES) {
        const delay = 1000 * attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (fallback !== undefined) {
        logger.warn('OpenAI call failed, using fallback', { error: error?.message });
        return fallback;
      }

      throw new AppError(502, 'AI_SERVICE_ERROR', error?.message || 'AI service unavailable', 'Huduma ya AI haipatikani');
    }
  }

  if (fallback !== undefined) return fallback;
  throw new AppError(502, 'AI_SERVICE_ERROR', 'AI service unavailable after retries', 'Huduma ya AI haipatikani baada ya majaribio');
}

function buildCustomerChatSystemPrompt(language: string, menuContext: string, faqContext: string): string {
  const lang = language === 'sw' ? 'Swahili' : 'English';
  return `You are a helpful restaurant assistant for MenuMoja. Respond in ${lang}.

Menu Context:
${menuContext || 'No menu context provided.'}

FAQ Context:
${faqContext || 'No FAQ context provided.'}

Guidelines:
- Be friendly, concise, and helpful
- If asked about menu items, reference the menu context
- If asked about common questions, reference the FAQ context
- If you don't know something, say so politely
- Suggest items based on user preferences when possible
- Keep responses under 200 words
- If the user wants to order, guide them through the process
- Do not make up information not in the provided context`;
}

function buildOwnerSetupSystemPrompt(step: string): string {
  return `You are a restaurant setup assistant for MenuMoja. Help restaurant owners configure their account.

Current setup step: ${step}

Available steps: business_info, menu_setup, payment_config, branding, social_media, review

Guidelines:
- Guide the owner step by step through restaurant setup
- Collect all necessary information for each step
- Be encouraging and supportive
- Provide clear instructions
- When a step is complete, return an action object with the collected data
- Keep responses under 200 words`;
}

function buildImageAnalysisPrompt(): string {
  return `You are a food quality and safety inspector. Analyze the image for:
1. Food quality issues (undercooked, burnt, spoiled, etc.)
2. Portion size concerns
3. Presentation issues
4. Foreign objects or contaminants
5. Packaging issues
6. Overall appearance rating

Return your analysis as structured data with anomaly type, confidence level, and description.`;
}

function buildSocialPostPrompt(postType: string, platform: string): string {
  const platformGuidelines: Record<string, string> = {
    instagram: 'Use emojis, hashtags (5-10), engaging caption, casual tone',
    facebook: 'Conversational tone, 1-2 hashtags, include call-to-action',
    twitter: 'Under 280 characters, concise, 1-2 hashtags',
    whatsapp: 'Friendly, direct, include emojis, include contact info',
  };

  return `You are a social media manager for a restaurant. Generate a ${postType} post for ${platform}.

Guidelines:
${platformGuidelines[platform] || 'Engaging and professional tone'}
- Do not use placeholders like [Restaurant Name]
- Include relevant emoji
- Keep it authentic and appealing
- Focus on food and customer experience`;
}

function trimConversationHistory(
  messages: Array<{ role: string; content: string }>,
  maxMessages: number = MAX_HISTORY_MESSAGES
): Array<{ role: 'system' | 'user' | 'assistant'; content: string }> {
  if (messages.length <= maxMessages) return messages as any;

  const systemMsg = messages[0]?.role === 'system' ? messages[0] : null;
  const recentMessages = messages.slice(-maxMessages);
  if (systemMsg && recentMessages[0]?.role !== 'system') {
    recentMessages.unshift(systemMsg as any);
  }
  return recentMessages as any;
}

export async function customerChat(
  restaurantId: string,
  messages: Array<{ role: string; content: string }>,
  language: string,
  menuContext: string,
  faqContext: string
): Promise<{
  reply: string;
  suggestedItems: string[];
  quickReplies: string[];
}> {
  return withRetry(async () => {
    const client = getClient();
    const systemPrompt = buildCustomerChatSystemPrompt(language, menuContext, faqContext);
    const trimmedMessages = trimConversationHistory([
      { role: 'system', content: systemPrompt } as any,
      ...messages.slice(-30),
    ]);

    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: trimmedMessages as any,
      max_tokens: MAX_TOKENS_CHAT,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content || 'Sorry, I could not process that. Please try again.';

    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: 'Extract up to 3 menu item names from the conversation that the user might like. Return as comma-separated list. If none, return "NONE".' },
        { role: 'user', content: `User message: ${messages[messages.length - 1]?.content}\nAssistant reply: ${reply}` },
      ],
      max_tokens: 100,
      temperature: 0.3,
    });

    const suggestedText = completion.choices[0]?.message?.content || 'NONE';
    const suggestedItems = suggestedText === 'NONE'
      ? []
      : suggestedText.split(',').map((s) => s.trim()).filter(Boolean);

    const quickReplies = ['View Menu', 'Place Order', 'Contact Restaurant', 'Operating Hours', 'Specials'];

    return { reply, suggestedItems, quickReplies };
  }, {
    reply: 'Sorry, I am having trouble connecting. Please try again in a moment.',
    suggestedItems: [],
    quickReplies: ['View Menu', 'Place Order', 'Contact Restaurant'],
  });
}

export async function ownerSetupChat(
  restaurantId: string,
  messages: Array<{ role: string; content: string }>,
  step: string
): Promise<{
  reply: string;
  action?: { type: string; data: Record<string, unknown> };
}> {
  return withRetry(async () => {
    const client = getClient();
    const systemPrompt = buildOwnerSetupSystemPrompt(step);
    const allMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10),
    ] as any;

    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: allMessages,
      max_tokens: MAX_TOKENS_CHAT,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    let parsed: any;

    try {
      parsed = JSON.parse(content);
    } catch {
      return {
        reply: content,
        action: undefined,
      };
    }

    return {
      reply: parsed.reply || content,
      action: parsed.action || undefined,
    };
  }, {
    reply: 'I apologize, but I am having trouble processing your request. Please try again.',
    action: undefined,
  });
}

export async function generateDescription(
  itemName: string,
  ingredients: string[],
  style?: string
): Promise<{ english: string; swahili: string }> {
  return withRetry(async () => {
    const client = getClient();
    const styleHint = style ? `Write in a ${style} style.` : '';

    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: `Generate a short appetizing menu item description in English and Swahili. ${styleHint}
Return as JSON: { "english": "...", "swahili": "..." }
Keep each under 50 words. Be specific about the ingredients.`,
        },
        {
          role: 'user',
          content: `Item: ${itemName}\nIngredients: ${ingredients.join(', ')}`,
        },
      ],
      max_tokens: MAX_TOKENS_DESCRIPTION,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      english: parsed.english || `Delicious ${itemName} made with ${ingredients.slice(0, 3).join(', ')}.`,
      swahili: parsed.swahili || `${itemName} tamu iliyotengenezwa kwa ${ingredients.slice(0, 3).join(', ')}.`,
    };
  }, {
    english: `Delicious ${itemName} made with fresh ingredients.`,
    swahili: `${itemName} tamu iliyotengenezwa kwa viungo safi.`,
  });
}

export async function generateRestaurantDescription(
  name: string,
  cuisine: string,
  location: string
): Promise<{ english: string; swahili: string }> {
  return withRetry(async () => {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Generate a short appealing restaurant description in English and Swahili. Return as JSON: { "english": "...", "swahili": "..." }. Keep each under 60 words.',
        },
        {
          role: 'user',
          content: `Restaurant: ${name}\nCuisine: ${cuisine}\nLocation: ${location}`,
        },
      ],
      max_tokens: MAX_TOKENS_DESCRIPTION,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      english: parsed.english || `${name} serves delicious ${cuisine} cuisine in ${location}.`,
      swahili: parsed.swahili || `${name} inatoa vyakula vitamu vya ${cuisine} huko ${location}.`,
    };
  }, {
    english: `${name} offers authentic ${cuisine} cuisine in ${location}.`,
    swahili: `${name} inatoa vyakula halisi vya ${cuisine} huko ${location}.`,
  });
}

export async function generateImage(
  prompt: string,
  itemName: string
): Promise<{ imageUrl: string; thumbnailUrl: string }> {
  return withRetry(async () => {
    const client = getClient();
    const enhancedPrompt = `Professional food photography of ${itemName}. ${prompt}. High resolution, studio lighting, appetizing presentation, shallow depth of field.`;

    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt: enhancedPrompt.substring(0, 1000),
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    const imageUrl = response.data?.[0]?.url;
    if (!imageUrl) {
      throw new AppError(502, 'AI_IMAGE_FAILED', 'Failed to generate image', 'Imeshindwa kutengeneza picha');
    }

    return { imageUrl, thumbnailUrl: imageUrl };
  }, {
    imageUrl: '',
    thumbnailUrl: '',
  });
}

export async function analyzeCameraImage(
  imageUrl: string
): Promise<{ anomalies: Array<{ type: string; confidence: number; description: string }> }> {
  return withRetry(async () => {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: buildImageAnalysisPrompt(),
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Analyze this food image for any quality issues or anomalies:' },
            { type: 'image_url', image_url: { url: imageUrl } },
          ] as any,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });

    const content = response.choices[0]?.message?.content || '{}';

    const completion = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Extract anomalies from the analysis. Return as JSON: { "anomalies": [{ "type": "FOOD_QUALITY|PORTION|PRESENTATION|CONTAMINANT|PACKAGING|OTHER", "confidence": 0.0-1.0, "description": "..." }] }. If no issues, return empty array.',
        },
        { role: 'user', content },
      ],
      max_tokens: 300,
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const jsonContent = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(jsonContent);

    return {
      anomalies: parsed.anomalies || [],
    };
  }, {
    anomalies: [],
  });
}

export async function generateSocialPost(
  restaurantInfo: Record<string, any>,
  postType: string,
  platform: string,
  language: string
): Promise<{ caption: string; imageUrl: string; hashtags: string }> {
  return withRetry(async () => {
    const client = getClient();
    const infoStr = JSON.stringify(restaurantInfo, null, 2);
    const systemPrompt = buildSocialPostPrompt(postType, platform);

    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Restaurant Info: ${infoStr}\n\nPost Type: ${postType}\nPlatform: ${platform}\nLanguage: ${language === 'sw' ? 'Swahili' : 'English'}\n\nGenerate a social post with caption and hashtags. Return as JSON: { "caption": "...", "hashtags": "#tag1 #tag2 #tag3" }`,
        },
      ],
      max_tokens: 400,
      temperature: 0.8,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    const caption = parsed.caption || `Check out ${restaurantInfo.name || 'our restaurant'}!`;
    const hashtags = parsed.hashtags || '#MenuMoja #FoodKenya';

    const imageResponse = await client.images.generate({
      model: 'dall-e-3',
      prompt: `Social media post for restaurant: ${caption.substring(0, 300)}`,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    });

    return {
      caption,
      imageUrl: imageResponse.data?.[0]?.url || '',
      hashtags,
    };
  }, {
    caption: `Check out ${restaurantInfo.name || 'our restaurant'} for amazing food!`,
    imageUrl: '',
    hashtags: '#MenuMoja #FoodKenya',
  });
}

export async function generateFAQSuggestions(
  restaurantType: string,
  cuisine: string
): Promise<Array<{ question: string; answer: string }>> {
  return withRetry(async () => {
    const client = getClient();
    const response = await client.chat.completions.create({
      model: AI_MODEL,
      messages: [
        {
          role: 'system',
          content: 'Generate 5-8 frequently asked questions and answers for a restaurant. Return as JSON: { "faqs": [{ "question": "...", "answer": "..." }] }. Answers should be concise and helpful.',
        },
        {
          role: 'user',
          content: `Restaurant Type: ${restaurantType}\nCuisine: ${cuisine}`,
        },
      ],
      max_tokens: 800,
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return parsed.faqs || [
      { question: 'What are your operating hours?', answer: 'Please check our restaurant page for current hours.' },
      { question: 'Do you offer delivery?', answer: 'Yes, we offer delivery within our service area.' },
      { question: 'Can I make a reservation?', answer: 'Yes, you can book through our website or app.' },
    ];
  }, [
    { question: 'What are your operating hours?', answer: 'Please check our restaurant page for current hours.' },
    { question: 'Do you offer delivery?', answer: 'Yes, we offer delivery within our service area.' },
    { question: 'Can I make a reservation?', answer: 'Yes, you can book through our website or app.' },
  ]);
}

export async function streamCustomerChat(
  restaurantId: string,
  messages: Array<{ role: string; content: string }>,
  language: string,
  menuContext: string,
  faqContext: string,
  onChunk: (chunk: string) => void
): Promise<void> {
  const client = getClient();
  const systemPrompt = buildCustomerChatSystemPrompt(language, menuContext, faqContext);
  const trimmedMessages = trimConversationHistory([
    { role: 'system', content: systemPrompt } as any,
    ...messages.slice(-30),
  ]);

  try {
    const stream = await client.chat.completions.create({
      model: AI_MODEL,
      messages: trimmedMessages as any,
      max_tokens: MAX_TOKENS_CHAT,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || '';
      if (content) onChunk(content);
    }
  } catch (error) {
    logger.error('Stream chat failed', { error });
    onChunk('Sorry, I am having trouble connecting. Please try again.');
  }
}

export default {
  customerChat,
  ownerSetupChat,
  generateDescription,
  generateRestaurantDescription,
  generateImage,
  analyzeCameraImage,
  generateSocialPost,
  generateFAQSuggestions,
  streamCustomerChat,
};

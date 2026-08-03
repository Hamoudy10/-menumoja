import rateLimit from 'express-rate-limit';
import { RateLimitError } from '../utils/errors';
import { Request } from 'express';

const skipInTest = (req: Request): boolean => {
  return process.env.NODE_ENV === 'test';
};

const standardResponse = {
  message: 'Too many requests, please try again later',
  messageSwahili: 'Maombi mengi sana, tafadhali jaribu tena baadaye',
};

function generateKey(req: Request): string {
  const restaurantId = (req as any).restaurantId || req.body?.restaurantId || req.query?.restaurantId;
  if (restaurantId) return `rl:restaurant:${restaurantId}`;
  return `rl:ip:${req.ip}`;
}

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  keyGenerator: (req) => generateKey(req),
  handler: (_req, _res) => {
    throw new RateLimitError(
      standardResponse.message,
      standardResponse.messageSwahili
    );
  },
});

export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  keyGenerator: (req) => `rl:auth:${req.ip}`,
  handler: (_req, _res) => {
    throw new RateLimitError(
      'Too many authentication attempts. Please try again later.',
      'Majaribio mengi ya kuingia. Tafadhali jaribu tena baadaye.'
    );
  },
});

export const aiChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  keyGenerator: (req) => {
    const userId = (req as any).user?.userId || req.ip;
    return `rl:ai:${userId}`;
  },
  handler: (_req, _res) => {
    throw new RateLimitError(
      'AI chat rate limit reached. Please wait before sending more messages.',
      'Kikomo cha mazungumzo ya AI kimefikiwa. Tafadhali subiri kabla ya kutuma ujumbe zaidi.'
    );
  },
});

export const mpesaLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  keyGenerator: (req) => {
    const restaurantId = (req as any).user?.restaurantId || req.body?.restaurantId || req.ip;
    return `rl:mpesa:${restaurantId}`;
  },
  handler: (_req, _res) => {
    throw new RateLimitError(
      'M-Pesa transaction limit reached. Please try again later.',
      'Kikomo cha miamala ya M-Pesa kimefikiwa. Tafadhali jaribu tena baadaye.'
    );
  },
});

export const orderCreateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 6,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipInTest,
  keyGenerator: (req) => {
    const sessionId = (req.body as any)?.sessionId;
    const restaurantId = (req.body as any)?.restaurantId;
    const key = sessionId ? `rl:order:${restaurantId || 'any'}:${sessionId}` : `rl:order:${req.ip}`;
    return key;
  },
  handler: (_req, _res) => {
    throw new RateLimitError(
      'Too many orders in a short time. Please wait a moment.',
      'Agizo nyingi sana kwa muda mfupi. Tafadhali subiri muda kidogo.'
    );
  },
});

import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import QRCode from 'qrcode';
import sharp from 'sharp';
import PDFDocument from 'pdfkit';
import { asyncHandler, AppError } from '@/utils';
import { authenticate, enforceRestaurantScope, auditLog } from '@/middleware';
import { prisma } from '@/config/database';
import { uploadImage } from '@/integrations/cloudinary';
import logger from '@/utils/logger';

const router = Router();

export const publicQrRoutes = Router();

export default router;

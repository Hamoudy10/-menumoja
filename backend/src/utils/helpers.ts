import slugifyLib from 'slugify';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from './errors';

const SERVICE_CHARGE_RATE = 0.05;
const TAX_RATE = 0.16;

export function generateOrderNumber(restaurantId: string): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = uuidv4().split('-')[0].toUpperCase();
  const shortId = restaurantId.slice(-4).toUpperCase();
  return `ORD-${shortId}-${timestamp}-${random}`;
}

export function generateReceiptNumber(restaurantId: string): string {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  const random = uuidv4().split('-')[0].toUpperCase().slice(0, 6);
  const shortId = restaurantId.slice(-4).toUpperCase();
  return `RCP-${shortId}-${datePart}-${random}`;
}

export function generateSlug(name: string): string {
  return slugifyLib(name, {
    lower: true,
    strict: true,
    trim: true,
  });
}

export function formatKES(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return 'KES 0';
  }
  const formatted = Math.abs(amount).toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `KES ${amount < 0 ? '-' : ''}${formatted}`;
}

export function calculateTotals(
  items: { price: number; quantity: number }[]
): { subtotal: number; serviceCharge: number; tax: number; total: number } {
  if (!items || items.length === 0) {
    return { subtotal: 0, serviceCharge: 0, tax: 0, total: 0 };
  }

  // Menu prices are VAT-INCLUSIVE (displayed price is the final price).
  // VAT is derived as the portion embedded in the price (16/116),
  // never added on top — so the cashier charge matches the menu price.
  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );
  const serviceCharge = subtotal * SERVICE_CHARGE_RATE;
  const tax = (subtotal * TAX_RATE) / (1 + TAX_RATE);
  const total = subtotal + serviceCharge;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    serviceCharge: Math.round(serviceCharge * 100) / 100,
    tax: Math.round(tax * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

export function generatePin(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const SANITIZE_REGEX = /<[^>]*>|javascript:|on\w+\s*=|onerror|onclick|onload|onsubmit|onmouseover|onfocus|onblur|onchange|onscroll|ondblclick|onkeydown|onkeypress|onkeyup/gi;

export function sanitizeHtml(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(SANITIZE_REGEX, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  if (!Array.isArray(arr) || size < 1) return [];
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function isValidUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export function maskPhone(phone: string): string {
  if (!phone || phone.length < 8) return phone;
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

export function maskEmail(email: string): string {
  if (!email || !email.includes('@')) return email;
  const [local, domain] = email.split('@');
  const maskedLocal = local.length <= 2 ? local : local[0] + '***' + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}

export function parsePagination(query: {
  page?: string | number;
  perPage?: string | number;
  sortBy?: string;
  sortOrder?: string;
}): { page: number; perPage: number; sortBy: string; sortOrder: 'asc' | 'desc' } {
  const page = Math.max(1, Number(query.page) || 1);
  const perPage = Math.min(100, Math.max(1, Number(query.perPage) || 20));
  const sortBy = query.sortBy || 'createdAt';
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc';
  return { page, perPage, sortBy, sortOrder };
}

export function buildPaginationMeta(total: number, page: number, perPage: number) {
  return {
    total,
    page,
    perPage,
    totalPages: Math.ceil(total / perPage),
    hasNext: page * perPage < total,
    hasPrev: page > 1,
  };
}

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { AppError } from './errors';

const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }
  const hash = crypto.createHash('sha256').update(key).digest();
  return hash;
}

export function encrypt(text: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    throw new AppError(500, 'ENCRYPTION_ERROR', 'Failed to encrypt data', 'Hitilafu ya kusimba data');
  }
}

export function decrypt(encrypted: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encrypted.split(':');
    if (parts.length !== 2) {
      throw new AppError(500, 'DECRYPTION_ERROR', 'Invalid encrypted format', 'Fomati batili ya data iliyosimbwa');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const encryptedText = parts[1];
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(500, 'DECRYPTION_ERROR', 'Failed to decrypt data', 'Hitilafu ya kusomoa data');
  }
}

export async function hashPassword(password: string): Promise<string> {
  try {
    const salt = await bcrypt.genSalt(12);
    return bcrypt.hash(password, salt);
  } catch (error) {
    throw new AppError(500, 'HASH_ERROR', 'Failed to hash password', 'Hitilafu ya kusimba neno la siri');
  }
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  try {
    return bcrypt.compare(password, hash);
  } catch (error) {
    throw new AppError(500, 'COMPARE_ERROR', 'Failed to compare passwords', 'Hitilafu ya kulinganisha nywila');
  }
}

export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

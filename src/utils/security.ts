export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
}

export function validatePhone(phone: string): boolean {
  return /^(\+254|0)[17]\d{8}$/.test(phone.replace(/\s/g, ''))
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validatePassword(password: string): {
  valid: boolean
  strength: 'weak' | 'medium' | 'strong'
  message: string
} {
  const hasLower = /[a-z]/.test(password)
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /\d/.test(password)
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password)
  const length = password.length >= 8

  const score = [hasLower, hasUpper, hasNumber, hasSpecial, length].filter(Boolean).length

  if (length && score >= 4) return { valid: true, strength: 'strong', message: 'Strong password' }
  if (length && score >= 3) return { valid: true, strength: 'medium', message: 'Medium strength password' }
  if (password.length === 0) return { valid: false, strength: 'weak', message: '' }
  return { valid: false, strength: 'weak', message: 'Must be 8+ chars with uppercase, number & special character' }
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\d{3})\d{4}(\d{3})/, '$1****$2')
}

export function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

export function rateLimitKey(ip: string, action: string): string {
  return `rl:${ip}:${action}`
}

export const CSP_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob: https:",
    "connect-src 'self' https: wss:",
    "frame-src 'self' https://www.google.com",
    "base-uri 'self'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',
}

/**
 * Kenyan phone number helpers.
 *
 * Customer identity is keyed by `Customer.phone`, and the same person can
 * reach us through QR orders (`+254...`), POS (`0712...`), reservations or
 * M-Pesa callbacks (`254...`). All customer-facing writes therefore store the
 * canonical MSISDN form (`2547XXXXXXXX` / `2541XXXXXXXX`) and queries fall
 * back to the legacy variants that may already exist in the database.
 */

const KENYAN_MOBILE_RE = /^254(7|1)\d{8}$/;

/**
 * Returns the canonical `254XXXXXXXXX` form, or null when the input is not a
 * valid Kenyan mobile number. Accepts `+254`, `254`, `00254`, `0`-prefixed and
 * bare 9-digit numbers, with spaces, dashes, dots or brackets.
 */
export function normalizeKenyanPhone(input: string | null | undefined): string | null {
  if (input === null || input === undefined) return null;

  let value = String(input).trim();
  if (!value) return null;

  value = value.replace(/[\s().-]/g, '');
  if (value.startsWith('+')) value = value.slice(1);
  if (value.startsWith('00')) value = value.slice(2);

  if (value.startsWith('2540') && value.length === 13) {
    // 254 0 712... -> 254712...
    value = `254${value.slice(4)}`;
  } else if (value.startsWith('0')) {
    value = `254${value.slice(1)}`;
  } else if (/^[71]\d{8}$/.test(value)) {
    value = `254${value}`;
  }

  if (!KENYAN_MOBILE_RE.test(value)) return null;
  return value;
}

/**
 * Every stored representation we may have written before normalisation was
 * centralised. Always includes the raw value so exact legacy matches still
 * work. De-duplicated and safe for a Prisma `{ in: [...] }` filter.
 */
export function phoneQueryVariants(input: string | null | undefined): string[] {
  if (input === null || input === undefined) return [];
  const raw = String(input).trim();
  const normalized = normalizeKenyanPhone(raw);
  const variants: string[] = [];

  if (normalized) {
    const subscriber = normalized.slice(3);
    variants.push(
      normalized,
      `+${normalized}`,
      `0${subscriber}`,
      subscriber,
      `00${normalized}`,
      `2540${subscriber}`
    );
  }

  if (raw) variants.push(raw);
  if (!normalized) {
    const digits = raw.replace(/\D/g, '');
    if (digits) variants.push(digits);
  }

  return [...new Set(variants.filter(Boolean))];
}

/** Formats a canonical number for display/integrations. */
export function toKenyanE164(input: string | null | undefined): string | null {
  const normalized = normalizeKenyanPhone(input);
  return normalized ? `+${normalized}` : null;
}

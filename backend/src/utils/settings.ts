import { maskSecret } from './encryption';

/**
 * Response shaping for RestaurantSettings.
 *
 * The settings row mixes public branding/commerce flags with private payment
 * credentials. It must never be serialized wholesale:
 * - the public menu endpoint is a whitelist of customer-safe fields;
 * - the owner endpoint includes everything except secrets, and reports only
 *   whether a secret is configured (`mpesaPasskeySet`).
 */

const PUBLIC_SETTINGS_FIELDS = [
  'primaryColor',
  'secondaryColor',
  'fontFamily',
  'gradientStart',
  'gradientEnd',
  'useGradient',
  'headingFont',
  'bodyFont',
  'accentFont',
  'layoutStyle',
  'welcomeMessage',
  'welcomeMessageSw',
  'announcement',
  'announcementActive',
  'languageEnglish',
  'languageSwahili',
  'languageArabic',
  'showPrices',
  'allowOrdering',
  'allowCashPayment',
  'allowMpesaPayment',
  'tipEnabled',
  'tipPercentages',
  'serviceChargePercent',
  'taxPercent',
] as const;

export function toPublicSettings(settings: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!settings) return null;
  const shaped: Record<string, unknown> = {};
  for (const field of PUBLIC_SETTINGS_FIELDS) {
    if (settings[field] !== undefined) shaped[field] = settings[field];
  }
  return shaped;
}

export function toOwnerSettings(settings: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!settings) return null;
  const { mpesaPasskey, ...rest } = settings as Record<string, unknown>;
  return {
    ...rest,
    mpesaPasskeySet: Boolean(mpesaPasskey),
    // A masked placeholder is never used as a value; it only lets the UI show
    // that a passkey already exists without revealing it.
    mpesaPasskeyMasked: maskSecret(mpesaPasskey as string | undefined),
  };
}

export default { toPublicSettings, toOwnerSettings };

/**
 * One-off backfill: encrypt any M-Pesa passkeys that were stored as plaintext
 * before encryption-at-rest was introduced.
 *
 * Safe to run repeatedly: already-encrypted values (enc:v1:*) are skipped.
 *
 * Usage (from backend/):  npm run db:encrypt-secrets
 * Requires ENCRYPTION_KEY to be set (must match the value the app runs with).
 */
import dotenv from 'dotenv';
dotenv.config();

import { prisma } from '../src/config/database';
import { encryptSecret, isEncryptedSecret } from '../src/utils/encryption';

async function main(): Promise<void> {
  const rows = await prisma.restaurantSettings.findMany({
    where: { mpesaPasskey: { not: null } },
    select: { id: true, restaurantId: true, mpesaPasskey: true },
  });

  let updated = 0;
  for (const row of rows) {
    if (!row.mpesaPasskey || isEncryptedSecret(row.mpesaPasskey)) continue;
    await prisma.restaurantSettings.update({
      where: { id: row.id },
      data: { mpesaPasskey: encryptSecret(row.mpesaPasskey) },
    });
    updated += 1;
  }

  console.log(`Encrypted ${updated} M-Pesa passkey(s); ${rows.length - updated} already encrypted or empty.`);
}

main()
  .catch((error) => {
    console.error('Secret backfill failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });

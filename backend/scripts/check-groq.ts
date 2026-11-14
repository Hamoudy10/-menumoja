/**
 * Diagnostic: verify the Groq Whisper configuration end-to-end.
 *
 * Usage (from backend/):
 *   npx tsx scripts/check-groq.ts <path-to-audio-file>
 *
 * The API key is never printed. This hits the same integration used by
 * POST /api/v1/ai/command/transcribe.
 */
import dotenv from 'dotenv';
dotenv.config();

import fs from 'fs';
import path from 'path';
import { isTranscriptionConfigured, transcribeAudio } from '../src/integrations/groq';

async function main(): Promise<void> {
  if (!isTranscriptionConfigured()) {
    console.error('GROQ_API_KEY is not configured.');
    process.exitCode = 1;
    return;
  }

  const file = process.argv[2];
  if (!file) {
    console.error('Usage: npx tsx scripts/check-groq.ts <path-to-audio-file>');
    process.exitCode = 1;
    return;
  }

  const audio = fs.readFileSync(file);
  const result = await transcribeAudio(audio, path.basename(file), {
    language: 'en',
    prompt:
      'Menu Moja restaurant command. menu, order, table, waiter, stock, price, ' +
      'available, unavailable, sales, chakula, meza, mhudumu, oda, bei, stock',
  });

  console.log('Groq Whisper provider:', result.provider);
  console.log('Transcription:', JSON.stringify(result.text));
}

main().catch((error) => {
  console.error('Groq check failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

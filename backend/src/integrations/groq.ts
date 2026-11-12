import axios from 'axios';
import { config } from '../config';
import logger from '../utils/logger';
import { AppError } from '../utils/errors';

/**
 * Speech-to-text for the Jarvis command bar.
 *
 * Browser SpeechRecognition is unusable for Swahili/Swanglish code-switching,
 * so the primary path is Groq's Whisper (whisper-large-v3-turbo): fast, cheap,
 * multilingual, and identical on every tablet. The API key stays server-side
 * and the audio is never logged.
 *
 * If GROQ_API_KEY is not configured, `transcribeAudio` throws a clear 503 so
 * the client can show "Voice isn't set up yet — type instead". This keeps the
 * endpoint and client contract stable until the key is added.
 */

export function isTranscriptionConfigured(): boolean {
  return Boolean(config.groqApiKey);
}

export interface TranscriptionOptions {
  /** ISO-639-1 hint, e.g. "sw" or "en". Omit to auto-detect. */
  language?: string;
  /** Domain terms to bias recognition (menu items, table labels, staff roles). */
  prompt?: string;
}

export interface TranscriptionResult {
  text: string;
  provider: 'groq';
}

export async function transcribeAudio(
  audio: Buffer,
  filename: string,
  options: TranscriptionOptions = {}
): Promise<TranscriptionResult> {
  if (!config.groqApiKey) {
    throw new AppError(
      503,
      'TRANSCRIPTION_NOT_CONFIGURED',
      'Voice transcription is not configured yet. Type your command instead.',
      'Uhamishaji wa sauti haujasanidiwa bado. Andika amri yako badala yake.'
    );
  }
  if (!audio || audio.length === 0) {
    throw AppError.validation('Empty audio upload', 'Sauti tupu imepakiwa');
  }

  // Use the web-standard FormData/Blob available in Node 18+ without relying
  // on DOM lib types (the backend compiles without the DOM library).
  const FormDataCtor = (globalThis as any).FormData;
  const BlobCtor = (globalThis as any).Blob;
  if (!FormDataCtor || !BlobCtor) {
    throw new AppError(500, 'TRANSCRIPTION_UNAVAILABLE', 'Transcription runtime unavailable', 'Huduma ya uhamishaji haipatikani');
  }

  const form = new FormDataCtor();
  form.append('file', new BlobCtor([audio]), filename);
  form.append('model', config.groqWhisperModel);
  if (options.language) form.append('language', options.language);
  if (options.prompt) form.append('prompt', options.prompt.slice(0, 500));
  form.append('response_format', 'json');

  try {
    const response = await axios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
      headers: { Authorization: `Bearer ${config.groqApiKey}` },
      timeout: 20_000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const text = String(response.data?.text || '').trim();
    logger.info('Voice transcription completed', { provider: 'groq', characters: text.length });
    return { text, provider: 'groq' };
  } catch (error: any) {
    logger.error('Groq transcription failed', { status: error?.response?.status, error: error?.message });
    throw new AppError(502, 'TRANSCRIPTION_FAILED', 'Could not transcribe the audio. Please try again or type your command.', 'Imeshindwa kuhamisha sauti. Tafadhali jaribu tena au andika amri yako.');
  }
}

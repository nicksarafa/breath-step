/**
 * Server-side ElevenLabs text to speech. Used by the Vercel function
 * (api/tts.ts), the Vite dev server, and the generate-voice script.
 * The API key is read from the environment and never sent to the browser.
 */
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js'
import { themeLine } from '../src/data/themeGuidance.js'

/** "River": relaxed, neutral, calm. Override with ELEVENLABS_VOICE_ID. */
export const DEFAULT_VOICE_ID = 'SAz9YHcvj6GT2YYXdXww'
export const MODEL_ID = 'eleven_multilingual_v2'

export function voiceConfig(env: Record<string, string | undefined>) {
  return { apiKey: env.ELEVENLABS_API_KEY || '', voiceId: env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID }
}

export async function synthesize(text: string, cfg: { apiKey: string; voiceId: string }): Promise<Uint8Array> {
  if (!cfg.apiKey) throw new Error('ELEVENLABS_API_KEY is not set')
  const client = new ElevenLabsClient({ apiKey: cfg.apiKey })
  const stream = await client.textToSpeech.convert(cfg.voiceId, {
    text,
    modelId: MODEL_ID,
    outputFormat: 'mp3_44100_128',
    // Slow, steady and warm for guided breathwork
    voiceSettings: { stability: 0.7, similarityBoost: 0.75, style: 0.15, useSpeakerBoost: true, speed: 0.9 },
  })
  const chunks: Uint8Array[] = []
  const reader = stream.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    if (value) chunks.push(value)
  }
  const out = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0))
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

export interface ThemeRequest {
  cycle: number
  line: number
  theme: string
}

/** Only theme templates can be voiced: the text is rebuilt here, not taken from the client */
export function resolveThemeRequest(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const { cycle, line, theme } = body as Partial<ThemeRequest>
  if (!Number.isInteger(cycle) || !Number.isInteger(line) || typeof theme !== 'string') return null
  return themeLine(cycle!, line!, theme)
}

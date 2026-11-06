/**
 * Vercel function: voices one theme guidance line with ElevenLabs.
 * POST { cycle, line, theme } → audio/mpeg
 * Set ELEVENLABS_API_KEY (and optionally ELEVENLABS_VOICE_ID) in the Vercel
 * project's environment variables. Never in client code.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { resolveThemeRequest, synthesize, voiceConfig } from '../server/tts.js'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Use POST' })
  }
  const cfg = voiceConfig(process.env)
  if (!cfg.apiKey) return res.status(503).json({ error: 'Voice is not configured on this deployment' })
  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const text = resolveThemeRequest(body)
  if (!text) return res.status(400).json({ error: 'Unknown guidance line' })
  try {
    const audio = await synthesize(text, cfg)
    res.setHeader('Content-Type', 'audio/mpeg')
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable')
    return res.status(200).send(Buffer.from(audio))
  } catch (e) {
    return res.status(502).json({ error: (e as Error).message })
  }
}

function safeJson(s: string) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import { resolveThemeRequest, synthesize, voiceConfig } from './server/tts.js'

/**
 * Serves /api/tts during development, mirroring the Vercel function in
 * api/tts.ts. Env vars are read here on the server only; the ElevenLabs key
 * never reaches the browser (only VITE_ prefixed vars are exposed to it).
 */
function voiceApi(): Plugin {
  return {
    name: 'breath-voice-api',
    configureServer(server) {
      const env = loadEnv(server.config.mode, process.cwd(), '')
      server.middlewares.use('/api/tts', async (req, res) => {
        const send = (status: number, body: unknown, type = 'application/json') => {
          res.statusCode = status
          res.setHeader('Content-Type', type)
          res.end(type === 'application/json' ? JSON.stringify(body) : (body as Uint8Array))
        }
        if (req.method !== 'POST') return send(405, { error: 'Use POST' })
        const cfg = voiceConfig(env)
        if (!cfg.apiKey) return send(503, { error: 'Voice is not configured' })
        let raw = ''
        for await (const chunk of req) raw += chunk
        let body: unknown = null
        try {
          body = JSON.parse(raw)
        } catch {
          /* invalid */
        }
        const text = resolveThemeRequest(body)
        if (!text) return send(400, { error: 'Unknown guidance line' })
        try {
          send(200, await synthesize(text, cfg), 'audio/mpeg')
        } catch (e) {
          send((e as { statusCode?: number }).statusCode === 429 ? 429 : 502, { error: (e as Error).message })
        }
      })
    },
  }
}

// Spotify only accepts loopback IPs (not "localhost") for http redirect URIs,
// so the dev server is pinned to 127.0.0.1:5173.
export default defineConfig({
  plugins: [react(), voiceApi()],
  server: { host: '127.0.0.1', port: 5173, strictPort: true },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true },
})

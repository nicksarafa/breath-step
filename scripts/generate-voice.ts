/**
 * Pre-generates every fixed guidance line with ElevenLabs into public/voice,
 * plus a manifest the app uses to look lines up by their exact text.
 *
 *   npm run voice            generate missing lines
 *   npm run voice -- --dry   show what would be generated and the character cost
 *
 * Needs ELEVENLABS_API_KEY in .env (create your own at
 * https://elevenlabs.io/app/developers/api-keys). Already generated lines are
 * skipped, so re-running only spends characters on new or changed text.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { allVoiceLines } from '../src/data/voice.js'
import { MODEL_ID, synthesize, voiceConfig } from '../server/tts.js'

const root = join(import.meta.dirname, '..')
const outDir = join(root, 'public', 'voice')
const manifestPath = join(outDir, 'manifest.json')
const dry = process.argv.includes('--dry')

function loadEnv() {
  const env: Record<string, string> = { ...(process.env as Record<string, string>) }
  for (const f of ['.env', '.env.local']) {
    const p = join(root, f)
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
  return env
}

const cfg = voiceConfig(loadEnv())
if (!cfg.apiKey && !dry) {
  console.error('ELEVENLABS_API_KEY is missing. Create a key at https://elevenlabs.io/app/developers/api-keys and add it to .env')
  process.exit(1)
}

mkdirSync(outDir, { recursive: true })
const manifest: { voiceId: string; model: string; lines: Record<string, string> } = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { voiceId: cfg.voiceId, model: MODEL_ID, lines: {} }
if (manifest.voiceId !== cfg.voiceId) {
  console.log(`Voice changed (${manifest.voiceId} → ${cfg.voiceId}): regenerating all lines`)
  manifest.lines = {}
  manifest.voiceId = cfg.voiceId
}

const lines = allVoiceLines()
const todo = lines.filter((l) => !manifest.lines[l] || !existsSync(join(outDir, manifest.lines[l])))
const cost = todo.reduce((n, l) => n + l.length, 0)
console.log(`${lines.length} lines, ${todo.length} to generate, ${cost} characters`)
if (dry) {
  todo.forEach((l) => console.log('  ' + l))
  process.exit(0)
}

let done = 0
for (const text of todo) {
  const file = createHash('sha1').update(`${cfg.voiceId}|${MODEL_ID}|${text}`).digest('hex').slice(0, 16) + '.mp3'
  const audio = await synthesize(text, cfg)
  writeFileSync(join(outDir, file), audio)
  manifest.lines[text] = file
  done++
  process.stdout.write(`\r${done}/${todo.length}`)
  // Save as we go, so an interruption never wastes generated audio
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}
// Drop lines that are no longer in the script
for (const k of Object.keys(manifest.lines)) if (!lines.includes(k)) delete manifest.lines[k]
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
console.log(`\nDone. ${Object.keys(manifest.lines).length} lines in public/voice`)

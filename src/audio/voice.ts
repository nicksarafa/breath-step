/**
 * Spoken guidance.
 *  1. Fixed lines play from pre-generated ElevenLabs audio (public/voice, see
 *     `npm run voice`), looked up by exact text.
 *  2. Theme lines are voiced on demand by the /api/tts function (the key stays
 *     on the server) and cached in the browser, so each is generated once.
 *  3. Anything else, or any failure, falls back to the browser's own voice.
 * Phase instructions interrupt; guidance lines queue.
 */
import { withoutTopic } from '../data/voice'

let manifest: Record<string, string> | null = null
let manifestLoad: Promise<void> | null = null

export function loadVoice(): Promise<void> {
  manifestLoad ??= fetch('/voice/manifest.json')
    .then((r) => (r.ok ? r.json() : null))
    .then((m) => {
      manifest = m?.lines && Object.keys(m.lines).length ? m.lines : null
    })
    .catch(() => {
      manifest = null
    })
  return manifestLoad
}

export function voiceEngine(): 'elevenlabs' | 'browser' {
  return manifest ? 'elevenlabs' : 'browser'
}

// ---- theme lines from the server ------------------------------------------

interface ThemeReq {
  cycle: number
  line: number
  theme: string
}
const themeReqs = new Map<string, ThemeReq>()
const themeAudio = new Map<string, Promise<string | null>>()
const CACHE = 'bj-voice-v1'

function fetchThemeAudio(text: string, req: ThemeReq): Promise<string | null> {
  if (!themeAudio.has(text)) {
    const key = `/__voice/${req.cycle}-${req.line}-${encodeURIComponent(req.theme.toLowerCase())}`
    themeAudio.set(
      text,
      (async () => {
        try {
          const cache = 'caches' in window ? await caches.open(CACHE) : null
          let res = await cache?.match(key)
          if (!res) {
            const r = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) })
            if (!r.ok) return null
            await cache?.put(key, r.clone())
            res = r
          }
          return URL.createObjectURL(await res.blob())
        } catch {
          return null
        }
      })(),
    )
  }
  return themeAudio.get(text)!
}

/** Register a theme line; optionally fetch its audio now so it plays without delay */
export function prepareThemeLine(text: string, req: ThemeReq, fetchNow = true) {
  themeReqs.set(text, req)
  if (fetchNow) void fetchThemeAudio(text, req)
}

// ---- playback queue ----------------------------------------------------------

let el: HTMLAudioElement | null = null
let queue: { text: string; rate: number }[] = []
let busy = false
let generation = 0

function audioEl() {
  el ??= new Audio()
  el.preload = 'auto'
  return el
}

async function sourceFor(text: string): Promise<string | null> {
  if (manifest) {
    const file = manifest[text] ?? manifest[withoutTopic(text)]
    if (file) return `/voice/${file}`
  }
  const req = themeReqs.get(text)
  return req ? fetchThemeAudio(text, req) : null
}

async function playNext() {
  if (busy) return
  const item = queue.shift()
  if (!item) return
  busy = true
  const gen = generation
  const done = () => {
    if (gen !== generation) return
    busy = false
    void playNext()
  }
  const src = await sourceFor(item.text)
  if (gen !== generation) return
  if (src) {
    const a = audioEl()
    a.onended = done
    a.onerror = () => browserSpeak(item.text, item.rate, done)
    a.src = src
    a.play().catch(() => browserSpeak(item.text, item.rate, done))
  } else browserSpeak(item.text, item.rate, done)
}

export function speak(text: string, opts: { interrupt?: boolean; rate?: number } = {}) {
  if (!text) return
  if (opts.interrupt) hush()
  queue.push({ text, rate: opts.rate ?? 0.88 })
  void playNext()
}

export function hush() {
  generation++
  queue = []
  busy = false
  if (el) {
    el.onended = null
    el.pause()
  }
  if (voiceSupported) window.speechSynthesis.cancel()
}

/** Call inside a click: lets the audio element and speech play later without a gesture */
export function unlockVoice() {
  void loadVoice()
  const a = audioEl()
  // Play any real clip muted: unlocks this element for later, gesture-free playback
  const first = manifest && Object.values(manifest)[0]
  if (first) {
    a.muted = true
    a.src = `/voice/${first}`
    a.play()
      .then(() => {
        a.pause()
        a.muted = false
      })
      .catch(() => {
        a.muted = false
      })
  }
  if (voiceSupported) {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
  }
}

// ---- browser fallback ----------------------------------------------------------

export const voiceSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
let chosen: SpeechSynthesisVoice | null = null
const PREFERRED = [/Ava \(Premium\)|Ava \(Enhanced\)/i, /Serena|Kate|Stephanie|Tessa|Moira/i, /Samantha|Karen|Daniel/i, /Google UK English Female|Google UK English Male/i, /Natural|Neural/i]

function pickVoice(): SpeechSynthesisVoice | null {
  if (chosen) return chosen
  const en = (window.speechSynthesis?.getVoices?.() || []).filter((v) => /^en[-_]/i.test(v.lang))
  for (const re of PREFERRED) {
    const v = en.find((x) => re.test(x.name))
    if (v) return (chosen = v)
  }
  return (chosen = en.find((v) => v.localService) || en[0] || null)
}

if (voiceSupported) {
  window.speechSynthesis.onvoiceschanged = () => {
    chosen = null
  }
}

function browserSpeak(text: string, rate: number, done: () => void) {
  if (!voiceSupported) return done()
  const u = new SpeechSynthesisUtterance(text)
  const v = pickVoice()
  if (v) u.voice = v
  u.rate = rate
  u.pitch = 0.95
  u.onend = done
  u.onerror = done
  window.speechSynthesis.speak(u)
}

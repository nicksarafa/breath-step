/**
 * Small Web Audio layer: a bowl-like chime for transitions, soft ticks for the
 * 4, 3, 2, 1 count, and optional breath tones that rise on the inhale and
 * fall on the exhale. Everything is synthesised; no audio files.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.5
    master.connect(ctx.destination)
  }
  return ctx
}

/** Call from a click handler so the context is allowed to start. */
export function unlockAudio() {
  const c = audio()
  if (c && c.state === 'suspended') void c.resume()
}

function partial(c: AudioContext, freq: number, gain: number, dur: number, when: number) {
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = 'sine'
  o.frequency.value = freq
  g.gain.setValueAtTime(0, when)
  g.gain.linearRampToValueAtTime(gain, when + 0.015)
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur)
  o.connect(g).connect(master!)
  o.start(when)
  o.stop(when + dur + 0.05)
}

/** Singing bowl approximation: inharmonic partials with long decay */
export function chime(kind: 'deep' | 'bright' = 'deep') {
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.01
  const f = kind === 'deep' ? 196 : 293.66
  partial(c, f, 0.22, 5.5, t)
  partial(c, f * 2.76, 0.08, 3.5, t)
  partial(c, f * 5.4, 0.03, 2, t)
  partial(c, f * 1.003, 0.12, 5, t) // slow beating
}

export function tick(n: number) {
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.01
  partial(c, 520 + (4 - n) * 40, 0.07, 0.6, t)
}

/** A breath tone lasting `seconds`, gliding up for in, down for out */
export function breathTone(dir: 'in' | 'out', seconds: number) {
  const c = audio()
  if (!c) return
  const t = c.currentTime + 0.01
  const dur = Math.max(0.4, seconds * 0.95)
  const o = c.createOscillator()
  const f = c.createBiquadFilter()
  const g = c.createGain()
  o.type = 'triangle'
  const lo = 174.6
  const hi = 261.6
  o.frequency.setValueAtTime(dir === 'in' ? lo : hi, t)
  o.frequency.exponentialRampToValueAtTime(dir === 'in' ? hi : lo, t + dur)
  f.type = 'lowpass'
  f.frequency.value = 900
  g.gain.setValueAtTime(0, t)
  g.gain.linearRampToValueAtTime(0.05, t + dur * 0.3)
  g.gain.linearRampToValueAtTime(0, t + dur)
  o.connect(f).connect(g).connect(master!)
  o.start(t)
  o.stop(t + dur + 0.05)
}

/**
 * Every line the guide speaks. The generator script (scripts/generate-voice.ts)
 * turns these into audio files, and the app looks them up by exact text, so
 * keep spoken text here rather than inline in components.
 */
import { ARRIVE, CYCLES, REST, type CycleDef } from './blueprint.js'

export const PHASE_LINES = {
  arrive: 'Welcome. Let us arrive.',
  letGo: 'Breathe all the way out.',
  holdOut: 'And hold.',
  inhale: 'Big breath in. Fill all the way up.',
  holdIn: 'Hold at the top.',
  release: 'And let go.',
  rest: 'Let your breath return to normal. Rest here.',
  complete: 'Welcome back.',
} as const

export const COUNT_LINES = ['1', '2', '3', '4'] as const

export const PRACTICE_LINES = {
  in: 'In through the nose',
  out: 'Out through the mouth',
  bigIn: 'Now, a big breath in',
  allOut: 'and all the way out',
  hold: 'Hold',
  recover: 'Big breath in',
  top: 'Hold at the top',
  release: 'And let go',
} as const

export function cycleIntro(c: CycleDef): string {
  return `Cycle ${c.number}. ${c.title}.${c.number === 1 ? ' In through the nose, out through the mouth.' : ''}`
}

/** A guidance line without the user's question, which is shown on screen instead */
export function withoutTopic(text: string): string {
  return text.replace('{topic}', '').replace(/\s*“[^”]*”\s*$/, '').trim()
}

export function allVoiceLines(): string[] {
  const lines = new Set<string>()
  Object.values(PHASE_LINES).forEach((l) => lines.add(l))
  COUNT_LINES.forEach((l) => lines.add(l))
  Object.values(PRACTICE_LINES).forEach((l) => lines.add(l))
  ;[...ARRIVE.cues, ...REST.cues].forEach((l) => lines.add(withoutTopic(l)))
  for (const c of CYCLES) {
    lines.add(cycleIntro(c))
    ;[...c.breatheCues, ...c.holdCues].forEach((l) => lines.add(withoutTopic(l)))
  }
  return [...lines].filter(Boolean)
}

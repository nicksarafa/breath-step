/**
 * Pure session engine. No timers, no DOM: `step()` advances the state by a
 * delta and returns the events that happened, so it is fully testable and the
 * React layer only has to drive it with requestAnimationFrame.
 *
 * Flow per cycle (from the blueprint):
 *   breathe → letGo (breathe all the way out) → holdOut (on empty)
 *   → inhale (big recovery breath) → holdIn (10 s, count 4, 3, 2, 1) → release (sigh out)
 * Wrapped by: arrive → [cycles] → rest → complete
 */
import { ARRIVE, CYCLES, REST, TRANSITIONS, fillTopic, type CycleDef } from '../data/blueprint'

export type Phase = 'arrive' | 'breathe' | 'letGo' | 'holdOut' | 'inhale' | 'holdIn' | 'release' | 'rest' | 'complete'

export interface SessionConfig {
  cycles: CycleDef[]
  topic: string
  /** Multiplies breath period. 1 = as designed, >1 slower, <1 faster */
  paceScale: number
  /** Multiplies breathing and hold durations ("timings are estimations") */
  timeScale: number
  arriveSec: number
  restSec: number
}

export interface SessionState {
  phase: Phase
  cycleIndex: number
  /** ms elapsed inside the current phase */
  phaseElapsed: number
  /** ms the current phase lasts (holdOut can be extended) */
  phaseDuration: number
  /** Continuous breath position. Fractional part < 0.5 is inhale, >= 0.5 is exhale */
  breathPos: number
  onBreak: boolean
  paused: boolean
  /** Index of the last cue emitted in this phase, -1 for none */
  cueIndex: number
  /** Current countdown number shown during holdIn, or null */
  countdown: number | null
  totalElapsed: number
}

export type SessionEvent =
  | { type: 'phase'; phase: Phase; cycleIndex: number }
  | { type: 'cue'; text: string; cycleIndex: number; phase: Phase }
  | { type: 'countdown'; n: number }
  | { type: 'breath'; dir: 'in' | 'out' }

export function defaultConfig(partial: Partial<SessionConfig> & { cycleCount?: number } = {}): SessionConfig {
  const { cycleCount = 9, ...rest } = partial
  const n = Math.min(CYCLES.length, Math.max(1, Math.round(cycleCount)))
  return {
    cycles: CYCLES.slice(0, n),
    topic: '',
    paceScale: 1,
    timeScale: 1,
    arriveSec: ARRIVE.durationSec,
    restSec: REST.durationSec,
    ...rest,
  }
}

export function initialState(cfg: SessionConfig): SessionState {
  return {
    phase: 'arrive',
    cycleIndex: 0,
    phaseElapsed: 0,
    phaseDuration: phaseDurationMs('arrive', 0, cfg),
    breathPos: 0,
    onBreak: false,
    paused: false,
    cueIndex: -1,
    countdown: null,
    totalElapsed: 0,
  }
}

export function phaseDurationMs(phase: Phase, cycleIndex: number, cfg: SessionConfig): number {
  const c = cfg.cycles[cycleIndex]
  const s = cfg.timeScale
  switch (phase) {
    case 'arrive':
      return cfg.arriveSec * 1000
    case 'breathe':
      return Math.round(c.breatheSec * s * 1000)
    case 'letGo':
      return TRANSITIONS.letGoSec * 1000
    case 'holdOut':
      return Math.round(c.holdOutSec * s * 1000)
    case 'inhale':
      return TRANSITIONS.inhaleSec * 1000
    case 'holdIn':
      return c.holdInSec * 1000
    case 'release':
      return TRANSITIONS.releaseSec * 1000
    case 'rest':
      return cfg.restSec * 1000
    case 'complete':
      return Infinity
  }
}

export function nextPhase(phase: Phase, cycleIndex: number, cfg: SessionConfig): { phase: Phase; cycleIndex: number } {
  switch (phase) {
    case 'arrive':
      return { phase: 'breathe', cycleIndex: 0 }
    case 'breathe':
      return { phase: 'letGo', cycleIndex }
    case 'letGo':
      return { phase: 'holdOut', cycleIndex }
    case 'holdOut':
      return { phase: 'inhale', cycleIndex }
    case 'inhale':
      return { phase: 'holdIn', cycleIndex }
    case 'holdIn':
      return { phase: 'release', cycleIndex }
    case 'release':
      return cycleIndex + 1 < cfg.cycles.length ? { phase: 'breathe', cycleIndex: cycleIndex + 1 } : { phase: 'rest', cycleIndex }
    case 'rest':
    case 'complete':
      return { phase: 'complete', cycleIndex }
  }
}

/** Breath period in seconds for rhythmic phases, or null when the breath is held / guided */
export function breathPeriod(state: SessionState, cfg: SessionConfig): number | null {
  if (state.onBreak && (state.phase === 'breathe' || state.phase === 'arrive')) return TRANSITIONS.breakPeriodSec
  switch (state.phase) {
    case 'arrive':
      return ARRIVE.breathPeriodSec
    case 'rest':
      return REST.breathPeriodSec
    case 'breathe': {
      // Slow and deep as the cycle begins, quickening smoothly to full pace
      const c = cfg.cycles[state.cycleIndex]
      const span = phaseDurationMs('breathe', state.cycleIndex, cfg) * TRANSITIONS.rampShare
      const t = Math.min(1, state.phaseElapsed / span)
      const eased = t * t * (3 - 2 * t)
      return (c.startPeriodSec + (c.breathPeriodSec - c.startPeriodSec) * eased) * cfg.paceScale
    }
    default:
      return null
  }
}

/** Cue texts for the current phase, topic filled in. */
export function cuesFor(phase: Phase, cycleIndex: number, cfg: SessionConfig): string[] {
  const c = cfg.cycles[cycleIndex]
  const raw =
    phase === 'arrive' ? ARRIVE.cues
    : phase === 'rest' ? REST.cues
    : phase === 'breathe' ? c.breatheCues
    : phase === 'holdOut' ? c.holdCues
    : []
  return raw.map((t) => fillTopic(t, cfg.topic)).filter(Boolean)
}

/** When (ms into the phase) each cue fires. Spread evenly, leaving quiet at both ends. */
export function cueSchedule(phase: Phase, count: number, durationMs: number): number[] {
  if (count === 0) return []
  const lead = phase === 'holdOut' ? 6000 : phase === 'breathe' ? 9000 : 2500
  const tail = phase === 'breathe' ? 20000 : phase === 'holdOut' ? 8000 : 8000
  const span = Math.max(0, durationMs - lead - tail)
  if (count === 1) return [lead]
  return Array.from({ length: count }, (_, i) => Math.round(lead + (span * i) / (count - 1)))
}

function enterPhase(state: SessionState, phase: Phase, cycleIndex: number, cfg: SessionConfig): SessionState {
  return {
    ...state,
    phase,
    cycleIndex,
    phaseElapsed: 0,
    phaseDuration: phaseDurationMs(phase, cycleIndex, cfg),
    cueIndex: -1,
    countdown: null,
    // A break covers one stretch of breathing; rejoin automatically at the hold
    onBreak: phase === 'breathe' || phase === 'arrive' ? state.onBreak : false,
    // Each rhythmic phase starts on an inhale
    breathPos: phase === 'breathe' || phase === 'arrive' || phase === 'rest' ? 0 : state.breathPos,
  }
}

/** Advance the session by dtMs. Returns the new state and any events crossed. */
export function step(prev: SessionState, dtMs: number, cfg: SessionConfig): { state: SessionState; events: SessionEvent[] } {
  const events: SessionEvent[] = []
  if (prev.paused || prev.phase === 'complete') return { state: prev, events }
  let state = { ...prev }
  let remaining = dtMs

  // Loop so a large dt (tab was in the background) walks through phases correctly
  while (remaining > 0 && state.phase !== 'complete') {
    const left = state.phaseDuration - state.phaseElapsed
    const slice = Math.min(remaining, left)
    state = advanceWithin(state, slice, cfg, events)
    remaining -= slice
    state.totalElapsed += slice
    if (state.phaseElapsed >= state.phaseDuration) {
      const n = nextPhase(state.phase, state.cycleIndex, cfg)
      state = enterPhase(state, n.phase, n.cycleIndex, cfg)
      events.push({ type: 'phase', phase: state.phase, cycleIndex: state.cycleIndex })
    }
  }
  return { state, events }
}

function advanceWithin(s: SessionState, dt: number, cfg: SessionConfig, events: SessionEvent[]): SessionState {
  const state = { ...s }
  const before = state.phaseElapsed
  state.phaseElapsed += dt

  // Rhythmic breath
  const period = breathPeriod(state, cfg)
  if (period) {
    const p0 = state.breathPos
    const p1 = p0 + dt / 1000 / period
    // Crossings of n + 0.5 are exhales, of n + 1 are inhales
    for (let k = Math.floor(p0 * 2) + 1; k <= Math.floor(p1 * 2); k++) {
      events.push({ type: 'breath', dir: k % 2 === 1 ? 'out' : 'in' })
    }
    state.breathPos = p1
  }

  // Guidance cues
  const cues = cuesFor(state.phase, state.cycleIndex, cfg)
  if (cues.length) {
    const times = cueSchedule(state.phase, cues.length, phaseDurationMs(state.phase, state.cycleIndex, cfg))
    for (let i = state.cueIndex + 1; i < cues.length; i++) {
      if (times[i] <= state.phaseElapsed && times[i] > before - 1) {
        state.cueIndex = i
        events.push({ type: 'cue', text: cues[i], cycleIndex: state.cycleIndex, phase: state.phase })
      } else if (times[i] > state.phaseElapsed) break
    }
  }

  // 4, 3, 2, 1 at the end of the hold at the top
  if (state.phase === 'holdIn') {
    const rem = state.phaseDuration - state.phaseElapsed
    const n = Math.ceil(rem / 1000)
    if (n >= 1 && n <= 4 && n !== state.countdown) {
      state.countdown = n
      events.push({ type: 'countdown', n })
    }
  }
  return state
}

// ----- user actions -----------------------------------------------------------

export function togglePause(s: SessionState): SessionState {
  return { ...s, paused: !s.paused }
}

export function toggleBreak(s: SessionState): SessionState {
  if (s.phase !== 'breathe' && s.phase !== 'arrive') return s
  return { ...s, onBreak: !s.onBreak }
}

/** "Stay longer" in the hold out */
export function extendHold(s: SessionState): SessionState {
  if (s.phase !== 'holdOut') return s
  return { ...s, phaseDuration: s.phaseDuration + TRANSITIONS.extendSec * 1000 }
}

/** Ends the current phase now. In the hold out this is "Breathe in now". */
export function skipPhase(s: SessionState, cfg: SessionConfig): { state: SessionState; events: SessionEvent[] } {
  if (s.phase === 'complete') return { state: s, events: [] }
  // Finish the phase without replaying the cues/breaths we skipped over
  const r = step({ ...s, paused: false, phaseElapsed: s.phaseDuration, phaseDuration: s.phaseDuration + 1, cueIndex: 999 }, 1, cfg)
  return { state: { ...r.state, paused: s.paused }, events: r.events.filter((e) => e.type === 'phase') }
}

/** Jump straight to the start of a cycle's breathing (or to rest when past the end) */
export function jumpToCycle(s: SessionState, index: number, cfg: SessionConfig): { state: SessionState; events: SessionEvent[] } {
  const phase: Phase = index >= cfg.cycles.length ? 'rest' : 'breathe'
  const ci = Math.min(Math.max(0, index), cfg.cycles.length - 1)
  const state = enterPhase(s, phase, ci, cfg)
  return { state, events: [{ type: 'phase', phase, cycleIndex: ci }] }
}

// ----- derived values for the UI ------------------------------------------------

/** 0..1 lung fullness, for the orb */
export function lungFill(s: SessionState): number {
  const t = s.phaseDuration === Infinity ? 0 : Math.min(1, s.phaseElapsed / s.phaseDuration)
  switch (s.phase) {
    case 'arrive':
    case 'breathe':
    case 'rest': {
      const frac = s.breathPos - Math.floor(s.breathPos)
      // Smooth sine: 0 at start of inhale, 1 at top, back to 0
      const depth = s.phase === 'breathe' && !s.onBreak ? 1 : 0.85
      return depth * (0.5 - 0.5 * Math.cos(frac * 2 * Math.PI))
    }
    case 'letGo':
      return Math.max(0, 1 - easeOut(t)) * 0.9
    case 'holdOut':
      return 0
    case 'inhale':
      return easeOut(t)
    case 'holdIn':
      return 1
    case 'release':
      return 1 - easeOut(t)
    case 'complete':
      return 0
  }
}

function easeOut(t: number) {
  return 1 - Math.pow(1 - t, 3)
}

export function breathDirection(s: SessionState): 'in' | 'out' | null {
  if (s.phase !== 'breathe' && s.phase !== 'arrive' && s.phase !== 'rest') return null
  return s.breathPos - Math.floor(s.breathPos) < 0.5 ? 'in' : 'out'
}

export function totalPlannedMs(cfg: SessionConfig): number {
  let ms = cfg.arriveSec * 1000 + cfg.restSec * 1000
  cfg.cycles.forEach((_, i) => {
    for (const p of ['breathe', 'letGo', 'holdOut', 'inhale', 'holdIn', 'release'] as Phase[]) ms += phaseDurationMs(p, i, cfg)
  })
  return ms
}

export function phaseLabel(s: SessionState): string {
  switch (s.phase) {
    case 'arrive':
      return breathDirection(s) === 'in' ? 'Slowly in' : 'Slowly out'
    case 'breathe':
      return s.onBreak ? 'Slow and easy' : breathDirection(s) === 'in' ? 'Breathe in' : 'Breathe out'
    case 'letGo':
      return 'All the way out'
    case 'holdOut':
      return 'Hold'
    case 'inhale':
      return 'Big breath in'
    case 'holdIn':
      return 'Hold at the top'
    case 'release':
      return 'And let go'
    case 'rest':
      return 'Natural breath'
    case 'complete':
      return 'Welcome back'
  }
}

const CYCLE_PHASES: Phase[] = ['breathe', 'letGo', 'holdOut', 'inhale', 'holdIn', 'release']

/** 0..1 progress through each cycle, for the top progress track */
export function cycleProgress(s: SessionState, cfg: SessionConfig): number[] {
  return cfg.cycles.map((_, i) => {
    if (s.phase === 'arrive') return 0
    if (s.phase === 'rest' || s.phase === 'complete') return 1
    if (i < s.cycleIndex) return 1
    if (i > s.cycleIndex) return 0
    const durs = CYCLE_PHASES.map((p) => phaseDurationMs(p, i, cfg))
    const total = durs.reduce((a, b) => a + b, 0)
    const k = CYCLE_PHASES.indexOf(s.phase)
    const done = durs.slice(0, k).reduce((a, b) => a + b, 0) + Math.min(s.phaseElapsed, durs[k])
    return Math.min(1, done / total)
  })
}

/** Planned time left from the current position (respects jumps and extended holds) */
export function remainingMs(s: SessionState, cfg: SessionConfig): number {
  if (s.phase === 'complete') return 0
  let ms = Math.max(0, s.phaseDuration - s.phaseElapsed)
  let cur: { phase: Phase; cycleIndex: number } = { phase: s.phase, cycleIndex: s.cycleIndex }
  for (let guard = 0; guard < 200; guard++) {
    cur = nextPhase(cur.phase, cur.cycleIndex, cfg)
    if (cur.phase === 'complete') break
    ms += phaseDurationMs(cur.phase, cur.cycleIndex, cfg)
  }
  return ms
}

/** Phase and offset at a planned time (ms from the start of the plan) */
export function phaseAt(ms: number, cfg: SessionConfig): { phase: Phase; cycleIndex: number; offset: number; start: number } {
  let cur: { phase: Phase; cycleIndex: number } = { phase: 'arrive', cycleIndex: 0 }
  let t = 0
  const target = Math.max(0, ms)
  for (let guard = 0; guard < 200; guard++) {
    const d = phaseDurationMs(cur.phase, cur.cycleIndex, cfg)
    const n = nextPhase(cur.phase, cur.cycleIndex, cfg)
    if (target < t + d || n.phase === 'complete') return { ...cur, offset: Math.min(target - t, d - 1), start: t }
    t += d
    cur = n
  }
  return { ...cur, offset: 0, start: t }
}

/**
 * Scrub: jump to a planned moment. Replays the phase silently up to the
 * offset so the breath position, last cue and countdown are exactly right.
 * Returns the phase event plus the cue that is showing at that moment.
 */
export function seekTo(s: SessionState, ms: number, cfg: SessionConfig): { state: SessionState; events: SessionEvent[] } {
  const at = phaseAt(ms, cfg)
  let state: SessionState = {
    ...s,
    phase: at.phase,
    cycleIndex: at.cycleIndex,
    phaseElapsed: 0,
    phaseDuration: phaseDurationMs(at.phase, at.cycleIndex, cfg),
    breathPos: 0,
    cueIndex: -1,
    countdown: null,
    onBreak: false,
    paused: false,
  }
  let left = at.offset
  while (left > 0) {
    const dt = Math.min(100, left)
    state = step(state, dt, cfg).state
    left -= dt
  }
  const events: SessionEvent[] = [{ type: 'phase', phase: state.phase, cycleIndex: state.cycleIndex }]
  const cues = cuesFor(state.phase, state.cycleIndex, cfg)
  if (state.cueIndex >= 0 && cues[state.cueIndex]) events.push({ type: 'cue', text: cues[state.cueIndex], cycleIndex: state.cycleIndex, phase: state.phase })
  return { state: { ...state, paused: s.paused }, events }
}

/**
 * Runs the real engine over the whole plan to produce a breath map: lung
 * fullness sampled over time plus the span of every phase. Because it uses
 * the same `step()` as a live session, the map always matches what happens.
 */
import { initialState, lungFill, nextPhase, phaseDurationMs, step, type Phase, type SessionConfig, type SessionState } from './session'

export interface PhaseSpan {
  phase: Phase
  cycleIndex: number
  start: number
  end: number
}

export interface BreathPlan {
  /** ms between samples */
  dt: number
  /** lung fullness 0..1 per sample */
  fill: Float32Array
  spans: PhaseSpan[]
  totalMs: number
  /** number of full breaths per cycle */
  breaths: number[]
  /** ms at which each inhale begins, per cycle (shows the pace building) */
  inhaleTimes: number[][]
}

export function simulate(cfg: SessionConfig, dt = 100): BreathPlan {
  let s = initialState(cfg)
  const fills: number[] = [lungFill(s)]
  const spans: PhaseSpan[] = [{ phase: s.phase, cycleIndex: s.cycleIndex, start: 0, end: 0 }]
  const breaths = cfg.cycles.map(() => 0)
  const inhaleTimes: number[][] = cfg.cycles.map(() => [])
  let t = 0
  while (s.phase !== 'complete' && t < 4 * 3600_000) {
    const r = step(s, dt, cfg)
    t += dt
    for (const e of r.events) {
      if (e.type === 'phase') {
        spans[spans.length - 1].end = t
        spans.push({ phase: e.phase, cycleIndex: e.cycleIndex, start: t, end: t })
        if (e.phase === 'breathe') inhaleTimes[e.cycleIndex].push(t)
      } else if (e.type === 'breath' && e.dir === 'in' && r.state.phase === 'breathe') {
        breaths[r.state.cycleIndex]++
        inhaleTimes[r.state.cycleIndex].push(t)
      }
    }
    s = r.state
    fills.push(lungFill(s))
  }
  spans[spans.length - 1].end = t
  // Count the first inhale of each breathing phase (it starts without an event)
  cfg.cycles.forEach((_, i) => (breaths[i] += 1))
  return { dt, fill: Float32Array.from(fills), spans: spans.filter((x) => x.phase !== 'complete'), totalMs: t, breaths, inhaleTimes }
}

/** Planned start time (ms) of a phase in the uninterrupted plan */
export function plannedStart(phase: Phase, cycleIndex: number, cfg: SessionConfig): number {
  let cur: { phase: Phase; cycleIndex: number } = { phase: 'arrive', cycleIndex: 0 }
  let t = 0
  for (let guard = 0; guard < 200; guard++) {
    if (cur.phase === phase && cur.cycleIndex === cycleIndex) return t
    if (cur.phase === 'complete') break
    t += phaseDurationMs(cur.phase, cur.cycleIndex, cfg)
    cur = nextPhase(cur.phase, cur.cycleIndex, cfg)
  }
  return t
}

/** Where a live session sits on the planned map (ms), ignoring skips and extensions */
export function plannedPosition(s: SessionState, cfg: SessionConfig): number {
  const planned = phaseDurationMs(s.phase, s.cycleIndex, cfg)
  const frac = s.phaseDuration > 0 && Number.isFinite(s.phaseDuration) ? s.phaseElapsed / s.phaseDuration : 0
  return plannedStart(s.phase, s.cycleIndex, cfg) + Math.min(1, frac) * (Number.isFinite(planned) ? planned : 0)
}

export const PHASE_NAMES: Record<Phase, string> = {
  arrive: 'Arrival',
  breathe: 'Rhythmic breathing',
  letGo: 'All the way out',
  holdOut: 'Hold on empty',
  inhale: 'Big breath in',
  holdIn: 'Hold at the top',
  release: 'Release',
  rest: 'Rest',
  complete: 'Complete',
}

export function spanAt(plan: BreathPlan, ms: number): PhaseSpan {
  return plan.spans.find((s) => ms >= s.start && ms < s.end) ?? plan.spans[plan.spans.length - 1]
}

/** Start and end (ms) of a cycle on the plan, from its first breath to its release */
export function cycleRange(plan: BreathPlan, index: number): [number, number] {
  const s = plan.spans.filter((x) => x.cycleIndex === index && x.phase !== 'arrive' && x.phase !== 'rest')
  return [s[0].start, s[s.length - 1].end]
}

/** "12:30 · Cycle 3 · Hold on empty 0:12" for scrub readouts */
export function describeAt(plan: BreathPlan, ms: number): string {
  const sp = spanAt(plan, ms)
  const m = (v: number) => {
    const sec = Math.max(0, Math.floor(v / 1000))
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
  }
  const where = sp.phase === 'arrive' || sp.phase === 'rest' ? PHASE_NAMES[sp.phase] : `Cycle ${sp.cycleIndex + 1} · ${PHASE_NAMES[sp.phase]}`
  return `${m(ms)} · ${where} ${m(ms - sp.start)}`
}

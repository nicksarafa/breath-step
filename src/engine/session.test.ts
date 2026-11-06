import { describe, expect, it } from 'vitest'
import { CYCLES } from '../data/blueprint'
import { plannedStart } from './simulate'
import {
  breathPeriod,
  phaseAt,
  seekTo,
  defaultConfig,
  extendHold,
  initialState,
  jumpToCycle,
  skipPhase,
  step,
  toggleBreak,
  togglePause,
  totalPlannedMs,
  remainingMs,
  phaseDurationMs,
  type Phase,
  type SessionEvent,
  type SessionState,
} from './session'

function run(state: SessionState, ms: number, cfg = defaultConfig(), tick = 50) {
  const events: SessionEvent[] = []
  let s = state
  for (let t = 0; t < ms; t += tick) {
    const r = step(s, tick, cfg)
    s = r.state
    events.push(...r.events)
  }
  return { state: s, events }
}

describe('blueprint data', () => {
  it('encodes 9 cycles with the timings from the handout', () => {
    expect(CYCLES).toHaveLength(9)
    expect(CYCLES.map((c) => c.breatheSec)).toEqual([150, 170, 195, 215, 240, 240, 240, 240, 240])
    expect(CYCLES.map((c) => c.holdOutSec)).toEqual([30, 45, 50, 55, 60, 70, 80, 80, 80])
    CYCLES.forEach((c) => expect(c.holdInSec).toBe(10))
  })
  it('keeps user-facing copy free of em dashes and the word the brand avoids', () => {
    const all = JSON.stringify(CYCLES)
    expect(all).not.toMatch(/—/)
    expect(all.toLowerCase()).not.toMatch(/psyched/)
  })
  it('breath gets faster through the arc', () => {
    expect(CYCLES[0].breathPeriodSec).toBeGreaterThan(CYCLES[8].breathPeriodSec)
  })
})

describe('session flow', () => {
  it('walks arrive → breathe → letGo → holdOut → inhale → holdIn → release → next cycle', () => {
    const cfg = defaultConfig({ cycleCount: 8 })
    const { events } = run(initialState(cfg), totalPlannedMs(cfg) + 1000, cfg, 250)
    const phases = events.filter((e) => e.type === 'phase').map((e) => (e as { phase: Phase }).phase)
    expect(phases.slice(0, 7)).toEqual(['breathe', 'letGo', 'holdOut', 'inhale', 'holdIn', 'release', 'breathe'])
    expect(phases.filter((p) => p === 'holdOut')).toHaveLength(8)
    expect(phases.at(-2)).toBe('rest')
    expect(phases.at(-1)).toBe('complete')
  })

  it('counts 4, 3, 2, 1 at the end of the hold at the top', () => {
    const cfg = defaultConfig()
    let s = jumpToCycle(initialState(cfg), 0, cfg).state
    // fast-forward to holdIn
    while (s.phase !== 'holdIn') s = skipPhase(s, cfg).state
    const { events } = run(s, 10_500, cfg)
    expect(events.filter((e) => e.type === 'countdown').map((e) => (e as { n: number }).n)).toEqual([4, 3, 2, 1])
  })

  it('emits alternating breath events', () => {
    const cfg = defaultConfig()
    const s = jumpToCycle(initialState(cfg), 0, cfg).state
    const { events } = run(s, 40_000, cfg)
    const breaths = events.filter((e) => e.type === 'breath').map((e) => (e as { dir: string }).dir)
    expect(breaths[0]).toBe('out')
    for (let i = 1; i < breaths.length; i++) expect(breaths[i]).not.toBe(breaths[i - 1])
  })

  it('each cycle starts slow and deep, then quickens', () => {
    const cfg = defaultConfig()
    for (let i = 0; i < cfg.cycles.length; i++) {
      const s = jumpToCycle(initialState(cfg), i, cfg).state
      const start = breathPeriod(s, cfg)!
      const late = breathPeriod({ ...s, phaseElapsed: s.phaseDuration - 1000 }, cfg)!
      expect(start).toBeCloseTo(cfg.cycles[i].startPeriodSec, 5)
      expect(late).toBeCloseTo(cfg.cycles[i].breathPeriodSec, 5)
      expect(late).toBeLessThan(start)
    }
  })

  it('the whole session gets faster: no cycle starts slower than the one before', () => {
    const starts = CYCLES.map((c) => c.startPeriodSec)
    const ends = CYCLES.map((c) => c.breathPeriodSec)
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeLessThanOrEqual(starts[i - 1])
    expect(starts[0]).toBeGreaterThanOrEqual(5.5)
    expect(ends.at(-1)).toBeLessThanOrEqual(2.1)
  })

  it('pace scale slows or speeds the whole curve', () => {
    const slow = defaultConfig({ paceScale: 1.15 })
    const s = jumpToCycle(initialState(slow), 0, slow).state
    expect(breathPeriod(s, slow)).toBeCloseTo(CYCLES[0].startPeriodSec * 1.15, 5)
  })

  it('weaves the topic into cycle 5', () => {
    const cfg = defaultConfig({ topic: 'What is my next true step?' })
    const s = jumpToCycle(initialState(cfg), 4, cfg).state
    const { events } = run(s, 15_000, cfg)
    const cue = events.find((e) => e.type === 'cue') as { text: string }
    expect(cue.text).toContain('What is my next true step?')
  })

  it('stay longer extends the hold out by 15 s, breathe in now ends it', () => {
    const cfg = defaultConfig()
    let s = jumpToCycle(initialState(cfg), 0, cfg).state
    while (s.phase !== 'holdOut') s = skipPhase(s, cfg).state
    const base = s.phaseDuration
    s = extendHold(s)
    expect(s.phaseDuration).toBe(base + 15_000)
    s = skipPhase(s, cfg).state
    expect(s.phase).toBe('inhale')
  })

  it('a break slows the breath without stopping the cycle clock', () => {
    const cfg = defaultConfig()
    let s = jumpToCycle(initialState(cfg), 0, cfg).state
    s = toggleBreak(s)
    const r = run(s, 30_000, cfg)
    expect(r.state.phaseElapsed).toBe(30_000)
    expect(r.events.filter((e) => e.type === 'breath').length).toBeLessThanOrEqual(8)
  })

  it('pause freezes time', () => {
    const cfg = defaultConfig()
    const s = togglePause(initialState(cfg))
    const r = run(s, 5000, cfg)
    expect(r.state.totalElapsed).toBe(0)
  })

  it('handles a large background jump without skipping phase events', () => {
    const cfg = defaultConfig()
    const r = step(initialState(cfg), 10 * 60_000, cfg)
    const phases = r.events.filter((e) => e.type === 'phase')
    expect(phases.length).toBeGreaterThan(6)
  })

  it('total runtime lands around 45 minutes for 9 cycles', () => {
    const min = totalPlannedMs(defaultConfig()) / 60_000
    expect(min).toBeGreaterThan(40)
    expect(min).toBeLessThan(50)
  })

  it('time remaining follows jumps', () => {
    const cfg = defaultConfig()
    const start = initialState(cfg)
    expect(remainingMs(start, cfg)).toBe(totalPlannedMs(cfg))
    const at5 = jumpToCycle(start, 4, cfg).state
    const cycleMs = (i: number) => (['breathe', 'letGo', 'holdOut', 'inhale', 'holdIn', 'release'] as Phase[]).reduce((n, p) => n + phaseDurationMs(p, i, cfg), 0)
    const before = cfg.arriveSec * 1000 + [0, 1, 2, 3].reduce((n, i) => n + cycleMs(i), 0)
    expect(remainingMs(at5, cfg)).toBe(totalPlannedMs(cfg) - before)
    expect(remainingMs(jumpToCycle(start, 9, cfg).state, cfg)).toBe(cfg.restSec * 1000)
  })

  it('runs any number of cycles from 1 to 9, in order, then rest', () => {
    for (const n of [1, 3, 5]) {
      const cfg = defaultConfig({ cycleCount: n })
      expect(cfg.cycles.map((c) => c.number)).toEqual(Array.from({ length: n }, (_, i) => i + 1))
      const { events } = run(initialState(cfg), totalPlannedMs(cfg) + 1000, cfg, 250)
      const phases = events.filter((e) => e.type === 'phase').map((e) => (e as { phase: Phase }).phase)
      expect(phases.filter((p) => p === 'holdOut')).toHaveLength(n)
      expect(phases.slice(-2)).toEqual(['rest', 'complete'])
    }
  })

  it('clamps the cycle count to 1..9', () => {
    expect(defaultConfig({ cycleCount: 0 }).cycles).toHaveLength(1)
    expect(defaultConfig({ cycleCount: 12 }).cycles).toHaveLength(9)
  })

  it('scrubbing lands on the right phase, offset and breath', () => {
    const cfg = defaultConfig()
    const s0 = initialState(cfg)
    // 10 s into the hold on empty of cycle 3
    expect(phaseAt(0, cfg).phase).toBe('arrive')
    const t = plannedStart('holdOut', 2, cfg)
    const { state, events } = seekTo(s0, t + 10_000, cfg)
    expect(state.phase).toBe('holdOut')
    expect(state.cycleIndex).toBe(2)
    expect(state.phaseElapsed).toBe(10_000)
    expect(events[0]).toEqual({ type: 'phase', phase: 'holdOut', cycleIndex: 2 })
    expect(events.find((e) => e.type === 'cue')).toBeTruthy()
  })

  it('scrubbing mid-breathing reproduces the uninterrupted breath position', () => {
    const cfg = defaultConfig()
    const start = jumpToCycle(initialState(cfg), 1, cfg).state
    const played = run(start, 60_000, cfg, 100).state
    const sought = seekTo(initialState(cfg), plannedStart('breathe', 1, cfg) + 60_000, cfg).state
    expect(sought.cycleIndex).toBe(1)
    expect(sought.phase).toBe('breathe')
    expect(sought.breathPos).toBeCloseTo(played.breathPos, 3)
  })

  it('scrubbing past the end lands in the rest', () => {
    const cfg = defaultConfig({ cycleCount: 2 })
    expect(seekTo(initialState(cfg), 10 * 3600_000, cfg).state.phase).toBe('rest')
  })
})

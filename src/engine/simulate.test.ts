import { describe, expect, it } from 'vitest'
import { defaultConfig, totalPlannedMs } from './session'
import { plannedStart, simulate } from './simulate'

describe('breath map simulation', () => {
  const cfg = defaultConfig()
  const plan = simulate(cfg, 100)

  it('covers the whole planned session', () => {
    expect(Math.abs(plan.totalMs - totalPlannedMs(cfg))).toBeLessThanOrEqual(200)
  })

  it('has six phases per cycle plus arrive and rest', () => {
    expect(plan.spans).toHaveLength(9 * 6 + 2)
    expect(plan.spans[0].phase).toBe('arrive')
    expect(plan.spans.at(-1)!.phase).toBe('rest')
  })

  it('lungs are empty during every hold out and full during every hold at the top', () => {
    for (const sp of plan.spans) {
      const mid = Math.floor((sp.start + sp.end) / 2 / plan.dt)
      if (sp.phase === 'holdOut') expect(plan.fill[mid]).toBe(0)
      if (sp.phase === 'holdIn') expect(plan.fill[mid]).toBe(1)
    }
  })

  it('counts more breaths in later cycles as the pace quickens', () => {
    expect(plan.breaths[0]).toBeGreaterThan(30)
    expect(plan.breaths[8]).toBeGreaterThan(plan.breaths[0])
  })

  it('plannedStart matches simulated span starts', () => {
    const sp = plan.spans.find((x) => x.phase === 'holdOut' && x.cycleIndex === 3)!
    expect(Math.abs(plannedStart('holdOut', 3, cfg) - sp.start)).toBeLessThanOrEqual(200)
  })

  it('maps a single-cycle session', () => {
    const one = simulate(defaultConfig({ cycleCount: 1 }), 100)
    expect(one.spans.map((x) => x.phase)).toEqual(['arrive', 'breathe', 'letGo', 'holdOut', 'inhale', 'holdIn', 'release', 'rest'])
  })

  it('breaths get shorter through each cycle and across the session', () => {
    const gaps = (i: number) => {
      const t = plan.inhaleTimes[i]
      return t.slice(1).map((v, k) => v - t[k])
    }
    const first = gaps(0)
    expect(first[0]).toBeGreaterThan(first.at(-1)! * 1.5)
    const avg = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length
    expect(avg(gaps(0))).toBeGreaterThan(avg(gaps(8)))
  })
})

import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { SessionConfig } from '../engine/session'
import { cycleRange, describeAt, simulate, spanAt, type BreathPlan, type PhaseSpan } from '../engine/simulate'
import { Scrub } from './Scrub'
import type { ChangeMode } from '../store'
import { fmt } from '../util'

/**
 * Breath map, drawn like the hand sketch in the blueprint:
 *   /\/\/\/\/\  breathing,  ‾‾ hold at the top,  __ hold out on empty
 * Overview = the whole journey. Detail = one cycle, sample accurate.
 */

const GOLD = '#d4a037'
const GOLD_BRIGHT = '#e8c476'
const CYAN = '#00bcd4'
const VIOLET = '#a78bfa'
const PINK = '#e06b8a'

/** Draw at the container's real pixel width so text never stretches */
function useWidth(fallback = 800) {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(fallback)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

export function usePlan(cfg: SessionConfig) {
  return useMemo(() => simulate(cfg, 100), [cfg])
}

function cycleSpans(plan: BreathPlan, i: number) {
  const s = plan.spans.filter((x) => x.cycleIndex === i && x.phase !== 'arrive' && x.phase !== 'rest')
  const get = (p: PhaseSpan['phase']) => s.find((x) => x.phase === p)!
  return { all: s, breathe: get('breathe'), letGo: get('letGo'), holdOut: get('holdOut'), inhale: get('inhale'), holdIn: get('holdIn'), release: get('release') }
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

export function BreathMapOverview({
  cfg,
  selected,
  onSelect,
  playheadMs,
  compact = false,
}: {
  cfg: SessionConfig
  selected?: number | null
  onSelect?: (i: number) => void
  playheadMs?: number
  compact?: boolean
}) {
  const plan = usePlan(cfg)
  const [box, W] = useWidth()
  const H = compact ? 72 : 168
  const yTop = compact ? 20 : 34
  const yBot = compact ? 62 : 118
  const numY = compact ? 12 : 18
  const y = (f: number) => yBot - f * (yBot - yTop)
  const x = (ms: number) => (ms / plan.totalMs) * W

  const arrive = plan.spans[0]
  const rest = plan.spans.at(-1)!

  // Build the stylised path
  const pts: [number, number][] = []
  // Arrival: a few slow waves at half depth
  const arriveWaves = Math.max(2, Math.round((arrive.end - arrive.start) / 8000))
  for (let k = 0; k <= arriveWaves * 2; k++) {
    pts.push([x(arrive.start + ((arrive.end - arrive.start) * k) / (arriveWaves * 2)), y(k % 2 ? 0.55 : 0.18)])
  }
  cfg.cycles.forEach((_, i) => {
    const c = cycleSpans(plan, i)
    // One tooth per few real breaths, so the zigzag tightens as the pace builds
    const ins = plan.inhaleTimes[i]
    const every = Math.max(1, Math.round(ins.length / 14))
    const marks = ins.filter((_, k) => k % every === 0)
    marks.forEach((tIn, k) => {
      const tNext = marks[k + 1] ?? c.breathe.end
      pts.push([x(tIn), y(0.24)])
      pts.push([x((tIn + tNext) / 2), y(0.82)])
    })
    pts.push([x(c.letGo.end), y(0)])
    pts.push([x(c.holdOut.end), y(0)])
    pts.push([x(c.inhale.end), y(1)])
    pts.push([x(c.holdIn.end), y(1)])
    pts.push([x(c.release.end), y(0.24)])
  })
  // Rest: soft natural breath fading out
  const restWaves = Math.max(2, Math.round((rest.end - rest.start) / 12000))
  for (let k = 1; k <= restWaves * 2; k++) {
    const amp = 0.4 * (1 - k / (restWaves * 2 + 1))
    pts.push([x(rest.start + ((rest.end - rest.start) * k) / (restWaves * 2)), y(k % 2 ? 0.2 + amp : 0.15)])
  }
  const d = pts.map(([px, py], k) => `${k ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join('')

  return (
    <div ref={box} className="bm-box">
    <svg
      className="breath-map"
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Breath map: ${cfg.cycles.length} cycles over ${fmt(plan.totalMs)}. Each cycle is rhythmic breathing, a hold on empty, then a hold at the top.`}
    >
      <defs>
        <linearGradient id="bm-stroke" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={VIOLET} />
          <stop offset="0.35" stopColor={GOLD} />
          <stop offset="0.7" stopColor={PINK} />
          <stop offset="1" stopColor={VIOLET} />
        </linearGradient>
      </defs>

      {/* cycle columns */}
      {cfg.cycles.map((c, i) => {
        const s = cycleSpans(plan, i)
        const x0 = x(s.breathe.start)
        const x1 = x(s.release.end)
        const active = selected === i
        return (
          <g key={c.id} className="bm-col" onClick={onSelect ? () => onSelect(i) : undefined} style={{ cursor: onSelect ? 'pointer' : 'default' }}>
            <rect x={x0} y={0} width={x1 - x0} height={H} fill={active ? 'rgba(212,160,55,0.07)' : i % 2 ? 'rgba(255,255,255,0.012)' : 'rgba(255,255,255,0.028)'} />
            {active ? <rect x={x0} y={0} width={x1 - x0} height={2} fill={GOLD} /> : null}
            <text x={(x0 + x1) / 2} y={numY} textAnchor="middle" className={`bm-num ${active ? 'on' : ''}`}>
              {c.number}
            </text>
            {/* hold-out shading and label */}
            <rect x={x(s.holdOut.start)} y={yTop - 4} width={x(s.holdOut.end) - x(s.holdOut.start)} height={yBot - yTop + 8} fill="rgba(0,188,212,0.06)" />
            <text x={(x(s.holdOut.start) + x(s.holdOut.end)) / 2} y={yBot + 22} textAnchor="middle" className="bm-hold" display={compact ? 'none' : undefined}>
              {Math.round((s.holdOut.end - s.holdOut.start) / 1000)}s
            </text>
            <title>{`Cycle ${c.number} · ${c.title}: breathe ${fmt(s.breathe.end - s.breathe.start)}, hold out ${fmt(s.holdOut.end - s.holdOut.start)}, hold in ${Math.round((s.holdIn.end - s.holdIn.start) / 1000)}s`}</title>
          </g>
        )
      })}

      {/* baseline and top guides */}
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgba(0,188,212,0.25)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
      <line x1={0} x2={W} y1={y(1)} y2={y(1)} stroke="rgba(232,196,118,0.2)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />

      <path d={d} fill="none" stroke="url(#bm-stroke)" strokeWidth={1.4} strokeLinejoin="round" vectorEffect="non-scaling-stroke" />

      {/* emphasise holds */}
      {cfg.cycles.map((_, i) => {
        const s = cycleSpans(plan, i)
        return (
          <g key={i}>
            <line x1={x(s.holdOut.start)} x2={x(s.holdOut.end)} y1={y(0)} y2={y(0)} stroke={CYAN} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            <line x1={x(s.holdIn.start)} x2={x(s.holdIn.end)} y1={y(1)} y2={y(1)} stroke={GOLD_BRIGHT} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          </g>
        )
      })}

      <text x={x((arrive.start + arrive.end) / 2)} y={numY} textAnchor="middle" className="bm-num">in</text>
      <text x={x((rest.start + rest.end) / 2)} y={numY} textAnchor="middle" className="bm-num">rest</text>

      {playheadMs !== undefined ? (
        <g>
          <line x1={x(playheadMs)} x2={x(playheadMs)} y1={yTop - 8} y2={H - 4} stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          <circle cx={x(playheadMs)} cy={yTop - 8} r={3} fill="#fff" />
        </g>
      ) : null}
    </svg>
    </div>
  )
}

// ---------------------------------------------------------------------------
// One cycle, sample accurate
// ---------------------------------------------------------------------------

export function BreathMapCycle({
  cfg,
  index,
  changeMode = 'release',
  playheadMs,
  compact = false,
}: {
  cfg: SessionConfig
  index: number
  changeMode?: ChangeMode
  /** planned ms from the start of the session */
  playheadMs?: number
  compact?: boolean
}) {
  const plan = usePlan(cfg)
  const s = cycleSpans(plan, index)
  const t0 = s.breathe.start
  const t1 = s.release.end
  const [box, W] = useWidth()
  const H = compact ? 64 : 236
  const yTop = compact ? 8 : 40
  const yBot = compact ? 56 : 132
  const y = (f: number) => yBot - f * (yBot - yTop)
  const x = (ms: number) => ((ms - t0) / (t1 - t0)) * W

  const d = useMemo(() => {
    const a = Math.floor(t0 / plan.dt)
    const b = Math.min(plan.fill.length - 1, Math.ceil(t1 / plan.dt))
    let out = ''
    for (let k = a; k <= b; k++) out += `${k === a ? 'M' : 'L'}${x(k * plan.dt).toFixed(1)} ${y(plan.fill[k]).toFixed(1)}`
    return out
    // x and y are derived from W, t0, t1 and compact
  }, [plan, t0, t1, compact, W])

  const c = cfg.cycles[index]
  const dur = (sp: PhaseSpan) => sp.end - sp.start
  const changeAt = changeMode === 'release' ? s.release.start : s.holdOut.start
  const segs: { sp: PhaseSpan; label: string; sub: string; color: string }[] = [
    {
      sp: s.breathe,
      label: 'Rhythmic breathing',
      sub: `${fmt(dur(s.breathe))} · about ${plan.breaths[index]} breaths · ${(c.startPeriodSec * cfg.paceScale).toFixed(1)}s per breath building to ${(c.breathPeriodSec * cfg.paceScale).toFixed(1)}s`,
      color: GOLD,
    },
    { sp: s.letGo, label: 'All the way out', sub: `${Math.round(dur(s.letGo) / 1000)}s`, color: VIOLET },
    { sp: s.holdOut, label: 'Hold on empty', sub: fmt(dur(s.holdOut)), color: CYAN },
    { sp: s.inhale, label: 'Big breath in', sub: `${Math.round(dur(s.inhale) / 1000)}s`, color: VIOLET },
    { sp: s.holdIn, label: 'Hold at the top', sub: `${Math.round(dur(s.holdIn) / 1000)}s · 4 3 2 1`, color: GOLD_BRIGHT },
    { sp: s.release, label: 'Release', sub: `${Math.round(dur(s.release) / 1000)}s`, color: PINK },
  ]

  return (
    <div ref={box} className="bm-box">
    <svg
      className={`breath-map ${compact ? 'compact' : ''}`}
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Cycle ${c.number}, ${c.title}: breathe ${fmt(dur(s.breathe))}, hold on empty ${fmt(dur(s.holdOut))}, hold at the top ${Math.round(dur(s.holdIn) / 1000)} seconds.`}
    >
      {/* phase bands */}
      {segs.map((g) => (
        <rect key={g.label} x={x(g.sp.start)} y={yTop - 6} width={Math.max(0.5, x(g.sp.end) - x(g.sp.start))} height={yBot - yTop + 12} fill={g.color} opacity={g.sp.phase === 'breathe' ? 0.03 : 0.08} />
      ))}
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="rgba(0,188,212,0.25)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
      <line x1={0} x2={W} y1={y(1)} y2={y(1)} stroke="rgba(232,196,118,0.2)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
      <path d={d} fill="none" stroke={GOLD} strokeWidth={compact ? 1 : 1.3} strokeLinejoin="round" vectorEffect="non-scaling-stroke" opacity={compact ? 0.75 : 0.95} />
      <line x1={x(s.holdOut.start)} x2={x(s.holdOut.end)} y1={y(0)} y2={y(0)} stroke={CYAN} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <line x1={x(s.holdIn.start)} x2={x(s.holdIn.end)} y1={y(1)} y2={y(1)} stroke={GOLD_BRIGHT} strokeWidth={3} strokeLinecap="round" vectorEffect="non-scaling-stroke" />

      {/* music change marker */}
      <line x1={x(changeAt)} x2={x(changeAt)} y1={yTop - 6} y2={yBot + 6} stroke={PINK} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />

      {!compact ? (
        <>
          <text x={x(changeAt)} y={yTop - 14} textAnchor="end" className="bm-label pink">
            next track ♪
          </text>
          {/* annotations under the plot, staggered so short phases stay legible */}
          {segs.map((g) => {
            const cx = (x(g.sp.start) + x(g.sp.end)) / 2
            // Long phases label in place; short ones step down a staircase on the right
            const ROWS: Partial<Record<PhaseSpan['phase'], number>> = { letGo: 1, inhale: 2, holdIn: 3, release: 4 }
            const row = ROWS[g.sp.phase] ?? 0
            const ty = yBot + 24 + row * 19
            const tx = row === 0 ? cx : Math.min(W - 2, x(g.sp.end) + 4)
            return (
              <g key={g.label}>
                {row > 0 ? <line x1={cx} x2={cx} y1={yBot + 8} y2={ty - 4} stroke={g.color} opacity={0.5} vectorEffect="non-scaling-stroke" /> : null}
                <text x={row === 0 ? tx : cx - 6} y={ty} textAnchor={row === 0 ? 'middle' : 'end'} className="bm-label" fill={g.color}>
                  {g.label} <tspan className="bm-sub">{g.sub}</tspan>
                </text>
              </g>
            )
          })}
        </>
      ) : null}

      {playheadMs !== undefined && playheadMs >= t0 && playheadMs <= t1 ? (
        <line x1={x(playheadMs)} x2={x(playheadMs)} y1={2} y2={H - 2} stroke="#fff" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
    </div>
  )
}

/** Overview plus a selectable cycle detail, for Home and the Ready step */
export function BreathMapExplorer({ cfg, changeMode }: { cfg: SessionConfig; changeMode?: ChangeMode }) {
  const [sel, setSel] = useState(0)
  const plan = usePlan(cfg)
  const i = Math.min(sel, cfg.cycles.length - 1)
  const c = cfg.cycles[i]
  const [c0, c1] = cycleRange(plan, i)
  return (
    <div className="stack gap-4">
      <div className="bm-frame">
        <Scrub
          t0={0}
          t1={plan.totalMs}
          label="Journey timeline"
          describe={(ms) => describeAt(plan, ms)}
          onSeek={(ms) => {
            const sp = spanAt(plan, ms)
            if (sp.phase !== 'arrive' && sp.phase !== 'rest') setSel(sp.cycleIndex)
          }}
        >
          <BreathMapOverview cfg={cfg} selected={i} onSelect={setSel} />
        </Scrub>
      </div>
      <div className="bm-legend">
        <span><i style={{ background: GOLD }} /> breathing</span>
        <span><i style={{ background: CYAN }} /> hold on empty</span>
        <span><i style={{ background: GOLD_BRIGHT }} /> hold at the top</span>
        <span><i style={{ background: PINK }} /> track change</span>
        <span className="faint">Drag along the timeline to see each moment. Tap a cycle to zoom in.</span>
      </div>
      <div className="card stack gap-3">
        <div className="row between gap-3 wrap">
          <div>
            <span className="eyebrow">Cycle {c.number}</span>
            <div className="h3">{c.title}</div>
          </div>
          <div className="row gap-2">
            <button className="icon-btn sm" aria-label="Previous cycle" disabled={i === 0} onClick={() => setSel(i - 1)}>
              ‹
            </button>
            <button className="icon-btn sm" aria-label="Next cycle" disabled={i === cfg.cycles.length - 1} onClick={() => setSel(i + 1)}>
              ›
            </button>
          </div>
        </div>
        <div className="bm-frame">
          <Scrub t0={c0} t1={c1} label={`Cycle ${c.number} timeline`} describe={(ms) => describeAt(plan, ms)}>
            <BreathMapCycle cfg={cfg} index={i} changeMode={changeMode} />
          </Scrub>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {c.subtitle}. Music: {c.music.mood.toLowerCase()} ({c.music.tempo}).
        </p>
      </div>
    </div>
  )
}

import { useMemo } from 'react'
import { BreathMapExplorer } from '../components/BreathMap'
import { Icon } from '../components/Icon'
import { CYCLES } from '../data/blueprint'
import { defaultConfig, totalPlannedMs } from '../engine/session'
import { useMix, useSettings } from '../store'
import { fmt, fmtMinutes } from '../util'

const COUNT_WORDS: Record<number, string> = { 1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight', 9: 'Nine' }

export function HomeView({ onBegin, onMusic }: { onBegin: (quick: boolean) => void; onMusic: () => void }) {
  const [settings] = useSettings()
  const [mix] = useMix()
  const cfg = useMemo(
    () => defaultConfig({ cycleCount: settings.cycleCount, timeScale: settings.timeScale, paceScale: settings.paceScale }),
    [settings.cycleCount, settings.timeScale, settings.paceScale],
  )
  const total = totalPlannedMs(cfg)
  const musicCount = CYCLES.filter((c) => (mix[c.id as keyof typeof mix] || []).length).length

  return (
    <>
      <section className="hero">
        <div className="stack gap-6" style={{ alignItems: 'center', maxWidth: 720 }}>
          <img className="hero-mark" src="/brand/light-school-mark-transparent.svg" alt="" />
          <span className="eyebrow">Light School · Guided breathwork</span>
          <h1 className="display">
            Breathe your way <span className="shine">home</span>
          </h1>
          <p className="lede" style={{ textAlign: 'center' }}>
            {COUNT_WORDS[settings.cycleCount] ?? settings.cycleCount} {settings.cycleCount === 1 ? 'cycle' : 'cycles'} of guided breath. From the body, through resistance and the heart, to the question you came with. Your music, changing with every exhale.
          </p>
          <div className="row gap-3 wrap center">
            <button className="btn btn-primary btn-lg" onClick={() => onBegin(settings.introDone)}>
              {settings.introDone ? 'Begin a journey' : 'Begin'} <Icon name="forward" />
            </button>
            {settings.introDone ? (
              <button className="btn btn-lg" onClick={() => onBegin(false)}>
                Full introduction
              </button>
            ) : (
              <button className="btn btn-lg" onClick={onMusic}>
                <Icon name="music" /> Choose music
              </button>
            )}
          </div>
          <div className="row gap-3 wrap center faint small">
            <span className="pill">
              <Icon name="clock" className="icon" /> About {fmtMinutes(total)}
            </span>
            <span className="pill">{settings.cycleCount === 1 ? '1 cycle' : `${settings.cycleCount} cycles`}</span>
            <span className={`pill ${musicCount ? 'gold' : ''}`}>
              <Icon name="music" className="icon" /> {musicCount ? `Music for ${musicCount} cycles` : 'Headphones recommended'}
            </span>
          </div>
        </div>
      </section>

      <section className="page stack gap-8" aria-labelledby="arc-title">
        <div className="stack gap-3" style={{ textAlign: 'center', alignItems: 'center' }}>
          <span className="eyebrow" id="arc-title">
            The arc
          </span>
          <h2 className="h2">Each cycle a little longer, a little deeper</h2>
          <p className="muted" style={{ margin: 0, maxWidth: '36em' }}>
            Rhythmic breathing quickens from cycle to cycle, and the holds on empty stretch from 30 seconds to over a minute. Every cycle ends with a big breath in and ten seconds at the top.
          </p>
        </div>
        <BreathMapExplorer cfg={cfg} changeMode={settings.changeMode} />
        <ol className="stack gap-2" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {CYCLES.map((c) => (
            <li key={c.id} className="card hover row gap-4" style={{ padding: '0.9rem 1.1rem', opacity: c.number > settings.cycleCount ? 0.5 : 1 }}>
              <span className="slot-num" style={{ width: 38, height: 38, fontSize: '1rem' }}>
                {c.number}
              </span>
              <div className="grow">
                <div className="h3">{c.title}</div>
                <div className="small muted">{c.subtitle}</div>
              </div>
              <span className="small faint" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                {fmt(c.breatheSec * settings.timeScale * 1000)} breath
                <br />
                {Math.round(c.holdOutSec * settings.timeScale)}s hold
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}

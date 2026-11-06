import { useEffect, useRef, useState } from 'react'
import { chime, tick, unlockAudio } from '../audio/sound'
import { hush, speak, unlockVoice } from '../audio/voice'
import { PRACTICE_LINES as P } from '../data/voice'
import { BreathOrb } from './BreathOrb'

interface Beat {
  label: string
  sub?: string
  ms: number
  from: number
  to: number
  hold?: boolean
  speak?: string
}

const IN = 3500
const OUT = 3500

/** "Let them practise 3 times", then a short version of the hold. */
function buildTimeline(): Beat[] {
  const beats: Beat[] = []
  for (let i = 1; i <= 3; i++) {
    beats.push({ label: 'In through the nose', sub: `Breath ${i} of 3`, ms: IN, from: 0, to: 1, speak: i === 1 ? P.in : undefined })
    beats.push({ label: 'Out through the mouth', sub: `Breath ${i} of 3`, ms: OUT, from: 1, to: 0, speak: i === 1 ? P.out : undefined })
  }
  beats.push({ label: 'Big breath in', sub: 'Now a short version of the hold', ms: 3000, from: 0, to: 1, speak: P.bigIn })
  beats.push({ label: 'All the way out', ms: 3500, from: 1, to: 0, speak: P.allOut })
  beats.push({ label: 'Hold on empty', sub: 'In the journey, as long as feels right', ms: 10000, from: 0, to: 0, hold: true, speak: P.hold })
  beats.push({ label: 'Big breath in', ms: 3000, from: 0, to: 1, speak: P.recover })
  beats.push({ label: 'Hold at the top', ms: 6000, from: 1, to: 1, hold: true, speak: P.top })
  beats.push({ label: 'And let go', sub: 'A long sigh out', ms: 3500, from: 1, to: 0, speak: P.release })
  return beats
}

const TIMELINE = buildTimeline()

export function Practice({ voice }: { voice: boolean }) {
  const [running, setRunning] = useState(false)
  const [idx, setIdx] = useState(-1)
  const [holdLeft, setHoldLeft] = useState<number | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const orb = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!running) return
    let raf = 0
    const start = performance.now()
    let lastIdx = -1
    let lastCount = -1
    const total = TIMELINE.reduce((n, b) => n + b.ms, 0)
    const loop = (now: number) => {
      let t = now - start
      if (t >= total) {
        orb.current?.style.setProperty('--fill', '0.15')
        setRunning(false)
        setIdx(TIMELINE.length)
        setProgress(null)
        setHoldLeft(null)
        chime('deep')
        return
      }
      let i = 0
      while (t >= TIMELINE[i].ms) t -= TIMELINE[i++].ms
      const b = TIMELINE[i]
      const p = t / b.ms
      const eased = 0.5 - 0.5 * Math.cos(p * Math.PI)
      orb.current?.style.setProperty('--fill', String(b.from + (b.to - b.from) * eased))
      if (i !== lastIdx) {
        lastIdx = i
        setIdx(i)
        if (voice && b.speak) speak(b.speak, { interrupt: true })
        if (b.hold) chime('bright')
      }
      if (b.hold) {
        const left = Math.ceil((b.ms - t) / 1000)
        setProgress(p)
        setHoldLeft(left)
        if (b.label === 'Hold at the top' && left <= 4 && left !== lastCount) {
          lastCount = left
          tick(left)
        }
      } else {
        setProgress(null)
        setHoldLeft(null)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      hush()
    }
  }, [running, voice])

  useEffect(() => {
    orb.current?.style.setProperty('--fill', '0.15')
  }, [])

  const beat = idx >= 0 && idx < TIMELINE.length ? TIMELINE[idx] : null
  const finished = idx >= TIMELINE.length

  return (
    <div className="practice">
      <BreathOrb ref={orb} progress={progress} size="min(56vmin, 300px)">
        {beat ? (
          <>
            <div className="phase">{beat.label}</div>
            {holdLeft !== null ? <div className="timer">{holdLeft}</div> : null}
          </>
        ) : finished ? (
          <div className="phase">Beautiful</div>
        ) : null}
      </BreathOrb>
      <div style={{ minHeight: '1.6rem' }} className="small muted">
        {beat?.sub || (finished ? 'That is the whole rhythm. In the journey, each cycle builds on it.' : 'Three practice breaths, then a short hold.')}
      </div>
      <button
        className={`btn ${running ? '' : 'btn-primary'}`}
        onClick={() => {
          if (running) {
            setRunning(false)
            setIdx(-1)
            return
          }
          unlockAudio()
          if (voice) unlockVoice()
          setIdx(0)
          setRunning(true)
        }}
      >
        {running ? 'Stop' : finished ? 'Practise again' : 'Practise 3 breaths'}
      </button>
    </div>
  )
}

/** Slow warm-up breath that runs by itself (used while setting the question) */
export function WarmUpOrb() {
  const orb = useRef<HTMLDivElement>(null)
  const [dir, setDir] = useState<'in' | 'out'>('in')
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const period = 8000
    let last: 'in' | 'out' = 'in'
    const loop = (now: number) => {
      const p = ((now - start) % period) / period
      orb.current?.style.setProperty('--fill', String(0.5 - 0.5 * Math.cos(p * 2 * Math.PI)))
      const d = p < 0.5 ? 'in' : 'out'
      if (d !== last) setDir((last = d))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <BreathOrb ref={orb} size="min(46vmin, 220px)">
      <div className="small" style={{ color: 'var(--text-secondary)' }}>
        {dir === 'in' ? 'Breathe in' : 'Breathe out'}
      </div>
    </BreathOrb>
  )
}

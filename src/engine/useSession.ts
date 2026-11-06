import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { initialState, step, type SessionConfig, type SessionEvent, type SessionState } from './session'

type Handler = (events: SessionEvent[], state: SessionState, catchUp: boolean) => void

/**
 * Drives the pure engine. requestAnimationFrame keeps the orb smooth while
 * visible; a slow interval keeps phases (and music changes) on time when the
 * tab is in the background or the screen dims.
 */
export function useSession(cfg: SessionConfig, onEvents: Handler, onFrame: (s: SessionState) => void) {
  const ref = useRef<SessionState>(initialState(cfg))
  const [ui, setUi] = useState<SessionState>(ref.current)
  const handler = useRef(onEvents)
  const frame = useRef(onFrame)
  useLayoutEffect(() => {
    handler.current = onEvents
    frame.current = onFrame
  })

  useEffect(() => {
    let last = performance.now()
    let lastUi = 0
    let raf = 0
    const tickAt = (now: number) => {
      const dt = now - last
      last = now
      if (dt <= 0) return
      const r = step(ref.current, dt, cfg)
      ref.current = r.state
      if (r.events.length) handler.current(r.events, r.state, dt > 2500)
      frame.current(r.state)
      if (r.events.length || now - lastUi > 120) {
        lastUi = now
        setUi(r.state)
      }
    }
    const loop = (now: number) => {
      tickAt(now)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const iv = window.setInterval(() => {
      if (document.hidden) tickAt(performance.now())
    }, 500)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(iv)
    }
  }, [cfg])

  /** Apply a user action: a pure transform that may emit events */
  const act = useCallback(
    (fn: (s: SessionState) => SessionState | { state: SessionState; events: SessionEvent[] }) => {
      const r = fn(ref.current)
      const res = 'events' in r ? r : { state: r, events: [] as SessionEvent[] }
      ref.current = res.state
      if (res.events.length) handler.current(res.events, res.state, false)
      frame.current(res.state)
      setUi(res.state)
    },
    [],
  )

  return { state: ui, act, ref }
}

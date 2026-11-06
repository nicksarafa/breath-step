import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'

/**
 * Makes a timeline scrubbable. Drag (or tap) to pick a moment; the readout
 * follows the pointer and `onSeek` fires on release. Keyboard: arrows move
 * 5 s, Shift + arrows 30 s, Home / End jump to the ends.
 */
export function Scrub({
  t0,
  t1,
  value,
  onSeek,
  describe,
  label,
  children,
}: {
  t0: number
  t1: number
  /** current position (ms, same clock as t0/t1) */
  value?: number
  onSeek?: (ms: number) => void
  describe: (ms: number) => string
  label: string
  children: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [drag, setDrag] = useState<number | null>(null)
  const [hover, setHover] = useState<number | null>(null)

  const msAt = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect()
    const f = Math.min(1, Math.max(0, (clientX - r.left) / r.width))
    return t0 + f * (t1 - t0)
  }
  const frac = (ms: number) => Math.min(1, Math.max(0, (ms - t0) / (t1 - t0)))

  const down = (e: PointerEvent) => {
    if (e.button !== 0) return
    dragging.current = true
    ref.current?.setPointerCapture(e.pointerId)
    setDrag(msAt(e.clientX))
  }
  const move = (e: PointerEvent) => {
    const ms = msAt(e.clientX)
    if (dragging.current) setDrag(ms)
    else if (e.pointerType === 'mouse') setHover(ms)
  }
  const up = (e: PointerEvent) => {
    if (!dragging.current) return
    dragging.current = false
    const ms = msAt(e.clientX)
    setDrag(null)
    onSeek?.(ms)
  }
  const key = (e: KeyboardEvent) => {
    if (!onSeek || value === undefined) return
    const step = e.shiftKey ? 30_000 : 5_000
    const to =
      e.key === 'ArrowRight' ? value + step : e.key === 'ArrowLeft' ? value - step : e.key === 'Home' ? t0 : e.key === 'End' ? t1 - 1 : null
    if (to === null) return
    e.preventDefault()
    e.stopPropagation()
    onSeek(Math.min(t1 - 1, Math.max(t0, to)))
  }

  const shown = drag ?? hover
  const f = shown !== null ? frac(shown) : 0
  const tipShift = f < 0.12 ? '0%' : f > 0.88 ? '-100%' : '-50%'

  return (
    <div
      ref={ref}
      className={`scrub ${onSeek ? 'seekable' : ''} ${drag !== null ? 'dragging' : ''}`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={() => {
        dragging.current = false
        setDrag(null)
      }}
      onPointerLeave={() => setHover(null)}
      onKeyDown={key}
      role={onSeek ? 'slider' : undefined}
      tabIndex={onSeek ? 0 : undefined}
      aria-label={label}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? Math.round((t1 - t0) / 1000) : undefined}
      aria-valuenow={onSeek && value !== undefined ? Math.round((value - t0) / 1000) : undefined}
      aria-valuetext={onSeek && value !== undefined ? describe(value) : undefined}
    >
      {children}
      {shown !== null ? (
        <div className={`scrub-line ${drag !== null ? 'on' : ''}`} style={{ left: `${f * 100}%` }}>
          <span className="scrub-tip" style={{ transform: `translateX(${tipShift})` }}>
            {describe(shown)}
          </span>
        </div>
      ) : null}
    </div>
  )
}

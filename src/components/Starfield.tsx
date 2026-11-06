import { useEffect, useRef } from 'react'

/** Slowly turning night sky with prismatic points. Pauses when the tab is hidden. */
export function Starfield({ density = 1 }: { density?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tints = ['255,255,255', '255,255,255', '255,255,255', '232,196,118', '167,139,250', '0,188,212', '224,107,138']
    let w = 0
    let h = 0
    let dpr = 1
    let stars: { a: number; r: number; s: number; tw: number; ph: number; c: string }[] = []

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      const n = Math.round(((w * h) / 9000) * density)
      const maxR = Math.hypot(w, h) / 2
      stars = Array.from({ length: n }, () => ({
        a: Math.random() * Math.PI * 2,
        r: Math.sqrt(Math.random()) * maxR,
        s: Math.random() < 0.08 ? 1.4 + Math.random() : 0.4 + Math.random() * 0.8,
        tw: 0.3 + Math.random() * 1.2,
        ph: Math.random() * Math.PI * 2,
        c: tints[Math.floor(Math.random() * tints.length)],
      }))
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    const draw = (t: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const rot = reduced ? 0 : t * 0.0000035
      const cx = w / 2
      const cy = h * 0.45
      for (const st of stars) {
        const a = st.a + rot
        const x = cx + Math.cos(a) * st.r
        const y = cy + Math.sin(a) * st.r
        if (x < -2 || y < -2 || x > w + 2 || y > h + 2) continue
        const alpha = 0.25 + 0.55 * (0.5 + 0.5 * Math.sin(t * 0.001 * st.tw + st.ph))
        ctx.fillStyle = `rgba(${st.c},${alpha * (st.s > 1.3 ? 0.9 : 0.6)})`
        ctx.beginPath()
        ctx.arc(x, y, st.s, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!reduced) raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced) raf = requestAnimationFrame(draw)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [density])

  return (
    <>
      <canvas ref={ref} className="starfield" aria-hidden="true" />
      <div className="aurora" aria-hidden="true" />
    </>
  )
}

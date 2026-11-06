/** m:ss */
export function fmt(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function fmtMinutes(ms: number): string {
  return `${Math.round(ms / 60_000)} min`
}

/** "1:23" or "83" to milliseconds */
export function parseTime(v: string): number | undefined {
  const t = v.trim()
  if (!t) return undefined
  const m = t.match(/^(\d+):(\d{1,2})$/)
  if (m) return (Number(m[1]) * 60 + Number(m[2])) * 1000
  if (/^\d+$/.test(t)) return Number(t) * 1000
  return undefined
}

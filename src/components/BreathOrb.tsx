import { forwardRef, type ReactNode } from 'react'

/**
 * The prismatic breath orb. Its size is driven by the CSS variable --fill
 * (0 empty, 1 full), written directly each animation frame by the parent via
 * the forwarded ref, so the orb stays smooth without re-rendering React.
 */
export const BreathOrb = forwardRef<HTMLDivElement, { progress?: number | null; children?: ReactNode; size?: string; palette?: [string, string, string] }>(
  function BreathOrb({ progress = null, children, size, palette }, ref) {
    const C = 2 * Math.PI * 48
    return (
      <div
        className="orb-wrap"
        style={
          {
            ...(size ? { '--orb-size': size } : {}),
            ...(palette ? { '--orb-a': palette[0], '--orb-b': palette[1], '--orb-c': palette[2] } : {}),
          } as React.CSSProperties
        }
      >
        <svg className="orb-rings" viewBox="0 0 100 100" aria-hidden="true">
          <g className="orbit">
            <circle cx="50" cy="50" r="49" strokeDasharray="0.6 2.4" />
          </g>
          <g className="orbit rev">
            <circle cx="50" cy="50" r="44" />
            <circle cx="50" cy="6" r="0.9" fill="rgba(232,196,118,0.8)" stroke="none" />
          </g>
          <circle cx="50" cy="50" r="38" strokeDasharray="0.3 1.8" />
        </svg>
        <div ref={ref} className="orb" aria-hidden="true">
          <div className="orb-halo" />
          <div className="orb-body" />
        </div>
        {progress !== null ? (
          <svg className="orb-hold" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="track" cx="50" cy="50" r="48" />
            <circle className="prog" cx="50" cy="50" r="48" strokeDasharray={C} strokeDashoffset={C * (1 - Math.min(1, Math.max(0, progress)))} />
          </svg>
        ) : null}
        <div className="orb-label">{children}</div>
      </div>
    )
  },
)

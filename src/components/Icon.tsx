/** Thin line icons, single family, drawn to match the brand's line-icon style. */
const PATHS: Record<string, string> = {
  play: 'M8 5.5v13l10.5-6.5z',
  pause: 'M8 5v14M16 5v14',
  next: 'M6 5.5v13l9-6.5zM18 5v14',
  music: 'M9 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM20 16.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM9 18.5V6l11-2.5v13',
  voice: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11',
  voiceOff: 'M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5',
  close: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  search: 'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.8-4.8',
  back: 'M15 5l-7 7 7 7',
  forward: 'M9 5l7 7-7 7',
  up: 'M6 15l6-6 6 6',
  down: 'M6 9l6 6 6-6',
  trash: 'M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7',
  wind: 'M3 9h11a3 3 0 1 0-3-3M3 13h15a3 3 0 1 1-3 3M3 17h7',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  link: 'M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.6a7.6 7.6 0 0 1-2 1.2l-.4 2h-4l-.4-2a7.6 7.6 0 0 1-2-1.2l-1.9.6-2-3.4 1.6-1.2a7.7 7.7 0 0 1 0-3l-1.6-1.2 2-3.4 1.9.6a7.6 7.6 0 0 1 2-1.2l.4-2h4l.4 2a7.6 7.6 0 0 1 2 1.2l1.9-.6 2 3.4-1.6 1.2a7.7 7.7 0 0 1 0 3z',
  book: 'M5 4.5h9.5a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h9.5',
  heart: 'M12 19.5s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7a4.2 4.2 0 0 1 7.5 2.5c0 5.4-7.5 10-7.5 10z',
  plusTime: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 8v8M8 12h8',
  lungs: 'M12 4v8M12 12c-1.5 0-2.5-1-3.5-2.5C7 7 4 7.5 4 12v5.5c0 1.5 1.5 2 3 1.5l3-1.2c1.2-.5 2-1.6 2-3zM12 12c1.5 0 2.5-1 3.5-2.5C17 7 20 7.5 20 12v5.5c0 1.5-1.5 2-3 1.5l-3-1.2c-1.2-.5-2-1.6-2-3z',
  stop: 'M7 7h10v10H7z',
  external: 'M14 4h6v6M20 4l-9 9M18 14v5H5V6h5',
  musicOff: 'M9 18.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zM9 18.5V9M9 6l11-2.5v9M4 4l16 16',
  list: 'M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01',
  wave: 'M2 14l2.5-5 2.5 5 2.5-5 2.5 5 2.5-5 2 4h5.5',
  sparkle: 'M12 3.5l1.8 5.2 5.2 1.8-5.2 1.8L12 17.5l-1.8-5.2L5 10.5l5.2-1.8z',
}

export function Icon({ name, className = 'icon', title }: { name: keyof typeof PATHS | string; className?: string; title?: string }) {
  const filled = name === 'play' || name === 'next'
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
    >
      {title ? <title>{title}</title> : null}
      <path d={PATHS[name] || ''} />
      {name === 'next' ? <path d="M18 5v14" stroke="currentColor" strokeWidth={1.8} /> : null}
    </svg>
  )
}

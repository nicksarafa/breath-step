import { useCallback, useEffect, useRef, useState } from 'react'
import { breathTone, chime, tick, unlockAudio } from '../audio/sound'
import { hush, prepareThemeLine, speak, unlockVoice } from '../audio/voice'
import { cycleIntro, PHASE_LINES } from '../data/voice'
import { themeLines, weave } from '../data/themeGuidance'
import { BreathMapCycle, BreathMapOverview, usePlan } from '../components/BreathMap'
import { Scrub } from '../components/Scrub'
import { BreathOrb } from '../components/BreathOrb'
import { Icon } from '../components/Icon'
import { SpotifyPanel } from '../components/SpotifyPanel'
import { TrackPicker, TrackRow } from '../components/TrackPicker'
import { BRAND_PALETTE, type MusicSlotId } from '../data/blueprint'
import {
  breathPeriod,
  cycleProgress,
  defaultConfig,
  extendHold,
  jumpToCycle,
  lungFill,
  nextPhase,
  phaseLabel,
  seekTo,
  skipPhase,
  togglePause,
  remainingMs,
  type SessionConfig,
  type SessionEvent,
  type SessionState,
} from '../engine/session'
import { cycleRange, describeAt, plannedPosition, plannedStart } from '../engine/simulate'
import { useSession } from '../engine/useSession'
import { setSlotTrack } from '../mix'
import { isLoggedIn } from '../spotify/auth'
import { MusicDirector, slotForCycle } from '../spotify/director'
import { playback } from '../spotify/player'
import { usePlayback, useSpotifyAuth } from '../spotify/useSpotify'
import { useMix, useSettings, useTheme, useTopic, type ChangeMode, type VoiceMode } from '../store'
import { fmt } from '../util'

export interface SessionResult {
  cyclesCompleted: number
  completed: boolean
}

const NO_DEVICE_NOTE = 'To hear your music, open the Spotify app (on this phone or any device), play any song for a second, then come back and tap Music on.'

export function SessionView({ onFinish }: { onFinish: (r: SessionResult) => void }) {
  const [settings, setSettings] = useSettings()
  const [topic] = useTopic()
  // Configuration is fixed for the length of a session
  const [theme] = useTheme()
  const [cfg] = useState(() => {
    const base = defaultConfig({ cycleCount: settings.cycleCount, topic, paceScale: settings.paceScale, timeScale: settings.timeScale })
    if (!settings.themeGuidance || !theme.trim()) return base
    // Weave the theme questions into each cycle, and fetch their voice ahead of time
    const cycles = base.cycles.map((c, i) => {
      const lines = themeLines(i, theme)
      lines.forEach((text, line) => prepareThemeLine(text, { cycle: i, line, theme }, settings.voice !== 'off'))
      return { ...c, breatheCues: weave(c.breatheCues, lines) }
    })
    return { ...base, cycles }
  })
  const [director] = useState(() => {
    const d = new MusicDirector(cfg, { volume: settings.musicVolume, mode: settings.changeMode })
    d.enabled = settings.musicOn
    return d
  })
  const [musicNote, setMusicNote] = useState<string | null>(null)
  const orb = useRef<HTMLDivElement>(null)
  const [cue, setCue] = useState<{ text: string; key: number } | null>(null)
  const [drawer, setDrawer] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [musicError, setMusicError] = useState<string | null>(null)
  const seeking = useRef(false)
  const pendingSync = useRef(false)
  const prefs = useRef(settings)
  useEffect(() => {
    prefs.current = settings
  }, [settings])

  const onEvents = useCallback(
    (events: SessionEvent[], state: SessionState, catchUp: boolean) => {
      // After a long background gap only the latest phase matters for the music
      if (catchUp) {
        const lastPhase = [...events].reverse().find((e) => e.type === 'phase')
        if (lastPhase) director.handle([lastPhase])
        setCue(null)
        return
      }
      // A scrub re-syncs the music itself (see seek)
      if (!seeking.current) director.handle(events)
      const p = prefs.current
      const voice: VoiceMode = p.voice
      for (const e of events) {
        if (e.type === 'phase') {
          if (e.phase !== 'breathe' && e.phase !== 'holdOut' && e.phase !== 'arrive' && e.phase !== 'rest') setCue(null)
          if (e.phase === 'breathe') setCue(null)
          if (p.chimes) {
            if (e.phase === 'breathe' || e.phase === 'complete') chime('deep')
            if (e.phase === 'holdOut') chime('bright')
          }
          if (voice !== 'off') {
            if (e.phase === 'breathe') {
              speak(cycleIntro(cfg.cycles[e.cycleIndex]), { interrupt: true })
            } else if (PHASE_LINES[e.phase as keyof typeof PHASE_LINES]) speak(PHASE_LINES[e.phase as keyof typeof PHASE_LINES]!, { interrupt: true })
          }
        } else if (e.type === 'cue') {
          setCue({ text: e.text, key: Date.now() + Math.random() })
          if (voice !== 'off') speak(e.text)
        } else if (e.type === 'countdown') {
          if (p.chimes) tick(e.n)
          if (voice !== 'off') speak(String(e.n), { interrupt: true, rate: 1 })
        } else if (e.type === 'breath' && p.breathTones) {
          const period = breathPeriod(state, cfg)
          if (period) breathTone(e.dir, period / 2)
        }
      }
    },
    [cfg, director],
  )

  const onFrame = useCallback((s: SessionState) => {
    orb.current?.style.setProperty('--fill', String(lungFill(s)))
  }, [])

  const { state, act, ref } = useSession(cfg, onEvents, onFrame)

  // Start: chime, voice, music
  useEffect(() => {
    director.onError = setMusicError
    if (prefs.current.chimes) chime('deep')
    if (prefs.current.voice !== 'off') speak(PHASE_LINES.arrive, { interrupt: true })
    void director.start().then(() => {
      if (director.enabled && isLoggedIn() && !playback.isReady() && playback.needsDevice) setMusicNote(NO_DEVICE_NOTE)
    })
    return () => {
      hush()
      void director.stop()
    }
  }, [director])

  // Keep the screen awake
  useEffect(() => {
    let lock: WakeLockSentinel | null = null
    const request = () => navigator.wakeLock?.request('screen').then((l) => (lock = l)).catch(() => {})
    void request()
    const onVis = () => {
      if (!document.hidden) void request()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release()
    }
  }, [])

  useEffect(() => {
    director.setBaseVolume(settings.musicVolume)
  }, [settings.musicVolume, director])

  // Finished: hand over to integration
  useEffect(() => {
    if (state.phase === 'complete') {
      const t = setTimeout(() => onFinish({ cyclesCompleted: cfg.cycles.length, completed: true }), 2500)
      return () => clearTimeout(t)
    }
  }, [state.phase, cfg.cycles.length, onFinish])

  const pauseToggle = useCallback(() => {
    act((s) => {
      const next = togglePause(s)
      if (next.paused) {
        hush()
        void director.pause()
      } else if (pendingSync.current) {
        pendingSync.current = false
        void director.sync(next)
      } else void director.resume()
      return next
    })
  }, [act, director])

  /** Scrub: move the whole session (breath, guidance and music) to a planned moment */
  const seek = useCallback(
    (ms: number) => {
      const r = seekTo(ref.current, ms, cfg)
      seeking.current = true
      act(() => r)
      seeking.current = false
      if (r.state.paused) pendingSync.current = true
      else void director.sync(r.state)
    },
    [act, cfg, director, ref],
  )

  /** Music on or off. On finds the Spotify app if needed and picks up at the right moment. */
  const toggleMusic = useCallback(() => {
    unlockAudio()
    playback.activate()
    const on = !director.enabled
    setSettings((s) => ({ ...s, musicOn: on }))
    if (!isLoggedIn()) {
      director.enabled = on
      setMusicNote(on ? 'Connect Spotify on the Music page before your next journey to hear your songs.' : null)
      return
    }
    if (on && ref.current.paused) {
      // Start when the session resumes
      director.enabled = true
      pendingSync.current = true
      void playback.ensureDevice().then((ok) => setMusicNote(ok || !playback.needsDevice ? null : NO_DEVICE_NOTE))
      return
    }
    void director.setEnabled(on, ref.current).then((ok) => setMusicNote(on && !ok && playback.needsDevice ? NO_DEVICE_NOTE : null))
  }, [director, ref, setSettings])

  /** Voice guidance on or off. Turning it off stops anything being spoken. */
  const toggleVoice = useCallback(() => {
    unlockVoice()
    unlockAudio()
    setSettings((s) => {
      const next: VoiceMode = s.voice === 'off' ? 'full' : 'off'
      if (next === 'off') hush()
      return { ...s, voice: next }
    })
  }, [setSettings])

  /** In the hold: end it now. A natural part of the breath, so the music carries on untouched. */
  const breatheInNow = useCallback(() => act((s) => skipPhase(s, cfg)), [act, cfg])

  /** Next step: move to the start of the next phase, music included */
  const skip = useCallback(() => {
    const s = ref.current
    if (s.phase === 'holdOut') return breatheInNow()
    const n = nextPhase(s.phase, s.cycleIndex, cfg)
    if (n.phase === 'complete') return act((x) => skipPhase(x, cfg))
    seek(plannedStart(n.phase, n.cycleIndex, cfg))
  }, [act, breatheInNow, cfg, ref, seek])

  // Keyboard: space pause, L stay longer, enter / right arrow skip, M music
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && typeof t.closest === 'function' && t.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === ' ') {
        e.preventDefault()
        pauseToggle()
      } else if (e.key === 'l' || e.key === 'L') act(extendHold)
      else if (e.key === 'Enter' || e.key === 'ArrowRight') skip()
      else if (e.key === 'm' || e.key === 'M') setDrawer((d) => !d)
      else if (e.key === 'v' || e.key === 'V') toggleVoice()
      else if (e.key === 'Escape') setDrawer(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [act, pauseToggle, skip, toggleVoice])

  const c = cfg.cycles[state.cycleIndex]
  const progress = cycleProgress(state, cfg)
  const remaining = remainingMs(state, cfg)
  const holdPhase = state.phase === 'holdOut' || state.phase === 'holdIn'
  const holdProgress = holdPhase ? state.phaseElapsed / state.phaseDuration : null
  const showTopic = (c.id === 'c5' || c.id === 'c6') && state.phase === 'breathe' && topic.trim()
  const eyebrow =
    state.phase === 'arrive' ? 'Arriving' : state.phase === 'rest' || state.phase === 'complete' ? 'Integration' : `Cycle ${c.number} of ${cfg.cycles.length}`
  const title = state.phase === 'arrive' ? 'Settle in' : state.phase === 'rest' || state.phase === 'complete' ? 'Rest and receive' : c.title
  const holdOutLeft = state.phase === 'holdOut' ? state.phaseDuration - state.phaseElapsed : 0

  return (
    <div className="session">
      <header className="session-top">
        <button className="brand" onClick={() => setConfirmEnd(true)} aria-label="End session">
          <img src="/brand/light-school-mark-transparent.svg" alt="" width={30} height={30} />
        </button>
        <nav className="cycle-track" aria-label="Cycles">
          {progress.map((p, i) => (
            <button
              key={i}
              className={`cycle-seg ${i === state.cycleIndex && state.phase !== 'arrive' && state.phase !== 'rest' ? 'now' : ''}`}
              title={`Cycle ${i + 1} · ${cfg.cycles[i].title}`}
              aria-label={`Go to cycle ${i + 1}, ${cfg.cycles[i].title}`}
              onClick={() => seek(plannedStart('breathe', i, cfg))}
            >
              <i style={{ transform: `scaleX(${p})` }} />
            </button>
          ))}
        </nav>
        <div className="session-time" aria-label="Time remaining">
          {fmt(remaining)} left
        </div>
      </header>

      <main className="session-main">
        {settings.showMap ? <SessionMap cfg={cfg} state={state} view={settings.mapView} setView={(v) => setSettings((x) => ({ ...x, mapView: v }))} changeMode={settings.changeMode} onSeek={seek} /> : null}
        <div className="cycle-head">
          <div className="eyebrow">{eyebrow}</div>
          <div className="title">{title}</div>
        </div>

        <BreathOrb
          ref={orb}
          progress={holdProgress}
          palette={state.phase === 'arrive' || state.phase === 'rest' || state.phase === 'complete' ? BRAND_PALETTE : c.palette}
        >
          {state.phase === 'holdIn' && state.countdown && state.countdown <= 4 ? (
            <div className="count" aria-live="assertive">
              {state.countdown}
            </div>
          ) : (
            <>
              <div className="phase" aria-live="polite">
                {phaseLabel(state)}
              </div>
              {state.phase === 'holdOut' ? (
                <div className="timer">
                  {fmt(state.phaseElapsed)}
                  {holdOutLeft < 6000 ? <span className="faint"> · breathe in soon</span> : null}
                </div>
              ) : state.phase === 'holdIn' ? (
                <div className="timer">{Math.ceil((state.phaseDuration - state.phaseElapsed) / 1000)}</div>
              ) : null}
            </>
          )}
        </BreathOrb>

        <div className={`cue ${c.fewWords ? 'quiet' : ''}`} aria-live="polite">
          {showTopic && !cue ? <span className="topic-chip">{topic}</span> : null}
          {cue ? <p key={cue.key}>{cue.text}</p> : null}
        </div>
      </main>

      <footer className="dock">
        {musicNote ? (
          <div className="dock-note" role="status">
            <span>{musicNote}</span>
            <button className="icon-btn sm" aria-label="Dismiss" onClick={() => setMusicNote(null)}>
              <Icon name="close" />
            </button>
          </div>
        ) : null}
        {state.phase === 'holdOut' || state.phase === 'rest' ? (
          <div className="dock-actions">
            {state.phase === 'holdOut' ? (
              <>
                <button className="btn" onClick={() => act(extendHold)} title="Stay longer (L)">
                  <Icon name="plusTime" /> Stay longer
                </button>
                <button className="btn btn-primary" onClick={breatheInNow} title="Breathe in now (Enter)">
                  <Icon name="lungs" /> Breathe in now
                </button>
              </>
            ) : (
              <button className="btn btn-primary" onClick={() => onFinish({ cyclesCompleted: cfg.cycles.length, completed: true })}>
                I am ready to return
              </button>
            )}
          </div>
        ) : null}
        <div className="dock-bar">
          <NowPlayingChip onOpen={() => setDrawer(true)} />
          <div className="dock-tools" role="toolbar" aria-label="Session controls">
            <button className="tool" onClick={pauseToggle} title="Pause (space)">
              <Icon name={state.paused ? 'play' : 'pause'} />
              <span>{state.paused ? 'Resume' : 'Pause'}</span>
            </button>
            <button className="tool" onClick={skip} disabled={state.phase === 'rest' || state.phase === 'holdOut'} title="Next step (Enter)">
              <Icon name="next" />
              <span>Next</span>
            </button>
            <button className="tool" aria-pressed={settings.voice !== 'off'} onClick={toggleVoice} title="Voice guidance on or off (V)">
              <Icon name={settings.voice === 'off' ? 'voiceOff' : 'voice'} />
              <span>{settings.voice === 'off' ? 'Voice off' : 'Voice on'}</span>
            </button>
            <button className="tool" aria-pressed={settings.musicOn} onClick={toggleMusic} title="Music on or off">
              <Icon name={settings.musicOn ? 'music' : 'musicOff'} />
              <span>{settings.musicOn ? 'Music on' : 'Music off'}</span>
            </button>
            <button className="tool" aria-pressed={settings.showMap} onClick={() => setSettings((s) => ({ ...s, showMap: !s.showMap }))} title="Breath map">
              <Icon name="wave" />
              <span>Map</span>
            </button>
            <button className="tool" onClick={() => setDrawer(true)} title="Choose songs (M)">
              <Icon name="list" />
              <span>Songs</span>
            </button>
          </div>
        </div>
      </footer>

      {state.paused ? (
        <div className="paused-veil" onClick={pauseToggle}>
          <div className="stack gap-4" style={{ alignItems: 'center', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
            <div className="eyebrow">Paused</div>
            <div className="h2">Take all the time you need</div>
            <div className="row gap-3 wrap center">
              <button className="btn btn-primary btn-lg" onClick={pauseToggle}>
                <Icon name="play" /> Resume
              </button>
              <button className="btn btn-lg" onClick={() => setConfirmEnd(true)}>
                End
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmEnd ? (
        <div className="paused-veil" style={{ zIndex: 30 }}>
          <div className="card raised stack gap-4" style={{ maxWidth: 420, margin: '1rem' }}>
            <div className="h2">End the journey here?</div>
            <p className="small muted" style={{ margin: 0 }}>
              You can move straight into the closing rest, or leave now. Either way, take a few natural breaths before you stand up.
            </p>
            <div className="stack gap-2">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setConfirmEnd(false)
                  act((s) => {
                    const r = jumpToCycle({ ...s, paused: false }, cfg.cycles.length, cfg)
                    return r
                  })
                  void director.resume()
                }}
              >
                Go to the closing rest
              </button>
              <button className="btn" onClick={() => onFinish({ cyclesCompleted: ref.current.cycleIndex, completed: false })}>
                Leave now
              </button>
              <button className="btn btn-quiet" onClick={() => setConfirmEnd(false)}>
                Keep breathing
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {drawer ? (
        <MusicDrawer
          onClose={() => setDrawer(false)}
          onPlayNow={() => director.sync(ref.current)}
          currentSlot={state.phase === 'arrive' ? 'arrive' : state.phase === 'rest' || state.phase === 'complete' ? 'rest' : slotForCycle(state.cycleIndex, cfg)}
          nextSlot={state.phase === 'arrive' ? slotForCycle(0, cfg) : slotForCycle(state.cycleIndex + 1, cfg)}
          error={musicError}
        />
      ) : null}
    </div>
  )
}

function SessionMap({
  cfg,
  state,
  view,
  setView,
  changeMode,
  onSeek,
}: {
  cfg: SessionConfig
  state: SessionState
  view: 'cycle' | 'journey'
  setView: (v: 'cycle' | 'journey') => void
  changeMode: ChangeMode
  onSeek: (ms: number) => void
}) {
  const plan = usePlan(cfg)
  const pos = plannedPosition(state, cfg)
  const inCycle = state.phase !== 'arrive' && state.phase !== 'rest' && state.phase !== 'complete'
  const showCycle = view === 'cycle' && inCycle
  const [t0, t1] = showCycle ? cycleRange(plan, state.cycleIndex) : [0, plan.totalMs]
  return (
    <div className="session-map">
      <div className="bm-frame">
        <Scrub t0={t0} t1={t1} value={pos} onSeek={onSeek} describe={(ms) => describeAt(plan, ms)} label="Session timeline. Drag to move to any moment.">
          {showCycle ? (
            <BreathMapCycle cfg={cfg} index={state.cycleIndex} changeMode={changeMode} playheadMs={pos} compact />
          ) : (
            <BreathMapOverview cfg={cfg} playheadMs={pos} selected={inCycle ? state.cycleIndex : null} compact />
          )}
        </Scrub>
      </div>
      <div className="session-map-bar">
        <span className="micro faint">Drag the timeline to move through the session</span>
        <div className="segmented sm" role="group" aria-label="Timeline view">
          <button aria-pressed={showCycle} disabled={!inCycle} onClick={() => setView('cycle')}>
            This cycle
          </button>
          <button aria-pressed={!showCycle} onClick={() => setView('journey')}>
            Whole journey
          </button>
        </div>
      </div>
    </div>
  )
}

function NowPlayingChip({ onOpen }: { onOpen: () => void }) {
  const pb = usePlayback()
  const np = pb.nowPlaying
  if (!np) return null
  return (
    <button className="now-playing" onClick={onOpen} aria-label={`Now playing ${np.track.name}. Open music`}>
      {np.track.image ? <img src={np.track.image} alt="" className={np.paused ? '' : 'spin'} /> : <span className="art"><Icon name="music" /></span>}
      <span className="meta">
        <b>{np.track.name}</b>
        <span>
          {np.track.artists} · <span className="np-time">{fmt(np.positionMs + (np.paused ? 0 : Date.now() - np.at))}</span>
        </span>
      </span>
    </button>
  )
}

function slotName(slot: MusicSlotId) {
  return slot === 'arrive' ? 'Arrival' : slot === 'rest' ? 'Rest' : `Cycle ${slot.slice(1)}`
}

function MusicDrawer({
  onClose,
  onPlayNow,
  currentSlot,
  nextSlot,
  error,
}: {
  onClose: () => void
  onPlayNow: () => Promise<void>
  currentSlot: MusicSlotId
  nextSlot: MusicSlotId
  error: string | null
}) {
  const auth = useSpotifyAuth()
  const pb = usePlayback()
  const [mix, setMix] = useMix()
  const [settings, setSettings] = useSettings()
  const nextTracks = mix[nextSlot] || []
  const nowTracks = mix[currentSlot] || []

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer" aria-label="Music">
        <div className="drawer-head">
          <div>
            <div className="eyebrow">Music</div>
            <div className="h3">Choose as you go</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close music">
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-body">
          {error || pb.lastError ? <div className="alert">{error || pb.lastError}</div> : null}
          {!auth.loggedIn || !playback.isReady() ? <SpotifyPanel compact returnTo="session" /> : null}

          {pb.nowPlaying ? (
            <div className="stack gap-2">
              <span className="eyebrow">Now playing</span>
              <TrackRow track={pb.nowPlaying.track}>
                <button className="icon-btn sm" aria-label={pb.nowPlaying.paused ? 'Play' : 'Pause'} onClick={() => void (pb.nowPlaying?.paused ? playback.resume() : playback.pause())}>
                  <Icon name={pb.nowPlaying.paused ? 'play' : 'pause'} />
                </button>
              </TrackRow>
            </div>
          ) : null}

          <label className="stack gap-2">
            <span className="label">
              Volume <span className="faint">· {Math.round(settings.musicVolume * 100)}%</span>
            </span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={settings.musicVolume}
              onChange={(e) => setSettings((s) => ({ ...s, musicVolume: Number(e.target.value) }))}
              style={{ accentColor: 'var(--ls-gold)' }}
            />
          </label>

          <div className="stack gap-2">
            <span className="eyebrow">Up next · {slotName(nextSlot)}</span>
            {nextTracks.length ? (
              <div className="track-list">
                {nextTracks.map((t, i) => (
                  <TrackRow key={t.id} track={t}>
                    <button className="icon-btn sm" aria-label={`Remove ${t.name}`} onClick={() => setMix((m) => ({ ...m, [nextSlot]: nextTracks.filter((_, j) => j !== i) }))}>
                      <Icon name="trash" />
                    </button>
                  </TrackRow>
                ))}
              </div>
            ) : (
              <div className="empty">Nothing chosen. The current music will carry on.</div>
            )}
          </div>

          {nowTracks.length && currentSlot !== nextSlot ? (
            <div className="stack gap-2">
              <span className="eyebrow">This part · {slotName(currentSlot)}</span>
              <div className="track-list">
                {nowTracks.map((t) => (
                  <TrackRow key={t.id} track={t} />
                ))}
              </div>
            </div>
          ) : null}

          {auth.loggedIn ? (
            <div className="stack gap-2">
              <span className="eyebrow">Find a track</span>
              <TrackPicker
                actions={[
                  { id: 'next', label: 'Up next', primary: true },
                  { id: 'now', label: 'Play now' },
                ]}
                onAction={(id, t) => {
                  if (id === 'now') {
                    // Becomes this part's song and plays from the matching moment
                    setMix((m) => setSlotTrack(m, currentSlot, t))
                    void onPlayNow()
                  } else setMix((m) => setSlotTrack(m, nextSlot, t))
                }}
              />
            </div>
          ) : null}
        </div>
      </aside>
    </>
  )
}

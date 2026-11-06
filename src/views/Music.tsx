import { useState } from 'react'
import { Icon } from '../components/Icon'
import { SpotifyPanel } from '../components/SpotifyPanel'
import { TrackPicker, TrackRow } from '../components/TrackPicker'
import { CYCLES, MUSIC_SLOTS, type MusicSlotId } from '../data/blueprint'
import { autofillFromBlueprint, setSlotTrack, slotSeconds } from '../mix'
import { searchTracks, type TrackRef } from '../spotify/api'
import { useSpotifyAuth } from '../spotify/useSpotify'
import { useMix, useSettings } from '../store'
import { fmt, parseTime } from '../util'

export function MusicView({ onBack }: { onBack: () => void }) {
  const auth = useSpotifyAuth()
  const [mix, setMix] = useMix()
  const [settings, setSettings] = useSettings()
  const [openSlot, setOpenSlot] = useState<MusicSlotId | null>(null)
  const [filling, setFilling] = useState(false)
  const [fillNote, setFillNote] = useState<string | null>(null)
  const count = CYCLES.filter((c) => (mix[c.id as MusicSlotId] || []).length).length
  const emptyCycles = CYCLES.length - count

  async function fill() {
    setFilling(true)
    setFillNote(null)
    try {
      const r = await autofillFromBlueprint(mix, async (q) => (await searchTracks(q)).items)
      setMix(r.mix)
      const borrowed = r.filled.filter((f) => f.borrowed).map((f) => f.slot.replace('c', 'cycle '))
      setFillNote(
        `Filled ${r.filled.length} cycle${r.filled.length === 1 ? '' : 's'}.` +
          (borrowed.length ? ` The handout lists no track for ${borrowed.join(', ')}, so I borrowed one from an earlier cycle.` : '') +
          (r.missing.length ? ` Still empty: ${r.missing.map((m) => m.replace('c', 'cycle ')).join(', ')}.` : ''),
      )
    } catch (e) {
      setFillNote((e as Error).message)
    } finally {
      setFilling(false)
    }
  }

  const update = (slot: MusicSlotId, tracks: TrackRef[]) => setMix((m) => ({ ...m, [slot]: tracks }))

  return (
    <div className="page page-narrow stack gap-8">
      <div className="stack gap-3">
        <button className="btn btn-sm btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
          <Icon name="back" /> Back
        </button>
        <span className="eyebrow">Your soundtrack</span>
        <h1 className="h1">Music for each cycle</h1>
        <p className="lede">
          One song for each cycle, each with its own mood and tempo, from a slow, clear rhythm at the start to the peak. The next cycle's song starts on the release breath, after the volume steps down on the count of 4, 3, 2, 1. When you scrub or jump between cycles, the song picks up at the matching moment.
        </p>
      </div>

      <SpotifyPanel />

      <div className="card stack gap-4">
        <div className="h3">Transitions</div>
        <div className="stack gap-2">
          <span className="label">Change track</span>
          <div className="segmented" role="group" aria-label="When to change track">
            <button aria-pressed={settings.changeMode === 'release'} onClick={() => setSettings((s) => ({ ...s, changeMode: 'release' }))}>
              On the release breath
            </button>
            <button aria-pressed={settings.changeMode === 'holdStart'} onClick={() => setSettings((s) => ({ ...s, changeMode: 'holdStart' }))}>
              As the hold begins
            </button>
          </div>
        </div>
        <label className="stack gap-2">
          <span className="label">
            Music volume <span className="faint">· {Math.round(settings.musicVolume * 100)}%</span>
          </span>
          <input
            type="range"
            min={0.2}
            max={1}
            step={0.05}
            value={settings.musicVolume}
            onChange={(e) => setSettings((s) => ({ ...s, musicVolume: Number(e.target.value) }))}
            style={{ accentColor: 'var(--ls-gold)' }}
          />
        </label>
      </div>

      <div className="stack gap-4">
        <div className="row between">
          <span className="eyebrow">
            {count} of {CYCLES.length} cycles have a song
          </span>
          <div className="row gap-2">
            {auth.loggedIn && emptyCycles > 0 ? (
              <button className="btn btn-sm btn-primary" disabled={filling} onClick={() => void fill()}>
                <Icon name="sparkle" /> {filling ? 'Finding songs...' : 'Fill empty cycles from the blueprint'}
              </button>
            ) : null}
            {count > 0 ? (
              <button className="btn btn-sm btn-quiet" onClick={() => setMix({})}>
                Clear all
              </button>
            ) : null}
          </div>
        </div>
        {fillNote ? <div className="alert info">{fillNote}</div> : null}
        {MUSIC_SLOTS.map((slot) => {
          const cycle = CYCLES.find((c) => c.id === slot.id)
          const tracks = mix[slot.id] || []
          const secs = slotSeconds(slot.id, settings.timeScale)
          const trackMs = tracks.reduce((n, t) => n + t.durationMs - (t.startMs || 0), 0)
          const open = openSlot === slot.id
          return (
            <section key={slot.id} className={`card ${open ? 'gold' : ''}`} aria-label={slot.label}>
              <div className="slot">
                <div className={`slot-num ${cycle ? '' : 'alt'}`}>{cycle ? cycle.number : slot.id === 'arrive' ? 'in' : 'out'}</div>
                <div className="stack gap-3" style={{ minWidth: 0 }}>
                  <div className="row between gap-3 wrap">
                    <div>
                      <div className="h3">{cycle ? cycle.title : slot.label}</div>
                      <div className="small muted">{slot.hint}</div>
                    </div>
                    {secs ? (
                      <span className="pill" title="Cycle length vs your tracks">
                        <Icon name="clock" className="icon" /> {fmt(secs * 1000)}
                        {tracks.length ? <span className="faint">· music {fmt(trackMs)}</span> : null}
                      </span>
                    ) : null}
                  </div>

                  {tracks.length ? (
                    <div className="track-list">
                      {tracks.map((t, i) => (
                        <TrackRow key={t.id} track={t}>
                          <label className="sr-only" htmlFor={`start-${slot.id}-${t.id}`}>
                            Start at
                          </label>
                          <input
                            id={`start-${slot.id}-${t.id}`}
                            className="input start-at"
                            placeholder="0:00"
                            title="Start at (skip a long intro)"
                            defaultValue={t.startMs ? fmt(t.startMs) : ''}
                            onBlur={(e) => {
                              const ms = parseTime(e.target.value)
                              update(slot.id, tracks.map((x, j) => (j === i ? { ...x, startMs: ms && ms < x.durationMs ? ms : undefined } : x)))
                            }}
                          />
                          <button className="icon-btn sm" aria-label={`Remove ${t.name}`} onClick={() => update(slot.id, tracks.filter((_, j) => j !== i))}>
                            <Icon name="trash" />
                          </button>
                        </TrackRow>
                      ))}
                    </div>
                  ) : !auth.loggedIn && cycle?.suggestions.length ? (
                    <div className="empty">
                      Suggested: {cycle.suggestions.slice(0, 3).map((s) => s.label).join(' / ')}
                    </div>
                  ) : (
                    <div className="empty">{slot.id === 'arrive' ? "Empty, so cycle 1's song starts as you settle." : 'No track yet. The previous music carries on.'}</div>
                  )}

                  {auth.loggedIn ? (
                    open ? (
                      <div className="stack gap-3">
                        <TrackPicker
                          suggestions={cycle?.suggestions}
                          audition
                          actions={[{ id: 'use', label: cycle ? `Use for cycle ${cycle.number}` : 'Use', primary: true }]}
                          onAction={(_, t) => {
                            setMix((m) => setSlotTrack(m, slot.id, t))
                            setOpenSlot(null)
                          }}
                        />
                        <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpenSlot(null)}>
                          Done
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setOpenSlot(slot.id)}>
                        <Icon name={tracks.length ? 'refresh' : 'plus'} /> {tracks.length ? 'Change song' : 'Choose a song'}
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

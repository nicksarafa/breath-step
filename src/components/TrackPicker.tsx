import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { TrackSuggestion } from '../data/blueprint'
import * as sp from '../spotify/api'
import type { PlaylistRef, TrackRef } from '../spotify/api'
import { playback } from '../spotify/player'
import { fmt } from '../util'
import { Icon } from './Icon'

export function TrackRow({ track, children }: { track: TrackRef; children?: ReactNode }) {
  return (
    <div className="track">
      {track.image ? <img className="art" src={track.image} alt="" loading="lazy" /> : <div className="art" />}
      <div className="meta">
        <b title={track.name}>{track.name}</b>
        <span>
          {track.artists} · {fmt(track.durationMs)}
        </span>
      </div>
      <div className="actions">{children}</div>
    </div>
  )
}

export interface PickerAction {
  id: string
  label: string
  primary?: boolean
}

type Tab = 'search' | 'suggested' | 'playlists' | 'link'

export function TrackPicker({
  suggestions = [],
  actions,
  onAction,
  audition = false,
}: {
  suggestions?: TrackSuggestion[]
  actions: PickerAction[]
  onAction: (actionId: string, track: TrackRef) => void
  audition?: boolean
}) {
  const [tab, setTab] = useState<Tab>(suggestions.length ? 'suggested' : 'search')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TrackRef[]>([])
  const [total, setTotal] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<Record<string, string>>({})
  const seq = useRef(0)

  async function runSearch(q: string, offset = 0) {
    if (!q.trim()) return
    const id = ++seq.current
    setBusy(true)
    setError(null)
    try {
      const r = await sp.searchTracks(q, offset)
      if (id !== seq.current) return
      setResults((prev) => (offset ? [...prev, ...r.items] : r.items))
      setTotal(r.total)
    } catch (e) {
      if (id === seq.current) setError((e as Error).message)
    } finally {
      if (id === seq.current) setBusy(false)
    }
  }

  // Search as you type, gently
  useEffect(() => {
    if (tab !== 'search') return
    const t = setTimeout(() => void runSearch(query), 450)
    return () => clearTimeout(t)
    // runSearch is stable enough for this purpose
  }, [query, tab])

  function act(actionId: string, track: TrackRef) {
    onAction(actionId, track)
    setDone((d) => ({ ...d, [track.id + actionId]: 'done' }))
  }

  const actionButtons = (t: TrackRef) => (
    <>
      {audition ? (
        <button className="icon-btn sm" title="Preview on your Spotify player" aria-label={`Preview ${t.name}`} onClick={() => void playback.playTracks([t]).catch((e) => setError(e.message))}>
          <Icon name="play" />
        </button>
      ) : null}
      {actions.map((a) => (
        <button key={a.id} className={`btn btn-sm ${a.primary ? 'btn-primary' : ''}`} onClick={() => act(a.id, t)}>
          {done[t.id + a.id] ? <Icon name="check" /> : null}
          {a.label}
        </button>
      ))}
    </>
  )

  return (
    <div className="stack gap-4">
      <div className="tabs" role="tablist">
        {suggestions.length ? (
          <button role="tab" aria-selected={tab === 'suggested'} onClick={() => setTab('suggested')}>
            From the blueprint
          </button>
        ) : null}
        <button role="tab" aria-selected={tab === 'search'} onClick={() => setTab('search')}>
          Search
        </button>
        <button role="tab" aria-selected={tab === 'playlists'} onClick={() => setTab('playlists')}>
          My playlists
        </button>
        <button role="tab" aria-selected={tab === 'link'} onClick={() => setTab('link')}>
          Paste a link
        </button>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      {tab === 'suggested' ? (
        <div className="stack gap-2">
          <p className="small muted" style={{ margin: 0 }}>
            Tracks suggested for this cycle. Tap one to find it on Spotify.
          </p>
          <div className="suggest-list">
            {suggestions.map((s) => (
              <button
                key={s.label}
                onClick={() => {
                  setQuery(s.query)
                  setTab('search')
                }}
              >
                <Icon name="search" className="icon" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'search' ? (
        <div className="stack gap-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              void runSearch(query)
            }}
          >
            <label className="sr-only" htmlFor="track-search">
              Search Spotify
            </label>
            <input id="track-search" className="input" placeholder="Search a track or artist" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
          </form>
          <div className="track-list" aria-live="polite">
            {results.map((t) => (
              <TrackRow key={t.id} track={t}>
                {actionButtons(t)}
              </TrackRow>
            ))}
          </div>
          {busy ? <p className="small faint">Searching...</p> : null}
          {!busy && query && results.length === 0 ? <p className="small faint">No tracks found. Try fewer words.</p> : null}
          {results.length > 0 && results.length < total && results.length < 50 ? (
            <button className="btn btn-sm btn-quiet" onClick={() => void runSearch(query, results.length)}>
              Show more
            </button>
          ) : null}
        </div>
      ) : null}

      {tab === 'playlists' ? <PlaylistBrowser renderActions={actionButtons} onError={setError} /> : null}
      {tab === 'link' ? <LinkPaste renderActions={actionButtons} /> : null}
    </div>
  )
}

function PlaylistBrowser({ renderActions, onError }: { renderActions: (t: TrackRef) => ReactNode; onError: (m: string) => void }) {
  const [lists, setLists] = useState<PlaylistRef[] | null>(null)
  const [open, setOpen] = useState<PlaylistRef | null>(null)
  const [tracks, setTracks] = useState<TrackRef[] | null>(null)

  useEffect(() => {
    sp.myPlaylists().then(setLists).catch((e) => onError(e.message))
  }, [onError])

  useEffect(() => {
    if (!open) return
    setTracks(null)
    sp.playlistTracks(open.id).then(setTracks).catch((e) => onError(e.message))
  }, [open, onError])

  if (open) {
    return (
      <div className="stack gap-3">
        <button className="btn btn-sm btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(null)}>
          <Icon name="back" /> All playlists
        </button>
        <div className="h3">{open.name}</div>
        {!tracks ? <p className="small faint">Loading tracks...</p> : null}
        {tracks && tracks.length === 0 ? <p className="small faint">No playable tracks in this playlist.</p> : null}
        <div className="track-list">
          {tracks?.map((t, i) => (
            <TrackRow key={t.id + i} track={t}>
              {renderActions(t)}
            </TrackRow>
          ))}
        </div>
      </div>
    )
  }

  if (!lists) return <p className="small faint">Loading your playlists...</p>
  const usable = lists.filter((l) => l.ownedOrCollab)
  return (
    <div className="stack gap-3">
      <p className="small muted" style={{ margin: 0 }}>
        Tip: build a breathwork playlist in Spotify, then pick from it here. Spotify only shares the tracks of playlists you own or collaborate on.
      </p>
      {usable.length === 0 ? <div className="empty">No playlists of your own yet.</div> : null}
      <div className="playlist-grid">
        {usable.map((p) => (
          <button key={p.id} className="playlist" onClick={() => setOpen(p)}>
            {p.image ? <img src={p.image} alt="" loading="lazy" /> : <div className="ph" />}
            <b>{p.name}</b>
          </button>
        ))}
      </div>
    </div>
  )
}

function LinkPaste({ renderActions }: { renderActions: (t: TrackRef) => ReactNode }) {
  const [value, setValue] = useState('')
  const [track, setTrack] = useState<TrackRef | null>(null)
  const [err, setErr] = useState<string | null>(null)

  async function resolve(v: string) {
    setValue(v)
    setErr(null)
    setTrack(null)
    if (!v.trim()) return
    const id = sp.parseTrackId(v)
    if (!id) {
      setErr('Paste a Spotify track link, like open.spotify.com/track/...')
      return
    }
    try {
      setTrack(await sp.getTrack(id))
    } catch (e) {
      setErr((e as Error).message)
    }
  }

  return (
    <div className="stack gap-3">
      <label className="field">
        <span className="label">Spotify track link</span>
        <input className="input" placeholder="https://open.spotify.com/track/..." value={value} onChange={(e) => void resolve(e.target.value)} />
      </label>
      <p className="micro faint" style={{ margin: 0 }}>
        In Spotify: Share, then Copy Song Link.
      </p>
      {err ? <p className="small" style={{ color: '#f2a3b7', margin: 0 }}>{err}</p> : null}
      {track ? <TrackRow track={track}>{renderActions(track)}</TrackRow> : null}
    </div>
  )
}

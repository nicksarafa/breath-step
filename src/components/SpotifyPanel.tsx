import { useEffect, useState } from 'react'
import { clientIdSource, login, redirectUri, setClientId } from '../spotify/auth'
import * as sp from '../spotify/api'
import { playback } from '../spotify/player'
import { spotifyAuth, usePlayback, useSpotifyAuth } from '../spotify/useSpotify'
import { Icon } from './Icon'

export function SpotifyPanel({ compact = false, returnTo = 'music' }: { compact?: boolean; returnTo?: string }) {
  const auth = useSpotifyAuth()
  const pb = usePlayback()
  const [editingId, setEditingId] = useState(false)
  const [idInput, setIdInput] = useState('')
  const [devices, setDevices] = useState<sp.DeviceRef[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const browserUsable = pb.sdk !== 'unsupported' && pb.sdk !== 'premium-required'

  async function loadDevices() {
    try {
      setDevices(await sp.devices())
    } catch (e) {
      spotifyAuth.setError((e as Error).message)
    }
  }

  useEffect(() => {
    if (auth.loggedIn && (!browserUsable || pb.output.kind === 'device')) void loadDevices()
  }, [auth.loggedIn, browserUsable, pb.output.kind])

  // Signing in redirects away from the page, which would end a running session
  if (!auth.loggedIn && returnTo === 'session') {
    return (
      <div className="empty">
        Spotify is not connected. Connect it from the Music page before your next journey. For now, any music you play on another app will carry on alongside.
      </div>
    )
  }

  // ---- 1. No client ID: the setup guide ----
  if (!auth.clientId || editingId) {
    return (
      <div className="card stack gap-4">
        <div className="row gap-3">
          <SpotifyGlyph />
          <div className="h3">Connect your own Spotify app</div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          To play music, every person running Breath Journey uses their own free Spotify developer key. It takes two minutes.
        </p>
        <ol className="small" style={{ margin: 0, paddingLeft: '1.2rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
          <li>
            Open the{' '}
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noreferrer">
              Spotify Developer Dashboard
            </a>{' '}
            and choose Create app.
          </li>
          <li>
            Add this Redirect URI exactly:{' '}
            <button
              className="pill gold"
              style={{ cursor: 'pointer', background: 'none' }}
              onClick={() => {
                void navigator.clipboard?.writeText(redirectUri())
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }}
              title="Copy"
            >
              <span className="mono">{redirectUri()}</span>
              <Icon name={copied ? 'check' : 'link'} className="icon" />
            </button>
          </li>
          <li>Tick Web API and Web Playback SDK, then save.</li>
          <li>Under User Management, add the Spotify email of everyone who will use it.</li>
          <li>Copy the Client ID and paste it below.</li>
        </ol>
        <form
          className="row gap-2 wrap"
          onSubmit={(e) => {
            e.preventDefault()
            setClientId(idInput)
            setEditingId(false)
            spotifyAuth.refresh()
          }}
        >
          <label className="sr-only" htmlFor="client-id">
            Spotify Client ID
          </label>
          <input id="client-id" className="input grow mono" style={{ maxWidth: 380 }} placeholder="Client ID" value={idInput} onChange={(e) => setIdInput(e.target.value)} />
          <button className="btn btn-primary" disabled={idInput.trim().length < 20}>
            Save
          </button>
          {editingId ? (
            <button type="button" className="btn btn-quiet" onClick={() => setEditingId(false)}>
              Cancel
            </button>
          ) : null}
        </form>
        <p className="micro faint" style={{ margin: 0 }}>
          Your Client ID stays in this browser. No secret is needed: sign in uses PKCE. Playing in the browser needs Spotify Premium; otherwise music plays on your phone or desktop Spotify app.
        </p>
      </div>
    )
  }

  // ---- 2. Client ID, not signed in ----
  if (!auth.loggedIn) {
    return (
      <div className="card stack gap-3">
        <div className="row gap-3 between wrap">
          <div className="row gap-3">
            <SpotifyGlyph />
            <div>
              <div className="h3">Spotify</div>
              <div className="small muted">Bring your own tracks into each cycle.</div>
            </div>
          </div>
          <button
            className="btn btn-spotify"
            disabled={busy}
            onClick={() => {
              setBusy(true)
              login(returnTo).catch((e) => {
                setBusy(false)
                spotifyAuth.setError(e.message)
              })
            }}
          >
            Connect Spotify
          </button>
        </div>
        {auth.error ? <div className="alert">{auth.error}</div> : null}
        <button className="btn btn-sm btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={() => setEditingId(true)}>
          {clientIdSource() === 'env' ? 'Use a different Client ID' : 'Change Client ID'}
        </button>
      </div>
    )
  }

  // ---- 3. Connected ----
  const statusPill =
    pb.output.kind === 'device' ? (
      <span className="pill green">
        <span className="dot" /> {pb.output.name}
      </span>
    ) : pb.sdk === 'ready' ? (
      <span className="pill green">
        <span className="dot" /> This browser
      </span>
    ) : pb.sdk === 'loading' ? (
      <span className="pill">Starting player...</span>
    ) : (
      <span className="pill pink">Choose a device</span>
    )

  return (
    <div className="card stack gap-4">
      <div className="row between gap-3 wrap">
        <div className="row gap-3">
          {auth.user?.image ? <img src={auth.user.image} alt="" width={40} height={40} style={{ borderRadius: '50%' }} /> : <SpotifyGlyph />}
          <div>
            <div className="h3">{auth.user?.name || 'Spotify connected'}</div>
            <div className="small muted">Music plays on</div>
          </div>
          {statusPill}
        </div>
        {!compact ? (
          <button className="btn btn-sm btn-quiet" onClick={() => spotifyAuth.logout()}>
            Disconnect
          </button>
        ) : null}
      </div>

      {pb.sdkMessage && pb.sdk !== 'ready' ? <div className={pb.sdk === 'premium-required' ? 'alert gold' : 'alert info'}>{pb.sdkMessage}</div> : null}
      {auth.error ? <div className="alert">{auth.error}</div> : null}

      <div className="stack gap-2">
        <div className="row gap-2 wrap">
          {browserUsable ? (
            <button className="chip" aria-pressed={pb.output.kind === 'browser'} onClick={() => playback.setOutput({ kind: 'browser' })}>
              This browser
            </button>
          ) : null}
          {devices
            ?.filter((d) => d.id !== pb.browserDeviceId)
            .map((d) => (
              <button
                key={d.id}
                className="chip"
                aria-pressed={pb.output.kind === 'device' && pb.output.id === d.id}
                onClick={() => playback.setOutput({ kind: 'device', id: d.id, name: d.name })}
              >
                {d.name} <span className="faint">· {d.type.toLowerCase()}</span>
              </button>
            ))}
          <button className="btn btn-sm btn-quiet" onClick={() => void loadDevices()}>
            <Icon name="refresh" /> {devices ? 'Refresh devices' : 'Other devices'}
          </button>
        </div>
        {devices && devices.length === 0 && !browserUsable ? (
          <p className="micro faint" style={{ margin: 0 }}>
            Open Spotify on your phone or computer and play anything for a second, then refresh.
          </p>
        ) : null}
      </div>
    </div>
  )
}

function SpotifyGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#1ed760" />
      <path d="M6.5 9.3c3.7-1.1 7.7-.8 11 1M7.2 12.4c3-.8 6.2-.5 8.9 1M7.9 15.3c2.3-.6 4.7-.4 6.8.8" stroke="#000" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  )
}

/**
 * Playback controller. Plays through the Web Playback SDK (this browser,
 * Premium required, desktop only) or through Spotify Connect on another
 * device such as the Spotify app on a phone. Exposes a tiny external store for
 * React (subscribe / getSnapshot).
 */
import { getAccessToken, isLoggedIn } from './auth'
import * as sp from './api'
import type { TrackRef } from './api'

export type Output = { kind: 'browser' } | { kind: 'device'; id: string; name: string }

export interface NowPlaying {
  track: TrackRef
  paused: boolean
  positionMs: number
  /** Date.now() when positionMs was sampled */
  at: number
}

export interface PlayerSnapshot {
  sdk: 'idle' | 'loading' | 'ready' | 'unsupported' | 'premium-required' | 'error'
  sdkMessage?: string
  browserDeviceId?: string
  output: Output
  nowPlaying?: NowPlaying
  volume: number
  lastError?: string
}

const OUTPUT_KEY = 'bj.spotify.output'
const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)

function loadOutput(): Output {
  try {
    const o = JSON.parse(localStorage.getItem(OUTPUT_KEY) || 'null') as Output | null
    if (o) return o
  } catch {
    /* ignore */
  }
  return { kind: 'browser' }
}

class PlaybackController {
  private snap: PlayerSnapshot = { sdk: isMobile ? 'unsupported' : 'idle', output: loadOutput(), volume: 0.8 }
  private listeners = new Set<() => void>()
  private player: Spotify.Player | null = null
  private fadeTimer: number | null = null
  private pollTimer: number | null = null
  private lastRemoteVolumeAt = 0
  private pendingRemoteVolume: number | null = null
  private remoteVolumeTimer: number | null = null

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getSnapshot = () => this.snap

  private set(patch: Partial<PlayerSnapshot>) {
    this.snap = { ...this.snap, ...patch }
    this.listeners.forEach((l) => l())
  }

  get usingBrowser() {
    return this.snap.output.kind === 'browser' && this.snap.sdk !== 'unsupported' && this.snap.sdk !== 'premium-required'
  }

  /** Load the SDK and register this browser as a Spotify Connect device. */
  async initSdk() {
    if (!isLoggedIn() || isMobile || this.player || this.snap.sdk === 'loading') return
    this.set({ sdk: 'loading', sdkMessage: undefined })
    try {
      await loadSdkScript()
      const player = new window.Spotify.Player({
        name: 'Breath Journey · Light School',
        getOAuthToken: (cb) => {
          getAccessToken().then(cb).catch(() => cb(''))
        },
        volume: this.snap.volume,
      })
      player.addListener('ready', ({ device_id }) => this.set({ sdk: 'ready', browserDeviceId: device_id }))
      player.addListener('not_ready', () => this.set({ browserDeviceId: undefined, sdk: 'loading', sdkMessage: 'Reconnecting to Spotify...' }))
      player.addListener('account_error', () =>
        this.set({ sdk: 'premium-required', sdkMessage: 'Playing in the browser needs Spotify Premium. Choose a device such as the Spotify app instead.' }),
      )
      player.addListener('authentication_error', ({ message }) => this.set({ sdk: 'error', sdkMessage: message }))
      player.addListener('initialization_error', ({ message }) => this.set({ sdk: 'unsupported', sdkMessage: message }))
      player.addListener('playback_error', ({ message }) => this.set({ lastError: message }))
      player.addListener('player_state_changed', (state) => {
        if (!state || !this.usingBrowser) return
        const t = state.track_window.current_track
        if (!t) return
        this.set({
          nowPlaying: {
            track: {
              id: t.id || '',
              uri: t.uri,
              name: t.name,
              artists: t.artists.map((a) => a.name).join(', '),
              image: t.album.images.at(-1)?.url || t.album.images[0]?.url,
              durationMs: t.duration_ms,
            },
            paused: state.paused,
            positionMs: state.position,
            at: Date.now(),
          },
        })
      })
      const ok = await player.connect()
      if (!ok) this.set({ sdk: 'error', sdkMessage: 'Could not connect the Spotify player in this browser.' })
      this.player = player
    } catch (e) {
      this.set({ sdk: 'error', sdkMessage: (e as Error).message })
    }
  }

  /** Must run inside a user gesture (click) so browsers allow audio. */
  activate() {
    this.player?.activateElement?.().catch(() => {})
  }

  setOutput(o: Output) {
    localStorage.setItem(OUTPUT_KEY, JSON.stringify(o))
    this.set({ output: o })
  }

  targetDeviceId(): string | null {
    if (this.usingBrowser) return this.snap.browserDeviceId || null
    return this.snap.output.kind === 'device' ? this.snap.output.id : null
  }

  isReady(): boolean {
    return !!this.targetDeviceId()
  }

  async playTracks(tracks: TrackRef[], opts: { volume?: number; positionMs?: number } = {}) {
    const device = this.targetDeviceId()
    if (!device || tracks.length === 0) return
    // Repeat the list so a short pick never leaves a cycle in silence
    const uris: string[] = []
    let total = 0
    while (total < 12 * 60_000 && uris.length < 40) {
      for (const t of tracks) {
        uris.push(t.uri)
        total += t.durationMs
      }
    }
    if (opts.volume !== undefined) await this.setVolume(opts.volume, true)
    const position = opts.positionMs ?? tracks[0].startMs ?? 0
    try {
      await sp.play(device, uris, position)
    } catch (e) {
      // A freshly registered browser device sometimes needs a transfer first
      if (e instanceof sp.SpotifyError && (e.status === 404 || e.status === 502)) {
        await sp.transfer(device, false).catch(() => {})
        await new Promise((r) => setTimeout(r, 600))
        await sp.play(device, uris, position)
      } else {
        this.set({ lastError: (e as Error).message })
        throw e
      }
    }
    this.set({
      lastError: undefined,
      nowPlaying: { track: tracks[0], paused: false, positionMs: position, at: Date.now() },
    })
    this.startPolling()
  }

  async pause() {
    const device = this.targetDeviceId()
    if (this.usingBrowser && this.player) await this.player.pause()
    else if (device) await sp.pause(device).catch(() => {})
    if (this.snap.nowPlaying) this.set({ nowPlaying: { ...this.snap.nowPlaying, paused: true } })
  }

  async resume() {
    const device = this.targetDeviceId()
    if (this.usingBrowser && this.player) await this.player.resume()
    else if (device) await sp.resume(device).catch(() => {})
    if (this.snap.nowPlaying) this.set({ nowPlaying: { ...this.snap.nowPlaying, paused: false, at: Date.now() } })
  }

  /** Set volume 0..1 immediately. */
  async setVolume(v: number, cancelFade = true) {
    if (cancelFade) this.cancelFade()
    const vol = Math.max(0, Math.min(1, v))
    this.set({ volume: vol })
    if (this.usingBrowser && this.player) {
      await this.player.setVolume(Math.max(vol, 0.0001)).catch(() => {})
    } else {
      this.queueRemoteVolume(vol)
    }
  }

  /** Remote devices get coarse, rate-limited volume steps. */
  private queueRemoteVolume(vol: number) {
    const device = this.targetDeviceId()
    if (!device) return
    this.pendingRemoteVolume = vol
    const send = () => {
      this.remoteVolumeTimer = null
      if (this.pendingRemoteVolume === null) return
      const v = this.pendingRemoteVolume
      this.pendingRemoteVolume = null
      this.lastRemoteVolumeAt = Date.now()
      sp.setRemoteVolume(device, v * 100).catch(() => {})
    }
    const wait = 700 - (Date.now() - this.lastRemoteVolumeAt)
    if (wait <= 0) send()
    else if (!this.remoteVolumeTimer) this.remoteVolumeTimer = window.setTimeout(send, wait)
  }

  fadeTo(target: number, ms: number): Promise<void> {
    this.cancelFade()
    const from = this.snap.volume
    const start = performance.now()
    return new Promise((resolve) => {
      const tick = () => {
        const t = Math.min(1, (performance.now() - start) / ms)
        const v = from + (target - from) * (1 - Math.pow(1 - t, 2))
        void this.setVolume(v, false)
        if (t >= 1) {
          this.fadeTimer = null
          resolve()
        } else this.fadeTimer = window.setTimeout(tick, this.usingBrowser ? 80 : 700)
      }
      tick()
    })
  }

  private cancelFade() {
    if (this.fadeTimer) clearTimeout(this.fadeTimer)
    this.fadeTimer = null
  }

  /** Keeps now-playing fresh for remote devices, and for the browser as a fallback. */
  private startPolling() {
    if (this.pollTimer) return
    this.pollTimer = window.setInterval(async () => {
      if (this.usingBrowser) return
      try {
        const p = await sp.currentPlayback()
        if (p?.item) {
          this.set({
            nowPlaying: { track: sp.toTrackRef(p.item), paused: !p.is_playing, positionMs: p.progress_ms, at: Date.now() },
          })
        }
      } catch {
        /* transient */
      }
    }, 5000)
  }

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer)
    this.pollTimer = null
  }

  disconnect() {
    this.stopPolling()
    this.player?.disconnect()
    this.player = null
    this.set({ sdk: isMobile ? 'unsupported' : 'idle', browserDeviceId: undefined, nowPlaying: undefined })
  }
}

function loadSdkScript(): Promise<void> {
  if (window.Spotify) return Promise.resolve()
  return new Promise((resolve, reject) => {
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const s = document.createElement('script')
    s.src = 'https://sdk.scdn.co/spotify-player.js'
    s.async = true
    s.onerror = () => reject(new Error('Could not load the Spotify player.'))
    document.body.appendChild(s)
  })
}

export const playback = new PlaybackController()

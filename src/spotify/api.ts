/**
 * Thin Spotify Web API client. Written against the February 2026 Development
 * Mode rules: search returns at most 10 per page, playlist contents come from
 * /playlists/{id}/items (owned or collaborative playlists only), and /me no
 * longer reports the subscription tier.
 */
import { getAccessToken } from './auth'

export interface TrackRef {
  id: string
  uri: string
  name: string
  artists: string
  image?: string
  durationMs: number
  /** Optional start offset, for skipping long intros */
  startMs?: number
}

export interface PlaylistRef {
  id: string
  name: string
  image?: string
  owner: string
  ownedOrCollab: boolean
}

export interface DeviceRef {
  id: string
  name: string
  type: string
  is_active: boolean
}

export class SpotifyError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

const BASE = 'https://api.spotify.com/v1'

export async function api<T = unknown>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const token = await getAccessToken(attempt > 0)
  const res = await fetch(path.startsWith('http') ? path : BASE + path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  if (res.status === 401 && attempt === 0) return api<T>(path, init, 1)
  if (res.status === 429 && attempt < 2) {
    const wait = Number(res.headers.get('Retry-After') || '1')
    await new Promise((r) => setTimeout(r, Math.min(wait, 10) * 1000))
    return api<T>(path, init, attempt + 1)
  }
  if (res.status === 204 || res.status === 202) return undefined as T
  const text = await res.text()
  const body = text ? safeJson(text) : undefined
  if (!res.ok) {
    const msg = (body as { error?: { message?: string } })?.error?.message || res.statusText || 'Spotify request failed'
    throw new SpotifyError(res.status, msg)
  }
  return body as T
}

function safeJson(t: string) {
  try {
    return JSON.parse(t)
  } catch {
    return undefined
  }
}

interface RawTrack {
  id: string
  uri: string
  name: string
  type?: string
  duration_ms: number
  is_local?: boolean
  artists: { name: string }[]
  album?: { images?: { url: string; width?: number }[] }
}

export function toTrackRef(t: RawTrack): TrackRef {
  const imgs = t.album?.images || []
  // Prefer a small image: the last one is usually 64px
  const image = (imgs.find((i) => (i.width || 0) <= 300) || imgs.at(-1) || imgs[0])?.url
  return { id: t.id, uri: t.uri, name: t.name, artists: t.artists.map((a) => a.name).join(', '), image, durationMs: t.duration_ms }
}

export async function me() {
  return api<{ id: string; display_name: string; images?: { url: string }[] }>('/me')
}

/** Spotify caps page size at 10 for Development Mode apps. */
export async function searchTracks(q: string, offset = 0): Promise<{ items: TrackRef[]; total: number }> {
  const params = new URLSearchParams({ q, type: 'track', limit: '10', offset: String(offset) })
  const r = await api<{ tracks: { items: (RawTrack | null)[]; total: number } }>(`/search?${params}`)
  return { items: r.tracks.items.filter((t): t is RawTrack => !!t && !!t.id).map(toTrackRef), total: r.tracks.total }
}

export async function getTrack(id: string): Promise<TrackRef> {
  return toTrackRef(await api<RawTrack>(`/tracks/${id}`))
}

export async function myPlaylists(): Promise<PlaylistRef[]> {
  const out: PlaylistRef[] = []
  const meId = (await me()).id
  let url: string | null = '/me/playlists?limit=50'
  while (url && out.length < 500) {
    const r: {
      items: ({ id: string; name: string; collaborative: boolean; owner: { id: string; display_name?: string }; images?: { url: string }[] | null } | null)[]
      next: string | null
    } = await api(url)
    for (const p of r.items) {
      if (!p) continue
      out.push({
        id: p.id,
        name: p.name,
        image: p.images?.at(-1)?.url || p.images?.[0]?.url,
        owner: p.owner.display_name || p.owner.id,
        ownedOrCollab: p.owner.id === meId || p.collaborative,
      })
    }
    url = r.next
  }
  return out
}

/** Tracks in a playlist the user owns or collaborates on. */
export async function playlistTracks(id: string): Promise<TrackRef[]> {
  const out: TrackRef[] = []
  let url: string | null = `/playlists/${id}/items?limit=50`
  let legacy = false
  while (url && out.length < 1000) {
    let r: { items: { item?: RawTrack | null; track?: RawTrack | null }[]; next: string | null }
    try {
      r = await api(url)
    } catch (e) {
      // Older API shape, in case /items is not available to this app
      if (!legacy && e instanceof SpotifyError && e.status === 404) {
        legacy = true
        url = `/playlists/${id}/tracks?limit=50`
        continue
      }
      throw e
    }
    for (const row of r.items) {
      const t = row.item ?? row.track
      if (t && t.id && !t.is_local && (t.type ?? 'track') === 'track') out.push(toTrackRef(t))
    }
    url = r.next
  }
  return out
}

/** Accepts open.spotify.com links and spotify:track: URIs. */
export function parseTrackId(input: string): string | null {
  const s = input.trim()
  const m = s.match(/open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([A-Za-z0-9]{22})/) || s.match(/^spotify:track:([A-Za-z0-9]{22})$/)
  return m ? m[1] : /^[A-Za-z0-9]{22}$/.test(s) ? s : null
}

export async function devices(): Promise<DeviceRef[]> {
  const r = await api<{ devices: DeviceRef[] }>('/me/player/devices')
  return r.devices.filter((d) => d.id)
}

export async function transfer(deviceId: string, play = false) {
  await api('/me/player', { method: 'PUT', body: JSON.stringify({ device_ids: [deviceId], play }) })
}

export async function play(deviceId: string, uris: string[], positionMs = 0) {
  await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    body: JSON.stringify({ uris, position_ms: Math.max(0, Math.round(positionMs)) }),
  })
}

export async function pause(deviceId: string) {
  await api(`/me/player/pause?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
}

export async function resume(deviceId: string) {
  await api(`/me/player/play?device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
}

export async function setRemoteVolume(deviceId: string, percent: number) {
  const v = Math.max(0, Math.min(100, Math.round(percent)))
  await api(`/me/player/volume?volume_percent=${v}&device_id=${encodeURIComponent(deviceId)}`, { method: 'PUT' })
}

export async function currentPlayback() {
  return api<{
    is_playing: boolean
    progress_ms: number
    item: RawTrack | null
    device: DeviceRef
  } | undefined>('/me/player')
}

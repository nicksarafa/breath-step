/**
 * Spotify Authorization Code flow with PKCE, entirely in the browser.
 * No client secret is used or needed. Each person running this app creates
 * their own app at https://developer.spotify.com/dashboard.
 */

const SCOPES = [
  'streaming',
  'user-read-email',
  'user-read-private',
  'user-read-playback-state',
  'user-modify-playback-state',
  'playlist-read-private',
  'playlist-read-collaborative',
]

const K = {
  clientId: 'bj.spotify.clientId',
  tokens: 'bj.spotify.tokens',
  verifier: 'bj.spotify.verifier',
  state: 'bj.spotify.state',
  returnTo: 'bj.spotify.returnTo',
}

interface Tokens {
  access_token: string
  refresh_token: string
  expires_at: number
}

export function getClientId(): string {
  return localStorage.getItem(K.clientId) || (import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined) || ''
}

export function setClientId(id: string) {
  const v = id.trim()
  if (v) localStorage.setItem(K.clientId, v)
  else localStorage.removeItem(K.clientId)
}

export function clientIdSource(): 'local' | 'env' | 'none' {
  if (localStorage.getItem(K.clientId)) return 'local'
  if (import.meta.env.VITE_SPOTIFY_CLIENT_ID) return 'env'
  return 'none'
}

export function redirectUri(): string {
  return `${window.location.origin}/callback`
}

export function isLoggedIn(): boolean {
  return !!readTokens()
}

function readTokens(): Tokens | null {
  try {
    const raw = localStorage.getItem(K.tokens)
    return raw ? (JSON.parse(raw) as Tokens) : null
  } catch {
    return null
  }
}

function saveTokens(t: { access_token: string; refresh_token?: string; expires_in: number }) {
  const prev = readTokens()
  const next: Tokens = {
    access_token: t.access_token,
    // Spotify may or may not rotate the refresh token
    refresh_token: t.refresh_token || prev?.refresh_token || '',
    expires_at: Date.now() + t.expires_in * 1000,
  }
  localStorage.setItem(K.tokens, JSON.stringify(next))
}

export function logout() {
  localStorage.removeItem(K.tokens)
}

function randomString(len: number) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, (b) => chars[b % chars.length]).join('')
}

async function challengeFor(verifier: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

export async function login(returnTo = 'music') {
  const clientId = getClientId()
  if (!clientId) throw new Error('Add your Spotify Client ID first.')
  const verifier = randomString(64)
  const state = randomString(16)
  localStorage.setItem(K.verifier, verifier)
  localStorage.setItem(K.state, state)
  localStorage.setItem(K.returnTo, returnTo)
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SCOPES.join(' '),
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challengeFor(verifier),
    state,
  })
  window.location.assign(`https://accounts.spotify.com/authorize?${params}`)
}

/**
 * Call once on boot. If we are on /callback, exchange the code for tokens and
 * clean the URL. Returns the view to return to, or null when not a callback.
 */
export async function handleCallback(): Promise<{ returnTo: string; error?: string } | null> {
  if (window.location.pathname !== '/callback') return null
  const params = new URLSearchParams(window.location.search)
  const returnTo = localStorage.getItem(K.returnTo) || 'music'
  window.history.replaceState({}, '', '/')
  const err = params.get('error')
  if (err) return { returnTo, error: err === 'access_denied' ? 'Spotify access was declined.' : err }
  const code = params.get('code')
  const state = params.get('state')
  const verifier = localStorage.getItem(K.verifier)
  if (!code || !verifier || state !== localStorage.getItem(K.state)) {
    return { returnTo, error: 'Spotify sign in could not be verified. Please try again.' }
  }
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: getClientId(),
      code_verifier: verifier,
    }),
  })
  localStorage.removeItem(K.verifier)
  localStorage.removeItem(K.state)
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    return { returnTo, error: `Spotify sign in failed: ${body.error_description || res.status}` }
  }
  saveTokens(await res.json())
  return { returnTo }
}

let refreshing: Promise<string> | null = null

async function refresh(): Promise<string> {
  const t = readTokens()
  if (!t?.refresh_token) throw new Error('Not signed in to Spotify')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: t.refresh_token, client_id: getClientId() }),
  })
  if (!res.ok) {
    logout()
    throw new Error('Spotify session expired. Please connect again.')
  }
  const body = await res.json()
  saveTokens(body)
  return body.access_token as string
}

/** A valid access token, refreshing when it is within a minute of expiry. */
export async function getAccessToken(force = false): Promise<string> {
  const t = readTokens()
  if (!t) throw new Error('Not signed in to Spotify')
  if (!force && t.expires_at - Date.now() > 60_000) return t.access_token
  refreshing ??= refresh().finally(() => (refreshing = null))
  return refreshing
}

import { useEffect, useSyncExternalStore } from 'react'
import { getClientId, isLoggedIn, logout as clearTokens } from './auth'
import { me } from './api'
import { playback } from './player'

interface AuthSnapshot {
  loggedIn: boolean
  clientId: string
  user: { name: string; image?: string } | null
  error?: string
}

let snap: AuthSnapshot = { loggedIn: isLoggedIn(), clientId: getClientId(), user: null }
const listeners = new Set<() => void>()
const set = (patch: Partial<AuthSnapshot>) => {
  snap = { ...snap, ...patch }
  listeners.forEach((l) => l())
}

let bootstrapped = false
async function bootstrap() {
  if (bootstrapped || !snap.loggedIn) return
  bootstrapped = true
  try {
    const u = await me()
    set({ user: { name: u.display_name || u.id, image: u.images?.[0]?.url }, error: undefined })
    void playback.initSdk()
  } catch (e) {
    bootstrapped = false
    set({ error: (e as Error).message, loggedIn: isLoggedIn() })
  }
}

export const spotifyAuth = {
  refresh() {
    set({ loggedIn: isLoggedIn(), clientId: getClientId() })
    void bootstrap()
  },
  logout() {
    clearTokens()
    playback.disconnect()
    bootstrapped = false
    set({ loggedIn: false, user: null })
  },
  setError(error?: string) {
    set({ error })
  },
}

export function useSpotifyAuth(): AuthSnapshot {
  const s = useSyncExternalStore(
    (fn) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    () => snap,
  )
  useEffect(() => {
    void bootstrap()
  }, [s.loggedIn])
  return s
}

export function usePlayback() {
  return useSyncExternalStore(playback.subscribe, playback.getSnapshot)
}

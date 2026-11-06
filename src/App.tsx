import { useCallback, useEffect, useState } from 'react'
import { unlockAudio } from './audio/sound'
import { loadVoice, unlockVoice } from './audio/voice'
import { Brand } from './components/Brand'
import { Icon } from './components/Icon'
import { Starfield } from './components/Starfield'
import { handleCallback } from './spotify/auth'
import { playback } from './spotify/player'
import { spotifyAuth } from './spotify/useSpotify'
import { HomeView } from './views/Home'
import { IntegrateView, JournalView } from './views/Integrate'
import { MusicView } from './views/Music'
import { PrepareView } from './views/Prepare'
import { SessionView, type SessionResult } from './views/Session'

type View = 'home' | 'prepare' | 'quick' | 'music' | 'session' | 'integrate' | 'journal'
const ROUTABLE: View[] = ['home', 'prepare', 'quick', 'music', 'journal']

function viewFromHash(): View {
  const h = window.location.hash.replace('#', '') as View
  return ROUTABLE.includes(h) ? h : 'home'
}

export default function App() {
  const [view, setViewState] = useState<View>(viewFromHash)
  const [result, setResult] = useState<SessionResult | null>(null)
  const [booting, setBooting] = useState(window.location.pathname === '/callback')
  const [notice, setNotice] = useState<string | null>(null)
  const [musicFrom, setMusicFrom] = useState<View | null>(null)

  const go = useCallback((v: View) => {
    setViewState(v)
    if (ROUTABLE.includes(v)) window.history.pushState({}, '', v === 'home' ? '/' : `#${v}`)
    window.scrollTo({ top: 0 })
  }, [])

  useEffect(() => {
    void loadVoice()
  }, [])

  // Spotify sign-in redirect lands on /callback
  useEffect(() => {
    handleCallback()
      .then((r) => {
        if (!r) return
        if (r.error) setNotice(r.error)
        spotifyAuth.refresh()
        const back = r.returnTo === 'prepare' || r.returnTo === 'session' ? 'quick' : 'music'
        if (back === 'quick') setMusicFrom('quick')
        setViewState(back)
        window.history.replaceState({}, '', `#${back}`)
      })
      .catch((e) => setNotice((e as Error).message))
      .finally(() => setBooting(false))
  }, [])

  useEffect(() => {
    const onPop = () => setViewState((v) => (v === 'session' ? v : viewFromHash()))
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const begin = () => {
    // The click that starts the journey unlocks audio, speech and the Spotify player
    unlockAudio()
    unlockVoice()
    playback.activate()
    setViewState('session')
  }

  if (booting) {
    return (
      <>
        <Starfield />
        <div className="hero">
          <span className="eyebrow">Connecting to Spotify...</span>
        </div>
      </>
    )
  }

  if (view === 'session') {
    return (
      <>
        <Starfield density={0.7} />
        <SessionView
          onFinish={(r) => {
            setResult(r)
            setViewState('integrate')
          }}
        />
      </>
    )
  }

  return (
    <>
      <Starfield />
      <header className="topbar">
        <Brand onClick={() => go('home')} />
        <nav className="row gap-1">
          <button className="btn btn-sm btn-quiet" aria-current={view === 'music'} onClick={() => go('music')}>
            <Icon name="music" /> <span>Music</span>
          </button>
          <button className="btn btn-sm btn-quiet" aria-current={view === 'journal'} onClick={() => go('journal')}>
            <Icon name="book" /> <span>Journal</span>
          </button>
        </nav>
      </header>
      {notice ? (
        <div className="page page-narrow" style={{ paddingBottom: 0 }}>
          <div className="alert row between gap-3">
            <span>{notice}</span>
            <button className="icon-btn sm" aria-label="Dismiss" onClick={() => setNotice(null)}>
              <Icon name="close" />
            </button>
          </div>
        </div>
      ) : null}
      {view === 'home' ? <HomeView onBegin={(quick) => go(quick ? 'quick' : 'prepare')} onMusic={() => go('music')} /> : null}
      {view === 'prepare' || view === 'quick' ? (
        <PrepareView
          key={view}
          quick={view === 'quick'}
          startAtReady={musicFrom === view}
          onBegin={begin}
          onBack={() => {
            setMusicFrom(null)
            go('home')
          }}
          onMusic={() => {
            setMusicFrom(view)
            go('music')
          }}
        />
      ) : null}
      {view === 'music' ? <MusicView onBack={() => go(musicFrom === 'prepare' || musicFrom === 'quick' ? musicFrom : 'home')} /> : null}
      {view === 'journal' ? <JournalView onBack={() => go('home')} /> : null}
      {view === 'integrate' && result ? <IntegrateView result={result} onDone={(saved) => go(saved ? 'journal' : 'home')} /> : null}
    </>
  )
}

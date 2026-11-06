import { useMemo, useState, type ReactNode } from 'react'
import { BreathMapOverview } from '../components/BreathMap'
import { Icon } from '../components/Icon'
import { Practice, WarmUpOrb } from '../components/Practice'
import { SpotifyPanel } from '../components/SpotifyPanel'
import { CYCLES } from '../data/blueprint'
import { defaultConfig, totalPlannedMs } from '../engine/session'
import { useSpotifyAuth } from '../spotify/useSpotify'
import { THEME_MAX, THEME_SUGGESTIONS, themeLines } from '../data/themeGuidance'
import { voiceEngine } from '../audio/voice'
import { useMix, useSettings, useTheme, useTopic, type Settings } from '../store'
import { fmtMinutes } from '../util'

type StepId = 'welcome' | 'safety' | 'breath' | 'feel' | 'opens' | 'question' | 'ready'
const FULL: StepId[] = ['welcome', 'safety', 'breath', 'feel', 'opens', 'question', 'ready']

const QUESTIONS = [
  'What is my next true step?',
  'What wants to be created through me?',
  'What am I ready to let go of?',
  'What does my body need from me?',
  'What is the dream I never stopped dreaming?',
]

export function PrepareView({
  quick,
  startAtReady = false,
  onBegin,
  onBack,
  onMusic,
}: {
  quick: boolean
  startAtReady?: boolean
  onBegin: () => void
  onBack: () => void
  onMusic: () => void
}) {
  const [settings, setSettings] = useSettings()
  const steps: StepId[] = quick ? (settings.safetyAck ? ['question', 'ready'] : ['safety', 'question', 'ready']) : FULL
  const [i, setI] = useState(startAtReady && settings.safetyAck ? steps.length - 1 : 0)
  const [topic, setTopic] = useTopic()
  const [ack, setAck] = useState(settings.safetyAck)
  const step = steps[i]

  const next = () => {
    if (step === 'safety') setSettings((s) => ({ ...s, safetyAck: true }))
    if (i < steps.length - 1) {
      setI(i + 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }
  const back = () => (i === 0 ? onBack() : setI(i - 1))
  const canNext = step !== 'safety' || ack

  return (
    <div className="page page-narrow stack gap-8" style={{ minHeight: 'calc(100dvh - 72px)' }}>
      <div className="stack gap-4">
        <div className="steps" aria-hidden="true">
          {steps.map((s, j) => (
            <span key={s} className={j <= i ? 'on' : ''} />
          ))}
        </div>
        <div className="row between">
          <button className="btn btn-sm btn-quiet" onClick={back}>
            <Icon name="back" /> Back
          </button>
          <span className="eyebrow">
            Step {i + 1} of {steps.length}
          </span>
        </div>
      </div>

      <div className="grow stack gap-6" key={step} style={{ animation: 'cue-in 700ms var(--ls-ease-out) both' }}>
        {step === 'welcome' ? <Welcome /> : null}
        {step === 'safety' ? <Safety ack={ack} setAck={setAck} /> : null}
        {step === 'breath' ? <Breath voice={settings.voice !== 'off'} /> : null}
        {step === 'feel' ? <Feel /> : null}
        {step === 'opens' ? <Opens /> : null}
        {step === 'question' ? <Question topic={topic} setTopic={setTopic} /> : null}
        {step === 'ready' ? <Ready settings={settings} setSettings={setSettings} topic={topic} onMusic={onMusic} /> : null}
      </div>

      <div className="row between gap-3 wrap">
        {step === 'ready' ? (
          <button
            className="btn btn-primary btn-lg"
            onClick={() => {
              setSettings((s) => ({ ...s, introDone: true }))
              onBegin()
            }}
          >
            Begin the journey
          </button>
        ) : (
          <button className="btn btn-primary btn-lg" disabled={!canNext} onClick={next}>
            {step === 'question' && !topic.trim() ? 'Continue without a question' : 'Continue'} <Icon name="forward" />
          </button>
        )}
        {!quick && step === 'welcome' ? (
          <button className="btn btn-quiet" onClick={() => setI(steps.indexOf('safety'))}>
            Skip ahead
          </button>
        ) : null}
      </div>
    </div>
  )
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <>
      <div className="stack gap-3">
        <span className="eyebrow">{eyebrow}</span>
        <h1 className="h1">{title}</h1>
      </div>
      {children}
    </>
  )
}

function Welcome() {
  return (
    <Section eyebrow="Welcome" title={<>A journey in <span className="shine">nine cycles</span> of breath</>}>
      <div className="prose">
        <p>
          Over the next forty five minutes, each cycle brings its own focus: from arriving in the body, to meeting resistance, to opening the heart, to the question you came here with.
        </p>
        <p>Every cycle ends the same way: breathe all the way out and hold, then a big breath in, a hold at the top, and a long release. The music changes as you exhale into the next cycle.</p>
      </div>
      <div className="feel-grid">
        <div className="card">
          <div className="h3">Sit or lie down</div>
          <p className="small muted" style={{ margin: '0.3rem 0 0' }}>We breathe sitting. You can lie down if you need to.</p>
        </div>
        <div className="card">
          <div className="h3">Headphones on</div>
          <p className="small muted" style={{ margin: '0.3rem 0 0' }}>Music and voice carry you through. Keep water close.</p>
        </div>
        <div className="card">
          <div className="h3">You are in charge</div>
          <p className="small muted" style={{ margin: '0.3rem 0 0' }}>Slow down, pause, or stop at any moment.</p>
        </div>
      </div>
    </Section>
  )
}

function Safety({ ack, setAck }: { ack: boolean; setAck: (v: boolean) => void }) {
  return (
    <Section eyebrow="Before you begin" title="Is this practice right for you today?">
      <div className="prose">
        <p>This is a powerful breathwork practice. It is not recommended if any of the following apply to you:</p>
      </div>
      <ul className="list-plain">
        {[
          'Pregnancy',
          'Epilepsy',
          'High blood pressure',
          'Cardiovascular disease',
          'High inner eye pressure, such as glaucoma',
          'Clinical anxiety or panic attacks',
          'Psychosis',
          'A history of stroke',
          'Recent surgery',
        ].map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
      <div className="alert info">If you are unsure, check in with your doctor first. Never practise in water, while driving, or anywhere fainting could be unsafe.</div>
      <label className="check card gold">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
        <span>I am healthy, none of the above apply to me, and I take responsibility for my own practice.</span>
      </label>
    </Section>
  )
}

function Breath({ voice }: { voice: boolean }) {
  return (
    <Section eyebrow="The technique" title="Rhythmic breath, then the hold">
      <div className="feel-grid">
        <div className="card">
          <span className="eyebrow">1 · Rhythm</span>
          <p className="small" style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
            In through the nose, out through the mouth. Connected, with no pause. Let the music set the pace. Each cycle the breath gets a little deeper and faster.
          </p>
        </div>
        <div className="card">
          <span className="eyebrow">2 · Hold on empty</span>
          <p className="small" style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
            At the end of a cycle, breathe all the way out and hold. Stay a little longer, or come up sooner. You decide.
          </p>
        </div>
        <div className="card">
          <span className="eyebrow">3 · Hold at the top</span>
          <p className="small" style={{ margin: '0.5rem 0 0', color: 'var(--text-secondary)' }}>
            When you need air, take a big breath in and hold it at the top for ten seconds. Then sigh it all out.
          </p>
        </div>
      </div>
      <div className="card">
        <Practice voice={voice} />
      </div>
    </Section>
  )
}

function Feel() {
  const items = [
    ['Tingling', 'In the face, lips or hands.'],
    ['Less hearing', 'Sounds may seem further away.'],
    ['Cold or dry nose', 'From the strong flow of air.'],
    ['Dizziness', 'Light-headedness, a floating feeling.'],
    ['Cramped hands', 'Fingers may curl and tighten. It passes.'],
    ['Waves of emotion', 'Tears, laughter, heat. All welcome.'],
  ]
  return (
    <Section eyebrow="What you might feel" title="Sensations are a sign you are doing it right">
      <div className="feel-grid">
        {items.map(([t, d]) => (
          <div key={t} className="card">
            <div className="h3">{t}</div>
            <p className="small muted" style={{ margin: '0.3rem 0 0' }}>
              {d}
            </p>
          </div>
        ))}
      </div>
      <div className="prose">
        <p>
          As you breathe faster you exhale more carbon dioxide, and your blood becomes slightly more alkaline. This is called respiratory alkalosis. It is temporary. Sometimes it passes during the session, sometimes shortly after.
        </p>
        <p>Treat each sensation as an invitation to surrender.</p>
      </div>
      <div className="card gold row gap-4">
        <Icon name="wind" />
        <div className="small" style={{ color: 'var(--text-secondary)' }}>
          <b style={{ color: 'var(--ls-ink)' }}>You can have a break at any time.</b> Slow your breath right down and go at your own pace, or tap pause. Join the rhythm again whenever you are ready.
        </div>
      </div>
    </Section>
  )
}

function Opens() {
  const items = [
    ['Brain waves shift', 'From the busy beta of everyday thinking into alpha, the space of creativity, and towards theta, the realm of the subconscious.'],
    ['The inner critic quiets', 'Activity in the planning, judging part of the brain softens for a while. Old beliefs loosen, and you have a choice to change them.'],
    ['New connections', 'Regions of the brain that rarely talk begin to communicate. Insights arrive from unexpected places.'],
    ['Emotions release', 'Feelings stored in the body, because it was not safe to feel them then, can finally move through.'],
  ]
  return (
    <Section eyebrow="Why it works" title="What opens up">
      <div className="feel-grid">
        {items.map(([t, d]) => (
          <div key={t} className="card">
            <div className="h3">{t}</div>
            <p className="small muted" style={{ margin: '0.4rem 0 0', lineHeight: 1.7 }}>
              {d}
            </p>
          </div>
        ))}
      </div>
    </Section>
  )
}

function Question({ topic, setTopic }: { topic: string; setTopic: (t: string) => void }) {
  return (
    <Section eyebrow="Your topic" title="What are you searching for?">
      <div className="row gap-8 wrap" style={{ alignItems: 'center' }}>
        <div style={{ flex: '0 0 auto', margin: '0 auto' }}>
          <WarmUpOrb />
        </div>
        <div className="prose" style={{ flex: '1 1 260px' }}>
          <p>Take a few slow breaths with the orb. Then bring to mind one thing you want clarity on, and shape it as a question.</p>
          <p className="small">You will return to it in cycles five and six.</p>
        </div>
      </div>
      <ThemeField />
      <label className="field">
        <span className="label">Your question</span>
        <input className="input input-lg" placeholder="What is my next true step?" value={topic} maxLength={140} onChange={(e) => setTopic(e.target.value)} />
      </label>
      <div className="chips">
        {QUESTIONS.map((q) => (
          <button key={q} className="chip" aria-pressed={topic === q} onClick={() => setTopic(q)}>
            {q}
          </button>
        ))}
      </div>
    </Section>
  )
}

function ThemeGuidanceCard({ settings, setSettings }: { settings: Settings; setSettings: (fn: (s: Settings) => Settings) => void }) {
  const [theme] = useTheme()
  const on = settings.themeGuidance && !!theme.trim()
  const sample = theme.trim() ? themeLines(2, theme)[0] : null
  return (
    <div className={`card stack gap-3 ${on ? 'gold' : ''}`}>
      <div className="row between gap-3 wrap">
        <div>
          <div className="h3">Guidance around your theme</div>
          <div className="small muted">
            {theme.trim() ? (
              <>
                Questions about <b style={{ color: 'var(--ls-ink)' }}>{theme.trim()}</b> woven into every cycle, the way a facilitator would ask them.
              </>
            ) : (
              'Add a theme on the previous step to weave it into the guidance.'
            )}
          </div>
        </div>
        <div className="segmented" role="group" aria-label="Guidance around your theme">
          <button aria-pressed={on} disabled={!theme.trim()} onClick={() => setSettings((s) => ({ ...s, themeGuidance: true }))}>
            On
          </button>
          <button aria-pressed={!on} onClick={() => setSettings((s) => ({ ...s, themeGuidance: false }))}>
            Off
          </button>
        </div>
      </div>
      {on && sample ? <p className="small" style={{ margin: 0, color: 'var(--text-secondary)' }}>In cycle 3, for example: “{sample}”</p> : null}
      {on ? (
        <p className="micro faint" style={{ margin: 0 }}>
          {settings.voice !== 'full'
            ? 'Shown on screen. Choose Full guidance above to hear them spoken.'
            : voiceEngine() === 'elevenlabs'
              ? 'Spoken in the guide’s voice, generated for your theme when the journey begins.'
              : 'Spoken by your browser’s voice.'}
        </p>
      ) : null}
    </div>
  )
}

function ThemeField() {
  const [theme, setTheme] = useTheme()
  return (
    <div className="stack gap-3">
      <label className="field">
        <span className="label">
          Your theme <span className="faint">· what the journey circles around</span>
        </span>
        <input className="input input-lg" placeholder="my dream company" value={theme} maxLength={THEME_MAX} onChange={(e) => setTheme(e.target.value)} />
      </label>
      <div className="chips">
        {THEME_SUGGESTIONS.map((t) => (
          <button key={t} className="chip" aria-pressed={theme === t} onClick={() => setTheme(t)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

function Seg<T extends string | number>({ label, value, options, onChange }: { label: string; value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="stack gap-2">
      <span className="label">{label}</span>
      <div className="segmented" role="group" aria-label={label}>
        {options.map(([v, l]) => (
          <button key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)}>
            {l}
          </button>
        ))}
      </div>
    </div>
  )
}

function Ready({ settings, setSettings, topic, onMusic }: { settings: Settings; setSettings: (fn: (s: Settings) => Settings) => void; topic: string; onMusic: () => void }) {
  const [mix] = useMix()
  const auth = useSpotifyAuth()
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => setSettings((s) => ({ ...s, [k]: v }))
  const cfg = useMemo(
    () => defaultConfig({ cycleCount: settings.cycleCount, timeScale: settings.timeScale, paceScale: settings.paceScale }),
    [settings.cycleCount, settings.timeScale, settings.paceScale],
  )
  const chosen = CYCLES.slice(0, settings.cycleCount).filter((c) => (mix[c.id as keyof typeof mix] || []).length).length

  return (
    <Section eyebrow="Ready" title="Set up your journey">
      {topic.trim() ? (
        <div className="stack gap-2">
          <span className="label">Your question</span>
          <span className="topic-chip" style={{ alignSelf: 'flex-start' }}>
            {topic}
          </span>
        </div>
      ) : null}

      <div className="card stack gap-6">
        <div className="row gap-6 wrap">
          <Seg
            label={`Cycles · ${settings.cycleCount === 1 ? '1 cycle' : `${settings.cycleCount} cycles`}`}
            value={settings.cycleCount}
            options={CYCLES.map((c) => [c.number, String(c.number)] as [number, string])}
            onChange={set('cycleCount')}
          />
          <Seg
            label="Timing"
            value={settings.timeScale}
            options={[
              [0.8, 'Shorter'],
              [1, 'As designed'],
              [1.15, 'Longer'],
            ]}
            onChange={set('timeScale')}
          />
          <Seg
            label="Breath pace"
            value={settings.paceScale}
            options={[
              [1.15, 'Gentler'],
              [1, 'As designed'],
              [0.9, 'Stronger'],
            ]}
            onChange={set('paceScale')}
          />
        </div>
        <div className="row gap-6 wrap">
          <Seg
            label="Voice guidance"
            value={settings.voice}
            options={[
              ['full', 'Full guidance'],
              ['cues', 'Breath cues only'],
              ['off', 'Silent'],
            ]}
            onChange={set('voice')}
          />
          <Seg label="Chimes" value={settings.chimes ? 1 : 0} options={[[1, 'On'], [0, 'Off']]} onChange={(v) => set('chimes')(v === 1)} />
          <Seg label="Breath tones" value={settings.breathTones ? 1 : 0} options={[[1, 'On'], [0, 'Off']]} onChange={(v) => set('breathTones')(v === 1)} />
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          {settings.cycleCount === CYCLES.length ? 'The full journey' : 'Includes'}: {cfg.cycles.map((c) => c.title).join(' · ')}
          {topic.trim() && settings.cycleCount < 5 ? '. Your question returns in cycle 5; with fewer cycles it is held in the arrival and the closing rest.' : null}
        </p>
        <div className="bm-frame">
          <BreathMapOverview cfg={cfg} />
        </div>
        <div className="row gap-2 faint small">
          <Icon name="clock" /> About {fmtMinutes(totalPlannedMs(cfg))}, including arrival and rest
        </div>
      </div>

      <ThemeGuidanceCard settings={settings} setSettings={setSettings} />

      <SpotifyPanel compact returnTo="prepare" />
      {auth.loggedIn ? (
        <div className="row between gap-3 wrap">
          <span className="small muted">
            {chosen} of {settings.cycleCount} cycles have music chosen.
          </span>
          <button className="btn btn-sm" onClick={onMusic}>
            <Icon name="music" /> Choose music
          </button>
        </div>
      ) : (
        <p className="small faint" style={{ margin: 0 }}>
          No Spotify? You can still begin. Turn on breath tones for a guiding sound, or play your own music alongside.
        </p>
      )}
    </Section>
  )
}

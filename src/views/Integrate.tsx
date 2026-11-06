import { useState } from 'react'
import { Icon } from '../components/Icon'
import { useJournal, useTopic, type JournalEntry } from '../store'
import type { SessionResult } from './Session'

export function IntegrateView({ result, onDone }: { result: SessionResult; onDone: (saved: boolean) => void }) {
  const [topic] = useTopic()
  const [, setJournal] = useJournal()
  const [cameThrough, setCameThrough] = useState('')
  const [nextStep, setNextStep] = useState('')

  const save = () => {
    if (cameThrough.trim() || nextStep.trim()) {
      const entry: JournalEntry = {
        id: crypto.randomUUID(),
        date: new Date().toISOString(),
        topic,
        cyclesCompleted: result.cyclesCompleted,
        cameThrough: cameThrough.trim(),
        nextStep: nextStep.trim(),
      }
      setJournal((j) => [entry, ...j])
      onDone(true)
      return
    }
    onDone(false)
  }

  return (
    <div className="page page-narrow stack gap-8">
      <div className="stack gap-3">
        <span className="eyebrow">{result.completed ? 'Journey complete' : `${result.cyclesCompleted} cycles`}</span>
        <h1 className="h1">
          {result.completed ? (
            <>
              But you <span className="shine">did it.</span>
            </>
          ) : (
            'Welcome back'
          )}
        </h1>
        <p className="lede">Stay with your natural breath for a moment. When you are ready, capture what came through, while it is still close. End in creation mode.</p>
      </div>

      {topic.trim() ? (
        <div className="stack gap-2">
          <span className="label">You came with</span>
          <span className="topic-chip" style={{ alignSelf: 'flex-start' }}>
            {topic}
          </span>
        </div>
      ) : null}

      <label className="field">
        <span className="label">What came through for you?</span>
        <textarea className="textarea" placeholder="Images, feelings, words, answers..." value={cameThrough} onChange={(e) => setCameThrough(e.target.value)} autoFocus />
      </label>
      <label className="field">
        <span className="label">What is your next true step?</span>
        <textarea className="textarea" style={{ minHeight: 80 }} placeholder="One thing you will do, from that knowing." value={nextStep} onChange={(e) => setNextStep(e.target.value)} />
      </label>

      <div className="row gap-3 wrap">
        <button className="btn btn-primary btn-lg" onClick={save}>
          <Icon name="book" /> {cameThrough.trim() || nextStep.trim() ? 'Save to journal' : 'Finish'}
        </button>
        <p className="small faint" style={{ margin: 0 }}>
          Saved only in this browser.
        </p>
      </div>
    </div>
  )
}

export function JournalView({ onBack }: { onBack: () => void }) {
  const [journal, setJournal] = useJournal()
  return (
    <div className="page page-narrow stack gap-8">
      <div className="stack gap-3">
        <button className="btn btn-sm btn-quiet" style={{ alignSelf: 'flex-start' }} onClick={onBack}>
          <Icon name="back" /> Back
        </button>
        <span className="eyebrow">Journal</span>
        <h1 className="h1">What came through</h1>
      </div>
      {journal.length === 0 ? <div className="empty">Your reflections will appear here after each journey.</div> : null}
      {journal.map((e) => (
        <article key={e.id} className="card entry">
          <div className="row between gap-3 wrap">
            <span className="eyebrow">
              {new Date(e.date).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </span>
            <button className="icon-btn sm" aria-label="Delete entry" onClick={() => setJournal((j) => j.filter((x) => x.id !== e.id))}>
              <Icon name="trash" />
            </button>
          </div>
          {e.topic ? <div className="h3">{e.topic}</div> : null}
          {e.cameThrough ? <blockquote>{e.cameThrough}</blockquote> : null}
          {e.nextStep ? (
            <div className="small">
              <span className="faint">Next true step · </span>
              {e.nextStep}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}

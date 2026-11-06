/**
 * The nine-cycle journey, encoded from the teacher blueprint in /research.
 * Timings are the midpoints of the ranges given ("estimations, not absolute numbers").
 * Copy rules: no em dashes, no emoji. `{topic}` is replaced with the user's question.
 */

export interface TrackSuggestion {
  /** As written in the handout */
  label: string
  /** Cleaned search query for Spotify */
  query: string
}

export interface CycleDef {
  id: string
  number: number
  title: string
  subtitle: string
  /** Seconds of dynamic breathing */
  breatheSec: number
  /** Seconds holding out on empty lungs (target, user can extend or end early) */
  holdOutSec: number
  /** Seconds holding at the top after the recovery breath */
  holdInSec: number
  /** Seconds per full breath (inhale + exhale) as the cycle begins: slow and deep */
  startPeriodSec: number
  /** Seconds per full breath once the cycle has built up to pace */
  breathPeriodSec: number
  /** Human readable ranges from the handout */
  timingNote: string
  music: { tempo: string; mood: string }
  suggestions: TrackSuggestion[]
  /** Spoken and shown while breathing, spread across the cycle */
  breatheCues: string[]
  /** Spoken and shown during the hold out */
  holdCues: string[]
  /** "Not many words needed" cycles keep the screen quiet */
  fewWords?: boolean
  /** Orb colours for this cycle's theme: highlight, body, edge */
  palette: [string, string, string]
}

export const CYCLES: CycleDef[] = [
  {
    id: 'c1',
    palette: ['#f3d48a', '#e0895a', '#8a5cc2'],
    number: 1,
    title: 'Arrive in the body',
    subtitle: 'Physical guidance',
    breatheSec: 150,
    holdOutSec: 30,
    holdInSec: 10,
    startPeriodSec: 6.0,
    breathPeriodSec: 3.4,
    timingNote: 'Breathing 2:30 · hold around 30 s',
    music: { tempo: 'around 80 bpm', mood: 'Slow, clear rhythm' },
    suggestions: [
      { label: 'David Darling · Stones Start Spinning (Moontide Edit)', query: 'Stones Start Spinning' },
      { label: 'LTC | ubiq · Claire', query: 'ubiq Claire' },
      { label: 'Uwawey · Aayar', query: 'Uwawey Aayar' },
      { label: 'Archive · Day That You Go (Kreidler & Florett Edit)', query: 'Archive Day That You Go Kreidler Florett' },
      { label: 'Rite · Toulouse Musique', query: 'Rite Toulouse Musique' },
      { label: 'LifeisLove, Pseudosimian · Masterpeace (Steffen Ki revision)', query: 'Masterpeace Pseudosimian Steffen Ki' },
    ],
    breatheCues: [
      'Find a slow, steady rhythm. In through the nose, out through the mouth.',
      'Breathe with the music. Let it hold the rhythm for you.',
      'You might feel your body shifting, changing already.',
      'Maybe some dizziness, or a tingling in the face or hands.',
      'See if you can welcome these shifts.',
    ],
    holdCues: ['Let everything soften.', 'Nothing to do. Just notice.'],
  },
  {
    id: 'c2',
    palette: ['#9be8ee', '#00bcd4', '#a78bfa'],
    number: 2,
    title: 'Honour the body',
    subtitle: 'Understand what the body holds',
    breatheSec: 170,
    holdOutSec: 45,
    holdInSec: 10,
    startPeriodSec: 4.6,
    breathPeriodSec: 3.0,
    timingNote: 'Breathing 2:45 to 3:00 · hold around 45 s',
    music: { tempo: 'around 90 bpm', mood: 'Slightly faster, more dynamic rhythm' },
    suggestions: [
      { label: 'Niko Schwind & Felix Raphael · Circles (Original Mix)', query: 'Niko Schwind Felix Raphael Circles' },
      { label: 'Mose · Unfolding', query: 'artist:Mose Unfolding' },
      { label: 'PACHIRA · Gates Unveiled', query: 'Pachira Gates Unveiled' },
      { label: 'Sarkis Mikael & Patrik Khach feat. Heibert · Sarian', query: 'Sarkis Mikael Patrik Khach Sarian' },
    ],
    breatheCues: [
      'I invite you to dedicate this cycle to your body. Your physical home.',
      'Your body heals every minute. Your body can change its state.',
      'Can you observe, instead of react?',
      'My dear body, please show me how I have been feeling these past days, weeks, years.',
      'Are there places that feel more tense, tight or frozen?',
      'And places that feel more open, more free?',
    ],
    holdCues: ['Listen to what your body is telling you.', 'What is it holding for you?'],
  },
  {
    id: 'c3',
    palette: ['#ffc15e', '#ff6a3d', '#c2185b'],
    number: 3,
    title: 'Inner fire',
    subtitle: 'Meet the resistance. I can, I want.',
    breatheSec: 195,
    holdOutSec: 50,
    holdInSec: 10,
    startPeriodSec: 4.0,
    breathPeriodSec: 2.7,
    timingNote: 'Breathing 3:00 to 3:30 · hold 45 to 60 s',
    music: { tempo: 'faster', mood: 'Strong rhythm to get you going. Can sound darker: effort, resistance, going deeper.' },
    suggestions: [
      { label: 'LC · You Want It Darker (Mendrix Edit)', query: 'You Want It Darker Mendrix' },
      { label: 'Nalin · It Seemed The Better Way (Nalin Edit)', query: 'Nalin It Seemed The Better Way' },
      { label: 'Latch Key Kid feat. Sami Freeman · Before I Fall (Ahmet Atakan Remix)', query: 'Latch Key Kid Before I Fall' },
      { label: 'Chris IDH · Om (Harri Agnel Remix)', query: 'Chris IDH Om Harri Agnel' },
      { label: 'Blood of my Blood', query: 'Blood of my Blood' },
    ],
    breatheCues: [
      'Deepen the breath. Speed it up a little.',
      'Resistance might rise. Am I doing this right? Why is this so hard? Is this safe?',
      'What resistance is showing up for you?',
      'Three holds the energy of I can, and I want.',
      'Tap into your inner fire. Connect to your inner warrior.',
      'Can you breathe with the resistance, through it, instead of against it?',
      'What if you did not fight it, but felt it?',
      'As you tap into your willpower: what is it that you want?',
    ],
    holdCues: ['Hold in stillness.', 'Let go of what you think about the resistance.', 'Stay here for another five...'],
  },
  {
    id: 'c4',
    palette: ['#ffd1dc', '#e06b8a', '#b04a8f'],
    number: 4,
    title: 'Open the heart',
    subtitle: 'Enter the emotional body',
    breatheSec: 215,
    holdOutSec: 55,
    holdInSec: 10,
    startPeriodSec: 3.6,
    breathPeriodSec: 2.5,
    timingNote: 'Breathing 3:30 to 3:45 · hold 45 to 60 s',
    music: { tempo: 'as fast as cycle 3, or a bit faster', mood: 'Emotional' },
    suggestions: [
      { label: 'All Your Love feat. Dustin Tebbutt', query: 'All Your Love Dustin Tebbutt' },
      { label: 'What Is Real (Deep in the Playa Mix)', query: 'What Is Real Deep in the Playa Mix' },
      { label: 'Niconé, Enda Gallery · Listen To My Soul (Dark Soul Version)', query: 'Listen To My Soul Dark Soul' },
      { label: 'Bound', query: 'Bound' },
    ],
    breatheCues: [
      'Four is the number of the heart. Breathe from the middle of your chest.',
      'Create more space in the chest. More space around the heart.',
      'You are moving deeper. You are entering your emotional body.',
      'What are you feeling? What are you actually feeling right now?',
      'Maybe you want to start a conversation with it.',
      'What if you could feel the emotions that were forgotten? Stored in the body, because it was not safe to feel them then.',
      'What if you could feel it fully, now?',
      'Can you allow yourself to feel fully? All the feelings?',
    ],
    holdCues: ['My dear heart, what can I do for you?', 'Let it be felt.'],
  },
  {
    id: 'c5',
    palette: ['#e4dbff', '#a78bfa', '#818cf8'],
    number: 5,
    title: 'Return to your question',
    subtitle: 'Drop the expectation',
    breatheSec: 240,
    holdOutSec: 60,
    holdInSec: 10,
    startPeriodSec: 3.4,
    breathPeriodSec: 2.3,
    timingNote: 'Breathing around 4:00 · hold around 60 s',
    music: { tempo: 'quite fast', mood: 'Wilder, but with a rhythm to breathe on' },
    suggestions: [
      { label: 'Silence feat. Kollmorgen (Mollono.Bass Remix)', query: 'Silence Kollmorgen Mollono.Bass' },
      { label: 'Rasi Z · Zamin (LADS Remix)', query: 'Rasi Z Zamin LADS' },
      { label: "RY X · Lean (Fake Mood 'Sleepless' Mix)", query: 'RY X Lean' },
      { label: 'Nico Stojan, Jaw · Blue Hour', query: 'Nico Stojan Jaw Blue Hour' },
    ],
    breatheCues: [
      'Bring in your question. {topic}',
      'What was your question? Let it breathe with you.',
      'What if you could breathe this cycle while loosening your grip on control?',
      'How would it feel to let go of the stories you hold about it?',
      'Nothing here to hold onto.',
      'Surrender into wherever the breath takes you. Breathe me. Take me.',
      'What are you making space for?',
    ],
    holdCues: ['Drop the expectation.', 'What are you making space for?'],
  },
  {
    id: 'c6',
    palette: ['#a9b8ff', '#5b63e8', '#2e2a8f'],
    number: 6,
    title: 'Deepen the connection',
    subtitle: 'Without the need to know',
    breatheSec: 240,
    holdOutSec: 70,
    holdInSec: 10,
    startPeriodSec: 3.2,
    breathPeriodSec: 2.2,
    timingNote: 'Breathing around 4:00 · hold 60 to 75 s out, 10 s in',
    music: { tempo: 'pretty fast', mood: 'Wilder in its tonality' },
    suggestions: [
      { label: 'Think City & Akuba · Luciano (Original Mix)', query: 'Think City Akuba Luciano' },
      { label: 'El_Txef_A · The Love We Lost feat. Woolfy (Bedouin)', query: 'The Love We Lost Woolfy Bedouin' },
      { label: 'Frueher · Florian Rietze · Dle Yaman', query: 'Dle Yaman' },
    ],
    breatheCues: [
      'Stay with your question. {topic}',
      'What if you could breathe this cycle without any expectation?',
      'Without the need to know where this is going.',
      'Let it take you deeper.',
      'Keep breathing. Let the answer come to you.',
    ],
    holdCues: ['Let it come to you.', 'No need to know.'],
  },
  {
    id: 'c7',
    palette: ['#fff1c1', '#e8c476', '#00bcd4'],
    number: 7,
    title: 'Inspired action',
    subtitle: 'Drop the effort. Allow yourself to be guided.',
    breatheSec: 240,
    holdOutSec: 80,
    holdInSec: 10,
    startPeriodSec: 3.2,
    breathPeriodSec: 2.3,
    timingNote: 'Breathing around 4:00 · hold 75 to 90 s out, 10 s in',
    music: { tempo: 'can break from the faster tracks, a bit slower if needed', mood: 'Emotional, uplifting' },
    suggestions: [
      { label: 'Running In A Dream (with Kasbo feat. Vancouver Sleep Clinic)', query: 'Running In A Dream Kasbo Vancouver Sleep Clinic' },
      { label: 'Sarkis Mikael · Ether (Original Mix)', query: 'Sarkis Mikael Ether' },
      { label: 'Klangkarussell, GIVVEN · Ghostkeeper', query: 'Ghostkeeper Klangkarussell GIVVEN' },
      { label: 'Tebra feat. Elly Ball · The Call (DSF Remix)', query: 'Tebra Elly Ball The Call' },
      { label: 'This Version Of You feat. Julianna Barwick (Joseph Ray Remix)', query: 'This Version Of You Julianna Barwick Joseph Ray' },
    ],
    breatheCues: [
      'Seven is the number of magic and synchronicity.',
      'How would it feel to allow life to move through you?',
      'Tap into that knowing. Allow yourself to be guided. And do not take life too seriously.',
      'What brings you the feeling of connection, the joy of being alive?',
      'What wants to be created through you? Why are you here?',
      'From that knowing: what is it time for you to create?',
      'What are you here to share? What if you could do that more often?',
      'What wants to move through you?',
      'What is your next true step?',
      'How would it feel to be guided into that? As if you were not alone.',
    ],
    holdCues: ['Please take me. Please use me.', 'What are you opening to be a vessel for?'],
  },
  {
    id: 'c8',
    palette: ['#ffb8f2', '#e04fd0', '#7c3aed'],
    number: 8,
    title: 'This is happening',
    subtitle: 'Drop into the energy. End in creation mode.',
    breatheSec: 240,
    holdOutSec: 80,
    holdInSec: 10,
    startPeriodSec: 3.0,
    breathPeriodSec: 2.1,
    timingNote: 'Breathing around 4:00 · hold 70 to 90 s out, 10 s in',
    music: { tempo: 'fast and dynamic', mood: 'Maybe lyrics that fit the topic' },
    suggestions: [
      { label: 'A Promise', query: 'A Promise' },
      { label: 'B.I.G. (official)', query: 'B.I.G.' },
      { label: 'Beyhude · Alabora (Foxall Pale Blue Remix)', query: 'Beyhude Alabora Foxall' },
    ],
    fewWords: true,
    breatheCues: [
      'This is happening. Drop into the energy.',
      'Keep breathing. Feel what is coming up, and through you.',
      'Where are you going?',
      'What is the dream you never stopped dreaming?',
      'What do you really want to do in this life?',
      'What is your legacy? How did you show up, and express yourself?',
      'Keep breathing. End in creation mode.',
    ],
    holdCues: ['Let it move through you.'],
  },
  {
    id: 'c9',
    palette: ['#ffffff', '#f3d48a', '#e06b8a'],
    number: 9,
    title: 'The peak',
    subtitle: 'Give it everything',
    breatheSec: 240,
    holdOutSec: 80,
    holdInSec: 10,
    startPeriodSec: 2.8,
    breathPeriodSec: 2.0,
    timingNote: 'Breathing around 4:00 · hold 70 to 90 s out, 10 s in',
    music: { tempo: 'quite fast', mood: 'Peak experience. Maybe a song that tells a story.' },
    suggestions: [],
    fewWords: true,
    breatheCues: ['Last cycle. Give it everything.', 'Keep breathing.', 'Let the breath breathe you.', 'Stay with it.'],
    holdCues: ['You did it.', 'Rest in the stillness.'],
  },
]

/** Brand prismatic palette for arrival, rest and practice */
export const BRAND_PALETTE: [string, string, string] = ['#e8c476', '#e06b8a', '#a78bfa']

export const ARRIVE = {
  durationSec: 45,
  breathPeriodSec: 7,
  cues: [
    'Find a comfortable seat, or lie down if you need to.',
    'Close your eyes when you are ready.',
    'Bring your question to mind. {topic}',
  ],
}

export const REST = {
  durationSec: 180,
  breathPeriodSec: 9,
  cues: [
    'Let your breath return to its natural rhythm.',
    'Rest here. Let everything settle and integrate.',
    'What came through for you?',
  ],
}

/** Fixed durations of the transition phases, in seconds */
export const TRANSITIONS = {
  letGoSec: 4,
  inhaleSec: 4,
  releaseSec: 4,
  /** Seconds added by "Stay longer" */
  extendSec: 15,
  /** Slow breath period used when someone takes a break */
  breakPeriodSec: 8,
  /** Share of each breathing phase spent building from the start pace to full pace */
  rampShare: 0.75,
}

export type MusicSlotId = 'arrive' | `c${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}` | 'rest'

export const MUSIC_SLOTS: { id: MusicSlotId; label: string; hint: string }[] = [
  { id: 'arrive', label: 'Arrival', hint: 'Plays while you settle in. Optional.' },
  ...CYCLES.map((c) => ({ id: c.id as MusicSlotId, label: `Cycle ${c.number} · ${c.title}`, hint: `${c.music.mood} (${c.music.tempo})` })),
  { id: 'rest', label: 'Rest and integration', hint: 'Soft and spacious, for the closing rest.' },
]

export function fillTopic(text: string, topic: string): string {
  const t = topic.trim()
  return text.replace('{topic}', t ? `“${t}”` : '').trim()
}

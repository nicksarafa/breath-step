/**
 * Guidance woven around the user's theme (for example "my dream company").
 * Each cycle's questions follow the handwritten notes in the teacher
 * blueprint (see research/), so the kind of question matches the cycle:
 * the body in 1 and 2, resistance and will in 3, feeling in 4, the question
 * and letting go of stories in 5 and 6, inspired action in 7, the dream and
 * legacy in 8, and very few words at the peak.
 *
 * {mine} = the theme as written ("my dream company"), for first-person lines.
 * {yours} = the theme in second person ("your dream company").
 *
 * Shared by the browser and the voice function, which only ever voices these
 * templates, never arbitrary text.
 */

export const THEME_TEMPLATES: string[][] = [
  // 1 · Arrive in the body
  ['Let {yours} rest at the back of your mind. For now, simply arrive in the body.'],
  // 2 · Honour the body: "My dear body, please show me how I have been feeling..."
  [
    'My dear body, please show me how I have been feeling about {mine}.',
    'When you think of {yours}, where does the body feel tense, tight or frozen? And where does it feel open and free?',
  ],
  // 3 · Inner fire: resistance, "Where is this going? Why is this so hard?", I can, I want
  [
    'What resistance shows up when you think about {yours}?',
    'Where is this going? Why does it feel so hard? Breathe through it, not against it.',
    'When it comes to {yours}, say it inside: I can. I want. What is it that you want?',
  ],
  // 4 · Open the heart: "What is the emotion I have been forgetting to feel..."
  [
    'What are you actually feeling about {yours}, right now?',
    'What emotion around {yours} have you been forgetting to feel, because it was not safe to feel it then?',
  ],
  // 5 · Return to your question: let go of the stories, make space
  [
    'Bring {yours} into the breath.',
    'How would it feel to let go of the stories you tell about {yours}?',
    'What are you making space for, in {yours}?',
  ],
  // 6 · Deepen the connection: without expectation
  ['Go deeper into {yours}, without needing to know where it is going.', 'What does {yours} want you to know?'],
  // 7 · Inspired action: vessel, next true step, not alone
  [
    'What wants to be created through you, in {yours}?',
    'From that knowing, what is your next true step in {yours}?',
    'How would it feel to be guided into it, as if you were not alone?',
  ],
  // 8 · This is happening: the dream, the legacy, creation mode
  [
    'Where are you going with {yours}?',
    'What is the dream about {yours} you never stopped dreaming?',
    'How do you show up, and express yourself, in {yours}? End in creation mode.',
  ],
  // 9 · The peak: very few words
  ['Let {yours} move through you. Keep breathing.'],
]

export const THEME_MAX = 60

export function cleanTheme(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f<>{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.?!]+$/, '')
    .slice(0, THEME_MAX)
}

/** "my dream company" → "your dream company", "I" → "you" */
export function toSecondPerson(theme: string): string {
  const map: Record<string, string> = { my: 'your', me: 'you', mine: 'yours', i: 'you', myself: 'yourself', am: 'are', "i'm": "you're" }
  return theme.replace(/\b(my|me|mine|myself|i'm|i|am)\b/gi, (w) => {
    const r = map[w.toLowerCase()]
    return w[0] === w[0].toUpperCase() && w.toLowerCase() !== 'i' ? r[0].toUpperCase() + r.slice(1) : r
  })
}

export function themeLine(cycleIndex: number, lineIndex: number, rawTheme: string): string | null {
  const theme = cleanTheme(rawTheme)
  const tpl = THEME_TEMPLATES[cycleIndex]?.[lineIndex]
  if (!theme || !tpl) return null
  return tpl.replace(/\{mine\}/g, theme).replace(/\{yours\}/g, toSecondPerson(theme))
}

export function themeLines(cycleIndex: number, rawTheme: string): string[] {
  return (THEME_TEMPLATES[cycleIndex] || []).map((_, i) => themeLine(cycleIndex, i, rawTheme)!).filter(Boolean)
}

/** Interleave base guidance with theme guidance: b0, t0, b1, t1, ... */
export function weave(base: string[], theme: string[]): string[] {
  const out: string[] = []
  for (let i = 0; i < Math.max(base.length, theme.length); i++) {
    if (base[i]) out.push(base[i])
    if (theme[i]) out.push(theme[i])
  }
  return out
}

export const THEME_SUGGESTIONS = ['my dream company', 'my relationships', 'my body and health', 'my creative work', 'my purpose', 'my family']

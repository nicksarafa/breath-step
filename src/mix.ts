import { CYCLES, TRANSITIONS, type CycleDef, type MusicSlotId } from './data/blueprint'
import type { TrackRef } from './spotify/api'
import type { Mix } from './store'

/** One song per slot: choosing a track replaces whatever was there */
export function setSlotTrack(mix: Mix, slot: MusicSlotId, t: TrackRef): Mix {
  return { ...mix, [slot]: [t] }
}

export function slotSeconds(slot: MusicSlotId, timeScale: number): number | null {
  const c = CYCLES.find((x) => x.id === slot)
  if (!c) return null
  return (c.breatheSec + c.holdOutSec) * timeScale + TRANSITIONS.letGoSec + TRANSITIONS.inhaleSec + c.holdInSec + TRANSITIONS.releaseSec
}

const norm = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Does a Spotify result really match the handout's label? Both an artist and
 * the first word of the title must appear in the label, so loose searches
 * ("Uwawey" returning an unrelated track) are rejected.
 */
export function matchesSuggestion(label: string, t: Pick<TrackRef, 'name' | 'artists'>): boolean {
  const l = ` ${norm(label)} `
  const artistOk = t.artists.split(',').some((a) => {
    const n = norm(a)
    return n.length >= 2 && l.includes(` ${n} `)
  })
  const firstWord = norm(t.name).split(' ').find((w) => w.length >= 3) || norm(t.name)
  return artistOk && l.includes(` ${firstWord}`)
}

/** Fill empty cycle slots with the first handout suggestion that is really on Spotify */
export async function autofillFromBlueprint(
  mix: Mix,
  search: (q: string) => Promise<TrackRef[]>,
  cycles: CycleDef[] = CYCLES,
): Promise<{ mix: Mix; filled: { slot: MusicSlotId; track: TrackRef; borrowed: boolean }[]; missing: MusicSlotId[] }> {
  let next = { ...mix }
  const filled: { slot: MusicSlotId; track: TrackRef; borrowed: boolean }[] = []
  const missing: MusicSlotId[] = []
  const used = new Set(Object.values(next).flat().map((t) => t!.id))

  const find = async (c: CycleDef) => {
    for (const s of c.suggestions) {
      const hit = (await search(s.query)).find((t) => matchesSuggestion(s.label, t) && !used.has(t.id))
      if (hit) return hit
    }
    return null
  }

  for (let i = 0; i < cycles.length; i++) {
    const c = cycles[i]
    const slot = c.id as MusicSlotId
    if ((next[slot] || []).length) continue
    let track = await find(c)
    let borrowed = false
    // No usable suggestion for this cycle: borrow an unused one from the cycles before it
    for (let j = i - 1; !track && j >= 0; j--) {
      track = await find(cycles[j])
      borrowed = !!track
    }
    if (track) {
      used.add(track.id)
      next = setSlotTrack(next, slot, track)
      filled.push({ slot, track, borrowed })
    } else missing.push(slot)
  }
  return { mix: next, filled, missing }
}

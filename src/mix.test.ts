import { describe, expect, it } from 'vitest'
import { CYCLES } from './data/blueprint'
import { autofillFromBlueprint, matchesSuggestion, setSlotTrack } from './mix'
import type { TrackRef } from './spotify/api'

const t = (id: string, artists: string, name: string): TrackRef => ({ id, uri: `spotify:track:${id}`, name, artists, durationMs: 300_000 })

describe('one song per cycle', () => {
  it('choosing a track replaces the previous one', () => {
    const m = setSlotTrack(setSlotTrack({}, 'c1', t('a', 'x', 'A')), 'c1', t('b', 'y', 'B'))
    expect(m.c1!.map((x) => x.id)).toEqual(['b'])
  })
})

describe('matching handout suggestions', () => {
  it('accepts real matches', () => {
    expect(matchesSuggestion('David Darling · Stones Start Spinning (Moontide Edit)', { artists: 'David Darling', name: 'Stones Start Spinning' })).toBe(true)
    expect(matchesSuggestion('Niconé, Enda Gallery · Listen To My Soul (Dark Soul Version)', { artists: 'Enda Gallery, Niconé', name: 'Listen To My Soul - Dark Soul Version' })).toBe(true)
  })
  it('rejects loose search noise', () => {
    expect(matchesSuggestion('Uwawey · Aayar', { artists: 'Toby Fox', name: 'Uwa!! So Temperate' })).toBe(false)
    expect(matchesSuggestion('LifeisLove, Pseudosimian · Masterpeace (Steffen Ki revision)', { artists: 'Steffen', name: 'Masterpiece' })).toBe(false)
    expect(matchesSuggestion('B.I.G. (official)', { artists: 'The Notorious B.I.G.', name: 'Hypnotize' })).toBe(false)
  })
})

describe('autofill', () => {
  it('fills every cycle, borrowing for cycles without suggestions, and keeps existing picks', async () => {
    const search = async (q: string): Promise<TrackRef[]> => {
      for (const c of CYCLES) {
        const s = c.suggestions.find((x) => x.query === q)
        if (s) {
          const [artists, name] = s.label.includes(' · ') ? s.label.split(' · ') : ['Someone', s.label]
          return [t(`${c.id}-${q}`, artists, name.replace(/\s*\(.*$/, ''))]
        }
      }
      return []
    }
    const keep = t('mine', 'Me', 'My Song')
    const r = await autofillFromBlueprint({ c2: [keep] }, search)
    expect(r.mix.c2).toEqual([keep])
    for (const c of CYCLES) expect(r.mix[c.id as 'c1']).toHaveLength(1)
    expect(r.filled.find((f) => f.slot === 'c9')!.borrowed).toBe(true)
    const ids = CYCLES.map((c) => r.mix[c.id as 'c1']![0].id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

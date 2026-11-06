import { describe, expect, it } from 'vitest'
import type { MusicSlotId } from '../data/blueprint'
import { defaultConfig } from '../engine/session'
import { plannedStart } from '../engine/simulate'
import type { TrackRef } from './api'
import { musicAt, slotTimeline } from './director'

const t = (id: string, sec: number, startSec = 0): TrackRef => ({ id, uri: `spotify:track:${id}`, name: id, artists: 'x', durationMs: sec * 1000, startMs: startSec * 1000 })
const mix: Partial<Record<MusicSlotId, TrackRef[]>> = { c1: [t('A', 300)], c2: [t('B', 200), t('C', 100, 20)] }
const tracksFor = (s: MusicSlotId) => mix[s] || []

describe('music after a scrub', () => {
  const cfg = defaultConfig()

  it('slots change on the release breath by default', () => {
    const line = slotTimeline(cfg, 'release')
    expect(line[2]).toEqual({ slot: 'c2', start: plannedStart('release', 0, cfg) })
    expect(slotTimeline(cfg, 'holdStart')[2].start).toBe(plannedStart('holdOut', 0, cfg))
  })

  it('without an arrival track, cycle 1 music starts from the first second', () => {
    const at = musicAt(5000, cfg, 'release', tracksFor)
    expect(at.slot).toBe('c1')
    expect(at.playing!.tracks[0].id).toBe('A')
    expect(at.playing!.positionMs).toBe(5000)
  })

  it('an arrival track plays first, then cycle 1 starts with breathing', () => {
    const withArrive = (s: MusicSlotId) => (s === 'arrive' ? [t('Z', 400)] : tracksFor(s))
    expect(musicAt(5000, cfg, 'release', withArrive).playing!.tracks[0].id).toBe('Z')
    const at = musicAt(plannedStart('breathe', 0, cfg) + 10_000, cfg, 'release', withArrive)
    expect(at.playing!.tracks[0].id).toBe('A')
    expect(at.playing!.positionMs).toBe(10_000)
  })

  it('lands inside the right track at the right position', () => {
    const at = musicAt(plannedStart('breathe', 0, cfg) + 10_000, cfg, 'release', tracksFor)
    expect(at.slot).toBe('c1')
    expect(at.playing!.tracks[0].id).toBe('A')
    expect(at.playing!.positionMs).toBe(plannedStart('breathe', 0, cfg) + 10_000)
  })

  it('moves to the next track in a slot, honouring its start offset', () => {
    const at = musicAt(plannedStart('release', 0, cfg) + 230_000, cfg, 'release', tracksFor)
    expect(at.playing!.tracks.map((x) => x.id)).toEqual(['C', 'B'])
    expect(at.playing!.positionMs).toBe(20_000 + 30_000)
  })

  it('an empty slot carries on the previous music', () => {
    const at = musicAt(plannedStart('breathe', 2, cfg) + 5000, cfg, 'release', tracksFor)
    expect(at.slot).toBe('c3')
    expect(at.playing!.fromSlot).toBe('c2')
  })
})

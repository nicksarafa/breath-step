/**
 * The music director listens to session events and runs the soundtrack the
 * way the blueprint describes:
 *   - each cycle has its own track(s)
 *   - "change song on exhale": the next cycle's track starts on the release
 *   - on the 4, 3, 2, 1 count at the top, the volume steps down, then the new
 *     track rises in
 * If a slot is empty the current music simply carries on.
 */
import type { MusicSlotId } from '../data/blueprint'
import type { SessionConfig, SessionEvent, SessionState } from '../engine/session'
import { plannedPosition, plannedStart } from '../engine/simulate'
import { getMix, type ChangeMode } from '../store'
import type { TrackRef } from './api'
import { playback } from './player'

/** Fraction of the base volume on each count */
const DUCK: Record<number, number> = { 4: 0.8, 3: 0.6, 2: 0.42, 1: 0.28 }

export function slotForCycle(index: number, cfg: SessionConfig): MusicSlotId {
  return index < cfg.cycles.length ? (cfg.cycles[index].id as MusicSlotId) : 'rest'
}

/** Every slot in play order with the planned moment its music begins */
export function slotTimeline(cfg: SessionConfig, mode: ChangeMode): { slot: MusicSlotId; start: number }[] {
  const change = mode === 'release' ? 'release' : 'holdOut'
  const out: { slot: MusicSlotId; start: number }[] = [{ slot: 'arrive', start: 0 }]
  cfg.cycles.forEach((c, i) => {
    out.push({ slot: c.id as MusicSlotId, start: i === 0 ? plannedStart('breathe', 0, cfg) : plannedStart(change, i - 1, cfg) })
  })
  out.push({ slot: 'rest', start: plannedStart(change, cfg.cycles.length - 1, cfg) })
  return out
}

/**
 * What an uninterrupted run would be playing at planned time `ms`: the latest
 * slot that has tracks, which track in it, and how far into that track.
 */
export function musicAt(ms: number, cfg: SessionConfig, mode: ChangeMode, tracksFor: (s: MusicSlotId) => TrackRef[]) {
  const line = slotTimeline(cfg, mode)
  let k = line.length - 1
  while (k > 0 && line[k].start > ms) k--
  const slot = line[k].slot
  while (k >= 0 && tracksFor(line[k].slot).length === 0) k--
  if (k < 0) return { slot, playing: null }
  const tracks = tracksFor(line[k].slot)
  // Walk through the slot's (repeating) track list
  let into = Math.max(0, ms - line[k].start)
  let idx = 0
  const total = tracks.reduce((n, t) => n + Math.max(1000, t.durationMs - (t.startMs || 0)), 0)
  into = into % total
  while (into >= Math.max(1000, tracks[idx].durationMs - (tracks[idx].startMs || 0))) {
    into -= Math.max(1000, tracks[idx].durationMs - (tracks[idx].startMs || 0))
    idx++
  }
  const rotated = [...tracks.slice(idx), ...tracks.slice(0, idx)]
  return { slot, playing: { fromSlot: line[k].slot, tracks: rotated, positionMs: (rotated[0].startMs || 0) + into } }
}

export class MusicDirector {
  currentSlot: MusicSlotId | null = null
  private base: number
  private cfg: SessionConfig
  private mode: ChangeMode
  onError?: (msg: string) => void
  /** Called when the browser is holding the music back until a tap (phones) */
  onBlocked?: () => void

  constructor(cfg: SessionConfig, opts: { volume: number; mode: ChangeMode }) {
    this.cfg = cfg
    this.base = opts.volume
    this.mode = opts.mode
  }

  /** Music on/off from the session. Off means nothing plays until turned back on. */
  enabled = true

  get active() {
    return this.enabled && playback.isReady()
  }

  /** Turn music off (fade out) or on (find a device, then pick up at the right moment) */
  async setEnabled(on: boolean, state: SessionState): Promise<boolean> {
    this.enabled = on
    if (!on) {
      if (playback.isReady()) {
        await playback.fadeTo(0, 1200)
        await playback.pause()
        await playback.setVolume(this.base)
      }
      return true
    }
    const ok = await playback.ensureDevice()
    if (ok) await this.sync(state)
    return ok
  }

  setBaseVolume(v: number) {
    this.base = v
    if (this.active) void playback.setVolume(v)
  }

  tracksFor(slot: MusicSlotId): TrackRef[] {
    return getMix()[slot] || []
  }

  async start() {
    if (this.enabled) await playback.ensureDevice()
    if (!this.active) return
    await playback.setVolume(this.base)
    // Arrival music if chosen, otherwise wait for cycle 1
    if (this.tracksFor('arrive').length) await this.playSlot('arrive')
  }

  handle(events: SessionEvent[]) {
    if (!this.active) return
    for (const e of events) {
      if (e.type === 'countdown' && this.mode === 'release') {
        void playback.setVolume(this.base * (DUCK[e.n] ?? 1))
      }
      if (e.type !== 'phase') continue
      const next = slotForCycle(e.cycleIndex + 1, this.cfg)
      switch (e.phase) {
        case 'breathe': {
          // Cycle 1 begins, or a jump landed here. In the normal flow the release
          // (or hold) already switched to this slot, so nothing happens.
          const slot = slotForCycle(e.cycleIndex, this.cfg)
          if (this.currentSlot !== slot) void this.playSlot(slot)
          break
        }
        case 'release':
          if (this.mode === 'release') void this.playSlot(next)
          break
        case 'holdOut':
          if (this.mode === 'holdStart') void this.playSlot(next, 0.5)
          break
        case 'rest':
          if (this.currentSlot !== 'rest') void this.playSlot('rest')
          break
        case 'complete':
          void playback.fadeTo(0, 8000).then(() => playback.pause())
          break
      }
    }
  }

  /** Play a slot's tracks, rising in from the ducked level. Empty slot: carry on. */
  async playSlot(slot: MusicSlotId, fromLevel = 0.28) {
    const tracks = this.tracksFor(slot)
    if (!tracks.length) {
      this.currentSlot = slot
      await playback.fadeTo(this.base, 2500)
      return
    }
    try {
      this.currentSlot = slot
      await playback.playTracks(tracks, { volume: this.base * fromLevel })
      this.checkAudible()
      await playback.fadeTo(this.base, 3500)
    } catch (e) {
      this.onError?.((e as Error).message)
    }
  }

  /** After a scrub: make the music match the moment we landed on */
  async sync(state: SessionState) {
    if (!this.active) return
    const at = musicAt(plannedPosition(state, this.cfg), this.cfg, this.mode, (s) => this.tracksFor(s))
    this.currentSlot = at.slot
    try {
      if (!at.playing) {
        await playback.fadeTo(0, 800)
        await playback.pause()
        await playback.setVolume(this.base)
        return
      }
      await playback.playTracks(at.playing.tracks, { volume: this.base * 0.5, positionMs: at.playing.positionMs })
      this.checkAudible()
      await playback.fadeTo(this.base, 1500)
    } catch (e) {
      this.onError?.((e as Error).message)
    }
  }

  /** A couple of seconds after starting a song, make sure it is really playing */
  private checkAudible() {
    setTimeout(async () => {
      if (this.active && !(await playback.browserIsPlaying())) this.onBlocked?.()
    }, 2500)
  }

  async pause() {
    if (this.active) await playback.pause()
  }

  async resume() {
    if (this.active) await playback.resume()
  }

  async stop() {
    if (!this.active) return
    await playback.fadeTo(0, 1500)
    await playback.pause()
    await playback.setVolume(this.base)
  }
}

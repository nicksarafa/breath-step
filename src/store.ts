import { useCallback, useSyncExternalStore } from 'react'
import type { MusicSlotId } from './data/blueprint'
import { DEFAULT_MIX } from './data/defaultMix'
import type { TrackRef } from './spotify/api'

export type VoiceMode = 'full' | 'cues' | 'off'
export type ChangeMode = 'release' | 'holdStart'

export interface Settings {
  /** 1 to 9; shorter sessions use the first cycles in order */
  cycleCount: number
  paceScale: number
  timeScale: number
  voice: VoiceMode
  chimes: boolean
  breathTones: boolean
  changeMode: ChangeMode
  musicVolume: number
  safetyAck: boolean
  introDone: boolean
  showMap: boolean
  mapView: 'cycle' | 'journey'
  /** Weave guidance around the user's theme into each cycle */
  themeGuidance: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  cycleCount: 8,
  paceScale: 1,
  timeScale: 1,
  voice: 'full',
  chimes: true,
  breathTones: false,
  changeMode: 'release',
  musicVolume: 0.8,
  safetyAck: false,
  introDone: false,
  showMap: true,
  mapView: 'cycle',
  themeGuidance: true,
}

export type Mix = Partial<Record<MusicSlotId, TrackRef[]>>

export interface JournalEntry {
  id: string
  date: string
  topic: string
  cyclesCompleted: number
  cameThrough: string
  nextStep: string
}

const KEYS = { settings: 'bj.settings', mix: 'bj.mix', journal: 'bj.journal', topic: 'bj.topic', theme: 'bj.theme' } as const

const listeners = new Map<string, Set<() => void>>()
const cache = new Map<string, unknown>()

function read<T>(key: string, fallback: T): T {
  if (cache.has(key)) return cache.get(key) as T
  let v = fallback
  try {
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      // A stored mix is taken as is (never merged with the default), so cleared slots stay cleared
      const plainObject = typeof fallback === 'object' && fallback !== null && !Array.isArray(fallback) && key !== KEYS.mix
      v = plainObject ? { ...fallback, ...parsed } : parsed
      // One song per cycle: older mixes could hold several, keep the first
      if (key === KEYS.mix) v = Object.fromEntries(Object.entries(v as Mix).map(([k, list]) => [k, (list || []).slice(0, 1)])) as T
    }
  } catch {
    /* corrupted storage, fall back */
  }
  cache.set(key, v)
  return v
}

function write<T>(key: string, value: T) {
  cache.set(key, value)
  localStorage.setItem(key, JSON.stringify(value))
  listeners.get(key)?.forEach((l) => l())
}

const subscribers = new Map<string, (fn: () => void) => () => void>()

function subscribe(key: string) {
  let sub = subscribers.get(key)
  if (!sub) {
    sub = (fn: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set())
      listeners.get(key)!.add(fn)
      return () => {
        listeners.get(key)!.delete(fn)
      }
    }
    subscribers.set(key, sub)
  }
  return sub
}

function useKey<T>(key: string, fallback: T): [T, (next: T | ((prev: T) => T)) => void] {
  const value = useSyncExternalStore(subscribe(key), () => read(key, fallback))
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = read(key, fallback)
      write(key, typeof next === 'function' ? (next as (p: T) => T)(prev) : next)
    },
    // fallback values are module constants, so key is the only dependency
    [key],
  )
  return [value, set]
}

const EMPTY_JOURNAL: JournalEntry[] = []

export const useSettings = () => useKey<Settings>(KEYS.settings, DEFAULT_SETTINGS)
export const useMix = () => useKey<Mix>(KEYS.mix, DEFAULT_MIX)
export const useJournal = () => useKey<JournalEntry[]>(KEYS.journal, EMPTY_JOURNAL)
export const useTopic = () => useKey<string>(KEYS.topic, '')
export const useTheme = () => useKey<string>(KEYS.theme, '')

/** Non-React access for the music director */
export const getMix = () => read<Mix>(KEYS.mix, DEFAULT_MIX)
export const setMix = (m: Mix) => write(KEYS.mix, m)

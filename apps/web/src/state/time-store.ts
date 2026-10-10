import { create } from 'zustand'
import { NO_TIME, type TimeVisibility } from '@/lib/time'

/**
 * The time cursor as the sky reads it. The year lives in the URL; the explorer mirrors it here
 * (with what it hides and marks as new) for the 3D scene, which cannot read the router.
 */
export interface TimeStoreState extends TimeVisibility {
  year: number | null
  /** The years in which something on screen appeared, oldest first. */
  steps: number[]
  playing: boolean
  setTime(state: { year: number | null; steps: number[] } & TimeVisibility): void
  setPlaying(playing: boolean): void
}

export const useTimeStore = create<TimeStoreState>((set) => ({
  year: null,
  steps: [],
  playing: false,
  ...NO_TIME,
  setTime: (state) => set(state),
  setPlaying: (playing) => set({ playing }),
}))

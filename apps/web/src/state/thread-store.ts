import type { GraphNode } from '@constellation/domain'
import { create } from 'zustand'
import type { Vec3 } from '@/lib/layout'
import { parseStoredThread, recordStep, syncPositions, walkThread, type ThreadStep } from '@/lib/thread'

const STORAGE_KEY = 'constellation.thread'

function load(): ThreadStep[] {
  try {
    // A reload starts a new sky at the origin: the remembered places no longer match it, so the
    // steps come back in the panel and return to the sky as they are visited again.
    if (typeof window === 'undefined') return []
    return parseStoredThread(window.sessionStorage.getItem(STORAGE_KEY)).map((step) => ({ ...step, position: null }))
  } catch {
    return []
  }
}

function save(steps: ThreadStep[]): void {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(steps))
  } catch {
    // storage unavailable (private mode, quota): the thread still lives in memory
  }
}

export interface ThreadStoreState {
  steps: ThreadStep[]
  /** The "Your thread" panel is open. */
  open: boolean
  /** The step in view while walking the thread with `[` `]` (`null`: the last step). */
  cursor: number | null
  loaded: boolean
  /** Read the thread kept for this tab (once, on the client). */
  hydrate(): void
  /** A new focus: add it as a step, and refresh where the steps on screen are drawn. */
  record(node: GraphNode, positions: ReadonlyMap<string, Vec3>): void
  /** Move along the thread without adding a step; returns the step to fly to, if any. */
  walk(direction: -1 | 1): ThreadStep | null
  clear(): void
  setOpen(open: boolean): void
  toggle(): void
}

export const useThreadStore = create<ThreadStoreState>((set, get) => ({
  steps: [],
  open: false,
  cursor: null,
  loaded: false,
  hydrate: () => {
    if (get().loaded) return
    set({ steps: load(), loaded: true })
  },
  record: (node, positions) => {
    const { cursor, steps: current } = get()
    // Arriving on the step being walked to: the thread stays as it is (only where it is drawn).
    if (cursor !== null && current[cursor]?.id === node.id) {
      const synced = syncPositions(current, positions)
      if (synced !== current) {
        set({ steps: synced })
        save(synced)
      }
      return
    }
    if (cursor !== null) set({ cursor: null })
    const synced = syncPositions(get().steps, positions)
    const steps = recordStep(synced, node, positions.get(node.id) ?? null)
    if (steps === get().steps) return
    set({ steps })
    save(steps)
  },
  walk: (direction) => {
    const { steps, cursor } = get()
    const next = walkThread(steps.length, cursor, direction)
    if (next === null) return null
    // Back on the last step: walking is over, new focuses add steps again.
    set({ cursor: next === steps.length - 1 ? null : next })
    return steps[next] ?? null
  },
  clear: () => {
    set({ steps: [], cursor: null })
    save([])
  },
  setOpen: (open) => set({ open }),
  toggle: () => set((s) => ({ open: !s.open })),
}))

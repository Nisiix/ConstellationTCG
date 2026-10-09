import { create } from 'zustand'
import type { PathResponse } from '@/lib/path-steps'

export type PathStatus = 'idle' | 'loading' | 'ready' | 'error'

/** The path being shown (path mode, `?path=<a>,<b>`): null outside path mode. */
export interface PathStoreState {
  key: string | null
  status: PathStatus
  data: PathResponse | null
  error: string | null
  setLoading(key: string): void
  setPath(key: string, data: PathResponse): void
  setError(key: string, message: string): void
  reset(): void
  /** "Connect to…" is choosing the other end. */
  picking: boolean
  setPicking(picking: boolean): void
}

export const usePathStore = create<PathStoreState>((set) => ({
  key: null,
  status: 'idle',
  data: null,
  error: null,
  picking: false,
  setLoading: (key) => set((s) => (s.key === key && s.data ? { status: 'loading' } : { key, status: 'loading', data: null, error: null })),
  setPath: (key, data) => set({ key, status: 'ready', data, error: null }),
  setError: (key, message) => set({ key, status: 'error', data: null, error: message }),
  reset: () => set({ key: null, status: 'idle', data: null, error: null }),
  setPicking: (picking) => set({ picking }),
}))

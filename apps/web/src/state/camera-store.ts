import type { CameraMode, CameraTransition } from '@constellation/domain'
import { create } from 'zustand'

export interface CameraStoreState {
  targetNodeId: string | null
  mode: CameraMode
  transition: CameraTransition
  /** Increments each time a flight is requested, even towards the same node. */
  flightId: number
  /** Request a camera flight towards a node. `follow` keeps the current framing distance. */
  flyTo(nodeId: string | null, mode?: CameraMode): void
  setTransition(transition: CameraTransition): void
  setMode(mode: CameraMode): void
  reset(): void
}

export const useCameraStore = create<CameraStoreState>((set) => ({
  targetNodeId: null,
  mode: 'focus',
  transition: 'idle',
  flightId: 0,
  flyTo: (nodeId, mode = 'focus') =>
    set((state) => ({ targetNodeId: nodeId, mode, flightId: state.flightId + 1, transition: 'moving' })),
  setTransition: (transition) => set({ transition }),
  setMode: (mode) => set({ mode }),
  reset: () => set((state) => ({ targetNodeId: null, mode: 'focus', flightId: state.flightId + 1, transition: 'moving' })),
}))

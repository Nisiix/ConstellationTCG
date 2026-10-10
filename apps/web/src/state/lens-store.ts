import { create } from 'zustand'
import type { Landmarks } from '@/lib/landmarks-view'
import type { Lineage } from '@/lib/lineage-view'

/** What the dedicated views read beyond the points on screen (eras, artists, reasons). */
export interface LensStoreState {
  lineage: Lineage | null
  landmarks: Landmarks | null
  setLineage(lineage: Lineage | null): void
  setLandmarks(landmarks: Landmarks | null): void
}

export const useLensStore = create<LensStoreState>((set) => ({
  lineage: null,
  landmarks: null,
  setLineage: (lineage) => set({ lineage }),
  setLandmarks: (landmarks) => set({ landmarks }),
}))

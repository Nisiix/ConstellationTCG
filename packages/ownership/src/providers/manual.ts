/**
 * The wallet-less provider: cards a person declares to own, by the printing's id in the catalog.
 * Nothing is fetched; it exists so the interface and the registry describe it like the others.
 */
import type { OwnershipProvider } from '../types'

export const MANUAL_PLATFORM = 'manual'

export const manualProvider: OwnershipProvider = {
  id: 'manual',
  kind: 'manual',
  label: 'Declared cards (no wallet)',
  chains: [{ id: 'manual', label: 'Declared by you', source: 'your own list' }],
  availability: () => ({ available: true }),
  normalizeAddress: () => MANUAL_PLATFORM,
  fetchAssets: async () => [],
}

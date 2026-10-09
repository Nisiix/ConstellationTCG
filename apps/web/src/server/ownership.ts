import 'server-only'
import { createProviderRegistry, type ProviderRegistry } from '@constellation/ownership'
import { loadRootEnv } from './db'

const globalRef = globalThis as unknown as { __constellationProviders?: ProviderRegistry }

/** Ownership providers (EVM via Blockscout, Solana via DAS, declared cards) configured from the environment. */
export function getProviderRegistry(): ProviderRegistry {
  if (!globalRef.__constellationProviders) {
    loadRootEnv()
    globalRef.__constellationProviders = createProviderRegistry({ env: process.env })
  }
  return globalRef.__constellationProviders
}

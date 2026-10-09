import { ProviderError } from '@constellation/domain'
import { createBlockscoutProvider } from './providers/blockscout'
import { manualProvider } from './providers/manual'
import { createSolanaDasProvider } from './providers/solana-das'
import type { ChainInfo, OwnershipProvider, ProviderAvailability, ProviderKind } from './types'

/** What the interface needs to know about a provider. */
export interface ProviderDescriptor {
  id: string
  kind: ProviderKind
  label: string
  chains: ChainInfo[]
  availability: ProviderAvailability
}

export interface ProviderRegistry {
  list(): ProviderDescriptor[]
  get(id: string): OwnershipProvider | undefined
  /** The provider, or a `ProviderError` (400) when unknown. */
  require(id: string): OwnershipProvider
}

export interface ProviderRegistryOptions {
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
  /** Replace the default providers (tests, other deployments). */
  providers?: OwnershipProvider[]
}

export function createProviderRegistry(options: ProviderRegistryOptions = {}): ProviderRegistry {
  const providers = new Map<string, OwnershipProvider>()
  const list = options.providers ?? [
    createBlockscoutProvider({ env: options.env, fetch: options.fetch }),
    createSolanaDasProvider({ env: options.env, fetch: options.fetch }),
    manualProvider,
  ]
  for (const p of list) providers.set(p.id, p)
  return {
    list: () =>
      [...providers.values()].map((p) => ({
        id: p.id,
        kind: p.kind,
        label: p.label,
        chains: [...p.chains],
        availability: p.availability(),
      })),
    get: (id) => providers.get(id),
    require(id) {
      const provider = providers.get(id)
      if (!provider)
        throw new ProviderError(`Unknown provider: ${id}`, { status: 400, provider: id })
      return provider
    },
  }
}

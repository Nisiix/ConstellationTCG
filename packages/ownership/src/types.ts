/**
 * My Constellation — ownership types.
 *
 * A provider reads which digital assets an address holds. It never reads prices: anything that
 * looks like market data is stripped before an asset is stored (see `sanitize.ts`).
 */

export type ProviderKind = 'evm' | 'solana' | 'manual'

/** One asset as a provider reports it, before it is stored. */
export interface ProviderAsset {
  /** Provider / platform key, e.g. `evm`, `solana`, `manual`. */
  platform: string
  /** Chain key, e.g. `ethereum`, `polygon`, `solana`; `manual` for declared cards. */
  chain: string
  /** Collection / contract (EVM) or mint (Solana) address. */
  contractAddress: string
  /** Token id within the contract; the mint itself on Solana; the printing's external id when manual. */
  tokenId: string
  name: string | null
  metadataUri: string | null
  imageUri: string | null
  /** Trait-like attributes, normalised to `{ name: value }`. */
  attributes: Record<string, unknown>
  /** The provider payload for this asset, with market data removed. */
  rawMetadata: Record<string, unknown>
  quantity: number
}

export interface FetchAssetsOptions {
  signal?: AbortSignal
  /** Stop after this many assets (safety valve for enormous wallets). */
  maxAssets?: number
  fetch?: typeof fetch
}

export interface OwnershipProvider {
  readonly id: string
  readonly kind: ProviderKind
  readonly label: string
  /** Chains this provider can read. */
  readonly chains: readonly ChainInfo[]
  /** Is the provider usable with the current configuration? */
  availability(): ProviderAvailability
  /** Validate and normalise an address for this provider (throws `ValidationError`). */
  normalizeAddress(address: string): string
  /** Read every asset the address holds on `chain`. */
  fetchAssets(
    address: string,
    chain: string,
    options?: FetchAssetsOptions,
  ): Promise<ProviderAsset[]>
}

export interface ChainInfo {
  id: string
  label: string
  /** Where the data comes from, for the interface and the docs. */
  source: string
}

export interface ProviderAvailability {
  available: boolean
  /** Why not, in one sentence, when `available` is false. */
  reason?: string
}

export interface WalletRecord {
  id: string
  ownerId: string
  provider: string
  chain: string
  address: string
  label: string | null
  verifiedAt: string | null
  syncStatus: string
  syncError: string | null
  lastSyncedAt: string | null
  assetCount: number
  createdAt: string
  updatedAt: string
}

export interface SyncSummary {
  walletId: string
  assetsSeen: number
  assetsResolved: number
  assetsAmbiguous: number
  assetsUnresolved: number
  /** Ownership rows removed because the address no longer holds the asset. */
  released: number
}

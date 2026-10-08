export interface DigitalAsset {
  id: string
  platform: string
  chain: string | null
  contractAddress: string | null
  tokenId: string | null
  name: string | null
  metadataUri: string | null
  imageUri: string | null
  attributes: Record<string, unknown>
  rawMetadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface DigitalOwnership {
  id: string
  assetId: string
  ownerId: string
  walletAddress: string | null
  quantity: number
  firstSeen: string
  lastSeen: string
  source: string
}

/** Signals the resolver can use to match an asset to a printing. */
export interface AssetMatchSignals {
  game?: string
  name?: string
  set?: string
  cardNumber?: string
  language?: string
  variant?: string
  finish?: string
  edition?: string
  artist?: string
  imageUri?: string
  externalIds?: Record<string, string>
  platformMetadata?: Record<string, unknown>
}

export type ResolverStatus = 'resolved' | 'ambiguous' | 'unresolved'

export interface ResolverCandidate {
  printingId: string
  confidence: number
  reasons: string[]
}

export type ResolverResult =
  | { status: 'resolved'; confidence: number; printingId: string; candidates: ResolverCandidate[] }
  | { status: 'ambiguous'; confidence: number; candidates: ResolverCandidate[] }
  | { status: 'unresolved'; confidence: number; candidates: ResolverCandidate[] }

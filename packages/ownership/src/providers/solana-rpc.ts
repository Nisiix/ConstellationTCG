/**
 * Solana ownership without any key: the public mainnet JSON-RPC.
 *
 * Token accounts of the owner (SPL Token and Token-2022) → the mints held once with no decimals
 * (non-fungible) → their Metaplex metadata accounts (program-derived addresses, read in batches) →
 * name, symbol and the off-chain JSON (image, attributes). Slower and rate limited compared to a
 * DAS endpoint, but it works with nothing configured. Market fields are stripped as everywhere.
 */
import { ProviderError } from '@constellation/domain'
import { ed25519 } from '@noble/curves/ed25519.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { utf8ToBytes } from '@noble/hashes/utils.js'
import { base58 } from '@scure/base'
import { stripMarketData } from '../sanitize'
import type { ProviderAsset } from '../types'
import { attributesToRecord } from './blockscout'

export const PUBLIC_SOLANA_RPC = 'https://api.mainnet-beta.solana.com'
export const TOKEN_PROGRAM = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
export const TOKEN_2022_PROGRAM = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
export const METADATA_PROGRAM = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'

const PDA_MARKER = utf8ToBytes('ProgramDerivedAddress')
const METADATA_SEED = utf8ToBytes('metadata')
const METADATA_PROGRAM_BYTES = base58.decode(METADATA_PROGRAM)

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

function onCurve(bytes: Uint8Array): boolean {
  try {
    ed25519.Point.fromBytes(bytes)
    return true
  } catch {
    return false
  }
}

/**
 * Solana's `findProgramAddress`: the first off-curve sha256 of the seeds, a bump byte (255 down),
 * the program id and the PDA marker. Metaplex metadata lives at seeds `metadata`, program id, mint.
 */
export function findProgramAddress(
  seeds: Uint8Array[],
  programId: Uint8Array,
): { address: Uint8Array; bump: number } {
  for (let bump = 255; bump >= 0; bump -= 1) {
    const hash = sha256(concat(...seeds, new Uint8Array([bump]), programId, PDA_MARKER))
    if (!onCurve(hash)) return { address: hash, bump }
  }
  throw new ProviderError('No program address found', { status: 500 })
}

export function metadataAddress(mint: string): string {
  const { address } = findProgramAddress(
    [METADATA_SEED, METADATA_PROGRAM_BYTES, base58.decode(mint)],
    METADATA_PROGRAM_BYTES,
  )
  return base58.encode(address)
}

export interface OnChainMetadata {
  mint: string
  updateAuthority: string
  name: string
  symbol: string
  uri: string
}

function readString(data: Uint8Array, offset: number): { value: string; next: number } {
  if (offset + 4 > data.length) throw new RangeError('string length out of bounds')
  const length =
    data[offset]! | (data[offset + 1]! << 8) | (data[offset + 2]! << 16) | (data[offset + 3]! << 24)
  const start = offset + 4
  const end = start + length
  if (length < 0 || end > data.length) throw new RangeError('string out of bounds')
  // Metaplex pads strings with NULs to a fixed width.
  const text = new TextDecoder().decode(data.subarray(start, end)).replace(/\0+$/, '')
  return { value: text, next: end }
}

/** Metaplex token metadata (v1 layout head): key, update authority, mint, name, symbol, uri. */
export function parseMetadata(data: Uint8Array): OnChainMetadata | null {
  try {
    if (data.length < 1 + 32 + 32 + 4) return null
    if (data[0] !== 4) return null // MetadataV1
    const updateAuthority = base58.encode(data.subarray(1, 33))
    const mint = base58.encode(data.subarray(33, 65))
    const name = readString(data, 65)
    const symbol = readString(data, name.next)
    const uri = readString(data, symbol.next)
    return {
      mint,
      updateAuthority,
      name: name.value.trim(),
      symbol: symbol.value.trim(),
      uri: uri.value.trim(),
    }
  } catch {
    return null
  }
}

export function encodeMetadataForTests(
  meta: Omit<OnChainMetadata, 'mint' | 'updateAuthority'> & {
    mint: string
    updateAuthority: string
  },
): Uint8Array {
  const str = (value: string, width: number) => {
    const bytes = utf8ToBytes(value)
    const padded = new Uint8Array(width)
    padded.set(bytes.subarray(0, width))
    const len = new Uint8Array(4)
    new DataView(len.buffer).setUint32(0, width, true)
    return concat(len, padded)
  }
  return concat(
    new Uint8Array([4]),
    base58.decode(meta.updateAuthority),
    base58.decode(meta.mint),
    str(meta.name, 32),
    str(meta.symbol, 10),
    str(meta.uri, 200),
  )
}

interface RpcCall {
  method: string
  params: unknown[]
}

async function rpc<T>(
  doFetch: typeof fetch,
  url: string,
  call: RpcCall,
  signal?: AbortSignal,
): Promise<T> {
  let response: Response
  try {
    response = await doFetch(url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: call.method, params: call.params }),
    })
  } catch (error) {
    throw new ProviderError(
      'Solana RPC is unreachable',
      { status: 502, method: call.method },
      { cause: error },
    )
  }
  if (response.status === 429)
    throw new ProviderError(
      'Solana public RPC is rate limiting us; try again in a minute or set a DAS endpoint',
      { status: 503, method: call.method },
    )
  if (!response.ok)
    throw new ProviderError(`Solana RPC answered ${response.status}`, {
      status: 502,
      upstream: response.status,
      method: call.method,
    })
  const body = (await response.json()) as {
    result?: T
    error?: { code?: number; message?: string }
  }
  if (body.error)
    throw new ProviderError(`Solana RPC error: ${body.error.message ?? 'unknown'}`, {
      status: 502,
      code: body.error.code,
      method: call.method,
    })
  return body.result as T
}

interface TokenAccountsResult {
  value?: Array<{
    account?: {
      data?: {
        parsed?: { info?: { mint?: string; tokenAmount?: { amount?: string; decimals?: number } } }
      }
    }
  }>
}

interface MultipleAccountsResult {
  value?: Array<{ data?: [string, string] } | null>
}

export interface SolanaRpcOptions {
  fetch?: typeof fetch
  signal?: AbortSignal
  maxAssets?: number
  /** Parallel off-chain metadata downloads. */
  concurrency?: number
}

/** Mints the owner holds exactly once with no decimals: the non-fungible tokens. */
async function nonFungibleMints(
  doFetch: typeof fetch,
  url: string,
  owner: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const mints = new Set<string>()
  for (const programId of [TOKEN_PROGRAM, TOKEN_2022_PROGRAM]) {
    const result = await rpc<TokenAccountsResult>(
      doFetch,
      url,
      {
        method: 'getTokenAccountsByOwner',
        params: [owner, { programId }, { encoding: 'jsonParsed' }],
      },
      signal,
    )
    for (const entry of result?.value ?? []) {
      const info = entry.account?.data?.parsed?.info
      const amount = info?.tokenAmount
      if (info?.mint && amount?.amount === '1' && amount.decimals === 0) mints.add(info.mint)
    }
  }
  return [...mints]
}

function decodeBase64(text: string): Uint8Array {
  return Uint8Array.from(Buffer.from(text, 'base64'))
}

/** On-chain metadata for many mints, 100 accounts per request. */
async function metadataFor(
  doFetch: typeof fetch,
  url: string,
  mints: string[],
  signal?: AbortSignal,
): Promise<Map<string, OnChainMetadata>> {
  const out = new Map<string, OnChainMetadata>()
  for (let i = 0; i < mints.length; i += 100) {
    const chunk = mints.slice(i, i + 100)
    const addresses = chunk.map((mint) => metadataAddress(mint))
    const result = await rpc<MultipleAccountsResult>(
      doFetch,
      url,
      { method: 'getMultipleAccounts', params: [addresses, { encoding: 'base64' }] },
      signal,
    )
    result?.value?.forEach((account, index) => {
      const mint = chunk[index]
      const encoded = account?.data?.[0]
      if (!mint || !encoded) return
      const parsed = parseMetadata(decodeBase64(encoded))
      if (parsed) out.set(mint, { ...parsed, mint })
    })
  }
  return out
}

interface OffChain {
  name?: string
  image?: string
  attributes?: unknown
  collection?: { name?: string; family?: string } | string
  properties?: { files?: Array<{ uri?: string; type?: string }> }
}

async function offChain(
  doFetch: typeof fetch,
  uri: string,
  signal?: AbortSignal,
): Promise<OffChain | null> {
  if (!/^https?:\/\//i.test(uri)) return null
  try {
    const response = await doFetch(uri, { signal, headers: { accept: 'application/json' } })
    if (!response.ok) return null
    return (await response.json()) as OffChain
  } catch {
    return null
  }
}

/** Everything a Solana address holds as non-fungible tokens, through a plain JSON-RPC endpoint. */
export async function fetchSolanaAssetsViaRpc(
  url: string,
  owner: string,
  options: SolanaRpcOptions = {},
): Promise<ProviderAsset[]> {
  const doFetch = options.fetch ?? globalThis.fetch
  const maxAssets = options.maxAssets ?? 2_000
  const concurrency = options.concurrency ?? 4
  const mints = (await nonFungibleMints(doFetch, url, owner, options.signal)).slice(0, maxAssets)
  const metadata = await metadataFor(doFetch, url, mints, options.signal)
  const assets: ProviderAsset[] = []
  const queue = [...mints]
  const worker = async () => {
    for (let mint = queue.shift(); mint !== undefined; mint = queue.shift()) {
      const onchain = metadata.get(mint)
      const json = onchain?.uri ? await offChain(doFetch, onchain.uri, options.signal) : null
      const collection =
        typeof json?.collection === 'string' ? json.collection : json?.collection?.name
      const image =
        json?.image ??
        json?.properties?.files?.find((f) => f.type?.startsWith('image/'))?.uri ??
        null
      assets.push({
        platform: 'solana',
        chain: 'solana',
        contractAddress: collection?.trim() || onchain?.symbol?.trim() || mint,
        tokenId: mint,
        name: json?.name?.trim() || onchain?.name || null,
        metadataUri: onchain?.uri || null,
        imageUri: image?.trim() || null,
        attributes: attributesToRecord(json?.attributes),
        rawMetadata: stripMarketData({
          onchain: onchain ?? null,
          offchain: json ?? null,
        } as unknown as Record<string, unknown>),
        quantity: 1,
      })
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, Math.max(1, queue.length)) }, () => worker()),
  )
  // Deterministic order: by name, then mint.
  assets.sort(
    (a, b) => (a.name ?? '').localeCompare(b.name ?? '') || a.tokenId.localeCompare(b.tokenId),
  )
  return assets
}

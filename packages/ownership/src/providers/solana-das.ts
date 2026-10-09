/**
 * Solana ownership.
 *
 * With a DAS-capable endpoint in `SOLANA_RPC_URL` (Helius, Triton, QuickNode, Shyft, …) the
 * Digital Asset Standard call `getAssetsByOwner` returns everything in a few pages. Without one,
 * the public mainnet JSON-RPC is used instead (see `solana-rpc.ts`): no key, slower, rate limited.
 * An endpoint that does not know DAS falls back to the plain RPC path on the same URL.
 *
 * Payloads may carry `token_info.price_info`: stripped before anything is kept.
 */
import { ProviderError } from '@constellation/domain'
import { normalizeSolanaAddress } from '../address'
import { stripMarketData } from '../sanitize'
import type { FetchAssetsOptions, OwnershipProvider, ProviderAsset } from '../types'
import { attributesToRecord } from './blockscout'
import { PUBLIC_SOLANA_RPC, fetchSolanaAssetsViaRpc } from './solana-rpc'

export const SOLANA_RPC_ENV = 'SOLANA_RPC_URL'
/** Override the keyless fallback endpoint (defaults to Solana's public mainnet RPC). */
export const SOLANA_PUBLIC_RPC_ENV = 'SOLANA_PUBLIC_RPC_URL'

interface DasAsset {
  id?: string
  interface?: string
  content?: {
    json_uri?: string
    metadata?: { name?: string; symbol?: string; attributes?: unknown; description?: string }
    links?: { image?: string; external_url?: string }
    files?: Array<{ uri?: string; cdn_uri?: string; mime?: string }>
  }
  grouping?: Array<{ group_key?: string; group_value?: string }>
  ownership?: { owner?: string; amount?: number }
  burnt?: boolean
}

interface DasResponse {
  result?: { total?: number; limit?: number; page?: number; items?: DasAsset[] }
  error?: { code?: number; message?: string }
}

export interface SolanaDasProviderOptions {
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
  pageSize?: number
  maxPages?: number
}

const DEFAULT_PAGE_SIZE = 1_000
const DEFAULT_MAX_PAGES = 20
const DEFAULT_MAX_ASSETS = 2_000

export function createSolanaDasProvider(options: SolanaDasProviderOptions = {}): OwnershipProvider {
  const env = options.env ?? process.env
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES
  const endpoint = () => env[SOLANA_RPC_ENV]?.trim() || null
  const publicEndpoint = () => env[SOLANA_PUBLIC_RPC_ENV]?.trim() || PUBLIC_SOLANA_RPC

  return {
    id: 'solana',
    kind: 'solana',
    label: 'Solana wallet',
    chains: [{ id: 'solana', label: 'Solana', source: endpoint() ? 'DAS endpoint' : 'public RPC' }],
    availability: () =>
      endpoint()
        ? { available: true }
        : {
            available: true,
            reason: `Using Solana's public RPC: slower and rate limited. For large wallets set a DAS endpoint in ${SOLANA_RPC_ENV}.`,
          },
    normalizeAddress: normalizeSolanaAddress,
    async fetchAssets(address, chain, fetchOptions: FetchAssetsOptions = {}) {
      if (chain !== 'solana')
        throw new ProviderError(`Unknown Solana chain: ${chain}`, { status: 400, chain })
      const owner = normalizeSolanaAddress(address)
      const doFetch = fetchOptions.fetch ?? options.fetch ?? globalThis.fetch
      const maxAssets = fetchOptions.maxAssets ?? DEFAULT_MAX_ASSETS
      const url = endpoint()
      if (!url)
        return fetchSolanaAssetsViaRpc(publicEndpoint(), owner, {
          fetch: doFetch,
          signal: fetchOptions.signal,
          maxAssets,
        })
      const assets: ProviderAsset[] = []
      for (let page = 1; page <= maxPages; page += 1) {
        let body: DasResponse
        try {
          body = await rpc(doFetch, url, owner, page, pageSize, fetchOptions.signal)
        } catch (error) {
          // Not a DAS endpoint after all: the plain RPC path knows the same URL.
          if (error instanceof ProviderError && error.details.code === -32601 && page === 1) {
            return fetchSolanaAssetsViaRpc(url, owner, {
              fetch: doFetch,
              signal: fetchOptions.signal,
              maxAssets,
            })
          }
          throw error
        }
        const items = body.result?.items ?? []
        for (const item of items) {
          const asset = mapDasAsset(item)
          if (asset) assets.push(asset)
          if (assets.length >= maxAssets) return assets
        }
        if (items.length < pageSize) break
      }
      return assets
    },
  }
}

async function rpc(
  doFetch: typeof fetch,
  url: string,
  owner: string,
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<DasResponse> {
  let response: Response
  try {
    response = await doFetch(url, {
      method: 'POST',
      signal,
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: `constellation-${page}`,
        method: 'getAssetsByOwner',
        params: {
          ownerAddress: owner,
          page,
          limit,
          displayOptions: { showFungible: false, showNativeBalance: false },
        },
      }),
    })
  } catch (error) {
    throw new ProviderError(
      'Solana RPC is unreachable',
      { status: 502, address: owner },
      { cause: error },
    )
  }
  if (!response.ok)
    throw new ProviderError(`Solana RPC answered ${response.status}`, {
      status: 502,
      upstream: response.status,
      address: owner,
    })
  let body: DasResponse
  try {
    body = (await response.json()) as DasResponse
  } catch (error) {
    throw new ProviderError(
      'Solana RPC returned invalid JSON',
      { status: 502, address: owner },
      { cause: error },
    )
  }
  if (body.error) {
    throw new ProviderError(`Solana RPC error: ${body.error.message ?? 'unknown'}`, {
      status: 502,
      code: body.error.code,
      address: owner,
    })
  }
  return body
}

/** One DAS asset → provider asset (null for burnt tokens or malformed entries). */
export function mapDasAsset(item: DasAsset): ProviderAsset | null {
  if (!item.id || item.burnt) return null
  const content = item.content ?? {}
  const collection = item.grouping?.find((g) => g.group_key === 'collection')?.group_value
  const files = content.files ?? []
  const image =
    content.links?.image ??
    files.find((f) => f.mime?.startsWith('image/'))?.cdn_uri ??
    files[0]?.uri ??
    null
  const amount = item.ownership?.amount
  return {
    platform: 'solana',
    chain: 'solana',
    contractAddress: collection ?? item.id,
    tokenId: item.id,
    name: content.metadata?.name?.trim() || null,
    metadataUri: content.json_uri?.trim() || null,
    imageUri: image?.trim() || null,
    attributes: attributesToRecord(content.metadata?.attributes),
    rawMetadata: stripMarketData(item as unknown as Record<string, unknown>),
    quantity: typeof amount === 'number' && amount > 0 ? amount : 1,
  }
}

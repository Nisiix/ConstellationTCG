/**
 * EVM ownership through Blockscout's public REST API (v2).
 *
 * Blockscout is the open-source explorer run for most EVM networks; its API needs no key and is
 * reachable from a browser or a server. One instance per chain: the defaults below are the public
 * instances, each overridable with `BLOCKSCOUT_<CHAIN>_URL` (a self-hosted explorer, a mirror).
 *
 * Endpoint: `GET {host}/api/v2/addresses/{address}/nft?type=ERC-721,ERC-1155`, paginated through
 * `next_page_params`. The payload carries token market data (`exchange_rate`, volumes): it is
 * stripped before anything is kept.
 */
import { ProviderError } from '@constellation/domain'
import { normalizeEvmAddress } from '../address'
import { stripMarketData } from '../sanitize'
import type { ChainInfo, FetchAssetsOptions, OwnershipProvider, ProviderAsset } from '../types'

export interface BlockscoutChain extends ChainInfo {
  /** Default public instance. */
  host: string
  /** Environment variable that overrides the host. */
  env: string
}

export const BLOCKSCOUT_CHAINS: readonly BlockscoutChain[] = [
  {
    id: 'ethereum',
    label: 'Ethereum',
    source: 'eth.blockscout.com',
    host: 'https://eth.blockscout.com',
    env: 'BLOCKSCOUT_ETHEREUM_URL',
  },
  {
    id: 'polygon',
    label: 'Polygon',
    source: 'polygon.blockscout.com',
    host: 'https://polygon.blockscout.com',
    env: 'BLOCKSCOUT_POLYGON_URL',
  },
  {
    id: 'base',
    label: 'Base',
    source: 'base.blockscout.com',
    host: 'https://base.blockscout.com',
    env: 'BLOCKSCOUT_BASE_URL',
  },
  {
    id: 'arbitrum',
    label: 'Arbitrum One',
    source: 'arbitrum.blockscout.com',
    host: 'https://arbitrum.blockscout.com',
    env: 'BLOCKSCOUT_ARBITRUM_URL',
  },
  {
    id: 'optimism',
    label: 'OP Mainnet',
    source: 'optimism.blockscout.com',
    host: 'https://optimism.blockscout.com',
    env: 'BLOCKSCOUT_OPTIMISM_URL',
  },
  {
    id: 'gnosis',
    label: 'Gnosis',
    source: 'gnosis.blockscout.com',
    host: 'https://gnosis.blockscout.com',
    env: 'BLOCKSCOUT_GNOSIS_URL',
  },
  {
    id: 'zksync',
    label: 'ZKsync Era',
    source: 'zksync.blockscout.com',
    host: 'https://zksync.blockscout.com',
    env: 'BLOCKSCOUT_ZKSYNC_URL',
  },
  {
    id: 'scroll',
    label: 'Scroll',
    source: 'scroll.blockscout.com',
    host: 'https://scroll.blockscout.com',
    env: 'BLOCKSCOUT_SCROLL_URL',
  },
  {
    id: 'linea',
    label: 'Linea',
    source: 'explorer.linea.build',
    host: 'https://explorer.linea.build',
    env: 'BLOCKSCOUT_LINEA_URL',
  },
  {
    id: 'immutable',
    label: 'Immutable zkEVM',
    source: 'explorer.immutable.com',
    host: 'https://explorer.immutable.com',
    env: 'BLOCKSCOUT_IMMUTABLE_URL',
  },
]

/** The parts of a Blockscout NFT instance we read. Everything else is kept (sanitised) as raw metadata. */
interface BlockscoutItem {
  id?: string | number
  value?: string | number
  token_type?: string
  image_url?: string | null
  media_url?: string | null
  external_app_url?: string | null
  metadata?: {
    name?: string
    image?: string
    attributes?:
      Array<{ trait_type?: string; name?: string; value?: unknown }> | Record<string, unknown>
  } | null
  token?: { address?: string; address_hash?: string; name?: string | null; type?: string } | null
}

interface BlockscoutPage {
  items?: BlockscoutItem[]
  next_page_params?: Record<string, string | number | boolean | null> | null
}

export interface BlockscoutProviderOptions {
  env?: Record<string, string | undefined>
  fetch?: typeof fetch
  /** Pages never exceed this many requests per sync (safety valve). */
  maxPages?: number
}

const DEFAULT_MAX_PAGES = 40
const DEFAULT_MAX_ASSETS = 2_000

export function createBlockscoutProvider(
  options: BlockscoutProviderOptions = {},
): OwnershipProvider {
  const env = options.env ?? process.env
  const maxPages = options.maxPages ?? DEFAULT_MAX_PAGES

  const hostFor = (chainId: string): string => {
    const chain = BLOCKSCOUT_CHAINS.find((c) => c.id === chainId)
    if (!chain)
      throw new ProviderError(`Unknown EVM chain: ${chainId}`, { status: 400, chain: chainId })
    return (env[chain.env]?.trim() || chain.host).replace(/\/+$/, '')
  }

  return {
    id: 'evm',
    kind: 'evm',
    label: 'EVM wallet (Ethereum & L2s)',
    chains: BLOCKSCOUT_CHAINS.map(({ id, label, source }) => ({ id, label, source })),
    availability: () => ({ available: true }),
    normalizeAddress: normalizeEvmAddress,
    async fetchAssets(address, chainId, fetchOptions = {}) {
      const owner = normalizeEvmAddress(address)
      const host = hostFor(chainId)
      const doFetch = fetchOptions.fetch ?? options.fetch ?? globalThis.fetch
      const maxAssets = fetchOptions.maxAssets ?? DEFAULT_MAX_ASSETS
      const assets: ProviderAsset[] = []
      let next: Record<string, string | number | boolean | null> | null | undefined = null
      for (let page = 0; page < maxPages; page += 1) {
        const url = new URL(`${host}/api/v2/addresses/${owner}/nft`)
        url.searchParams.set('type', 'ERC-721,ERC-1155')
        for (const [key, value] of Object.entries(next ?? {})) {
          if (value !== null && value !== undefined) url.searchParams.set(key, String(value))
        }
        const body = await getJson<BlockscoutPage>(doFetch, url, fetchOptions.signal, {
          chain: chainId,
          address: owner,
        })
        for (const item of body.items ?? []) {
          const asset = mapBlockscoutItem(item, chainId)
          if (asset) assets.push(asset)
          if (assets.length >= maxAssets) return assets
        }
        next = body.next_page_params
        if (!next || Object.keys(next).length === 0) break
      }
      return assets
    },
  }
}

async function getJson<T>(
  doFetch: typeof fetch,
  url: URL,
  signal: AbortSignal | undefined,
  details: Record<string, unknown>,
): Promise<T> {
  let response: Response
  try {
    response = await doFetch(url, { signal, headers: { accept: 'application/json' } })
  } catch (error) {
    throw new ProviderError(
      'Blockscout is unreachable',
      { ...details, status: 502, url: url.toString() },
      { cause: error },
    )
  }
  if (response.status === 404) return { items: [] } as T
  if (!response.ok) {
    throw new ProviderError(`Blockscout answered ${response.status}`, {
      ...details,
      status: 502,
      upstream: response.status,
      url: url.toString(),
    })
  }
  try {
    return (await response.json()) as T
  } catch (error) {
    throw new ProviderError(
      'Blockscout returned invalid JSON',
      { ...details, status: 502 },
      { cause: error },
    )
  }
}

/** One Blockscout NFT instance → provider asset (null when it is not a token we can identify). */
export function mapBlockscoutItem(item: BlockscoutItem, chain: string): ProviderAsset | null {
  const contract = (item.token?.address_hash ?? item.token?.address ?? '').toLowerCase()
  if (!contract || item.id === undefined || item.id === null) return null
  const metadata = item.metadata && typeof item.metadata === 'object' ? item.metadata : {}
  const name = firstString(metadata.name, item.token?.name)
  const quantity = Number.parseInt(String(item.value ?? '1'), 10)
  return {
    platform: 'evm',
    chain,
    contractAddress: contract,
    tokenId: String(item.id),
    name,
    metadataUri: null,
    imageUri: firstString(item.image_url, metadata.image, item.media_url),
    attributes: attributesToRecord(metadata.attributes),
    rawMetadata: stripMarketData(item as unknown as Record<string, unknown>),
    quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
  }
}

function firstString(...values: unknown[]): string | null {
  for (const v of values) if (typeof v === 'string' && v.trim()) return v.trim()
  return null
}

/** `[{ trait_type, value }]` (OpenSea style) or a plain object → `{ name: value }`. */
export function attributesToRecord(attributes: unknown): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (Array.isArray(attributes)) {
    for (const entry of attributes) {
      if (!entry || typeof entry !== 'object') continue
      const e = entry as { trait_type?: unknown; name?: unknown; value?: unknown }
      const key =
        typeof e.trait_type === 'string' ? e.trait_type : typeof e.name === 'string' ? e.name : null
      if (key && e.value !== undefined) out[key] = e.value
    }
    return stripMarketData(out)
  }
  if (attributes && typeof attributes === 'object')
    return stripMarketData({ ...(attributes as Record<string, unknown>) })
  return out
}

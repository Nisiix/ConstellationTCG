import { describe, expect, it, vi } from 'vitest'
import { createBlockscoutProvider, mapBlockscoutItem } from '../providers/blockscout'
import { createSolanaDasProvider, mapDasAsset } from '../providers/solana-das'
import { createProviderRegistry } from '../registry'

const OWNER = '0x1111111111111111111111111111111111111111'

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('Blockscout provider', () => {
  const page1 = {
    items: [
      {
        id: '4',
        value: '1',
        token_type: 'ERC-721',
        image_url: 'https://img.example/4.png',
        metadata: {
          name: 'Charizard #4',
          attributes: [
            { trait_type: 'Set', value: 'Base Set' },
            { trait_type: 'Floor Price', value: 2 },
          ],
        },
        token: {
          address_hash: '0xABCDEF0000000000000000000000000000000001',
          name: 'Pokémon Cards',
          type: 'ERC-721',
          exchange_rate: '3.2',
          volume_24h: '10',
        },
      },
      {
        id: '9',
        value: '3',
        token_type: 'ERC-1155',
        metadata: null,
        token: { address: '0xabcdef0000000000000000000000000000000002', name: 'Boosters' },
      },
      { id: null, token: { address: '0xdead' } },
    ],
    next_page_params: {
      items_count: 50,
      token_contract_address_hash: '0xabc',
      token_id: '9',
      token_type: 'ERC-1155',
    },
  }
  const page2 = {
    items: [
      {
        id: '58',
        token: { address_hash: '0xabcdef0000000000000000000000000000000001' },
        metadata: { name: 'Pikachu' },
      },
    ],
    next_page_params: null,
  }

  it('reads every page, maps items and strips market data', async () => {
    const calls: string[] = []
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input)
      calls.push(url)
      return jsonResponse(calls.length === 1 ? page1 : page2)
    })
    const provider = createBlockscoutProvider({
      env: {},
      fetch: fetchMock as unknown as typeof fetch,
    })
    const assets = await provider.fetchAssets(OWNER.toUpperCase().replace('0X', '0x'), 'polygon')

    expect(calls).toHaveLength(2)
    expect(calls[0]).toBe(
      `https://polygon.blockscout.com/api/v2/addresses/${OWNER}/nft?type=ERC-721%2CERC-1155`,
    )
    expect(calls[1]).toContain('items_count=50')
    expect(calls[1]).toContain('token_id=9')

    expect(assets.map((a) => a.tokenId)).toEqual(['4', '9', '58'])
    const [charizard, boosters] = assets
    expect(charizard).toMatchObject({
      platform: 'evm',
      chain: 'polygon',
      contractAddress: '0xabcdef0000000000000000000000000000000001',
      name: 'Charizard #4',
      imageUri: 'https://img.example/4.png',
      attributes: { Set: 'Base Set' },
      quantity: 1,
    })
    expect(JSON.stringify(charizard?.rawMetadata)).not.toMatch(/exchange_rate|volume|Floor Price/)
    expect(boosters).toMatchObject({ name: 'Boosters', quantity: 3, attributes: {} })
  })

  it('honours the host override and reports upstream failures as provider errors', async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input instanceof Request ? input.url : input)
      expect(url.startsWith('https://explorer.example/api/v2/')).toBe(true)
      return jsonResponse({ message: 'nope' }, 500)
    })
    const provider = createBlockscoutProvider({
      env: { BLOCKSCOUT_ETHEREUM_URL: 'https://explorer.example/' },
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(provider.fetchAssets(OWNER, 'ethereum')).rejects.toThrow(/Blockscout answered 500/)
    await expect(provider.fetchAssets(OWNER, 'nope')).rejects.toThrow(/Unknown EVM chain/)
    await expect(provider.fetchAssets('0x12', 'ethereum')).rejects.toThrow(/EVM address/)
  })

  it('treats an unknown address (404) as empty and stops at maxAssets', async () => {
    const provider = createBlockscoutProvider({
      env: {},
      fetch: (async () => jsonResponse({}, 404)) as unknown as typeof fetch,
    })
    expect(await provider.fetchAssets(OWNER, 'base')).toEqual([])
    const many = createBlockscoutProvider({
      env: {},
      fetch: (async () =>
        jsonResponse({
          items: [
            { id: '1', token: { address: '0xa' } },
            { id: '2', token: { address: '0xa' } },
          ],
          next_page_params: { x: 1 },
        })) as unknown as typeof fetch,
    })
    expect(await many.fetchAssets(OWNER, 'base', { maxAssets: 1 })).toHaveLength(1)
  })

  it('ignores items without a contract or an id', () => {
    expect(mapBlockscoutItem({ id: '1' }, 'ethereum')).toBeNull()
    expect(mapBlockscoutItem({ token: { address: '0xa' } }, 'ethereum')).toBeNull()
  })
})

describe('Solana DAS provider', () => {
  const asset = {
    id: 'MintAddress111111111111111111111111111111111',
    interface: 'V1_NFT',
    content: {
      json_uri: 'https://meta.example/1.json',
      metadata: {
        name: 'Pikachu #58',
        attributes: [{ trait_type: 'Card Number', value: '58/102' }],
      },
      links: { image: 'https://img.example/58.png' },
      files: [{ uri: 'https://img.example/58.png', mime: 'image/png' }],
    },
    grouping: [
      { group_key: 'collection', group_value: 'Collection1111111111111111111111111111111111' },
    ],
    ownership: { owner: 'x', amount: 1 },
    token_info: { price_info: { price_per_token: 12, currency: 'USDC' }, supply: 1 },
  }

  it('uses the public RPC when no DAS endpoint is configured', async () => {
    const methods: string[] = []
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input instanceof Request ? input.url : input)).toBe('https://api.mainnet-beta.solana.com')
      methods.push((JSON.parse(String(init?.body)) as { method: string }).method)
      return jsonResponse({ jsonrpc: '2.0', id: 1, result: { value: [] } })
    })
    const provider = createSolanaDasProvider({ env: {}, fetch: fetchMock as unknown as typeof fetch })
    expect(provider.availability()).toMatchObject({ available: true })
    expect(await provider.fetchAssets('11111111111111111111111111111111', 'solana')).toEqual([])
    expect(methods).toEqual(['getTokenAccountsByOwner', 'getTokenAccountsByOwner'])
  })

  it('pages through getAssetsByOwner and strips price info', async () => {
    const bodies: unknown[] = []
    const fetchMock = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        method: string
        params: { page: number; limit: number; ownerAddress: string }
      }
      bodies.push(body)
      const items =
        body.params.page === 1
          ? [asset, { ...asset, id: 'Burnt11111111111111111111111111111111111111', burnt: true }]
          : []
      return jsonResponse({
        jsonrpc: '2.0',
        id: 1,
        result: { total: items.length, limit: body.params.limit, page: body.params.page, items },
      })
    })
    const provider = createSolanaDasProvider({
      env: { SOLANA_RPC_URL: 'https://rpc.example' },
      fetch: fetchMock as unknown as typeof fetch,
      pageSize: 2,
    })
    expect(provider.availability().available).toBe(true)
    const owner = '11111111111111111111111111111111'
    const assets = await provider.fetchAssets(owner, 'solana')
    expect(bodies).toHaveLength(2)
    expect(bodies[0]).toMatchObject({
      method: 'getAssetsByOwner',
      params: { ownerAddress: owner, page: 1, limit: 2 },
    })
    expect(assets).toHaveLength(1)
    expect(assets[0]).toMatchObject({
      platform: 'solana',
      chain: 'solana',
      contractAddress: 'Collection1111111111111111111111111111111111',
      tokenId: asset.id,
      name: 'Pikachu #58',
      metadataUri: 'https://meta.example/1.json',
      imageUri: 'https://img.example/58.png',
      attributes: { 'Card Number': '58/102' },
    })
    expect(JSON.stringify(assets[0]?.rawMetadata)).not.toMatch(/price/i)
  })

  it('surfaces RPC errors', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } }),
    )
    const provider = createSolanaDasProvider({
      env: { SOLANA_RPC_URL: 'https://rpc.example' },
      fetch: fetchMock as unknown as typeof fetch,
    })
    await expect(
      provider.fetchAssets('11111111111111111111111111111111', 'solana'),
    ).rejects.toThrow(/Method not found/)
    expect(mapDasAsset({ id: 'x', burnt: true })).toBeNull()
  })
})

describe('provider registry', () => {
  it('lists the built-in providers with their availability', () => {
    const registry = createProviderRegistry({ env: {} })
    const list = registry.list()
    expect(list.map((p) => p.id)).toEqual(['evm', 'solana', 'manual'])
    expect(list.find((p) => p.id === 'evm')?.availability.available).toBe(true)
    expect(list.find((p) => p.id === 'solana')?.availability.available).toBe(true)
    expect(list.find((p) => p.id === 'solana')?.availability.reason).toMatch(/public RPC/)
    expect(list.find((p) => p.id === 'evm')?.chains.map((c) => c.id)).toContain('ethereum')
    expect(() => registry.require('opensea')).toThrow(/Unknown provider/)
  })
})

describe('Solana without a key (public RPC)', () => {
  const OWNER = '11111111111111111111111111111111'
  const MINT = 'So11111111111111111111111111111111111111112'
  const AUTHORITY = 'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s'

  it('derives program addresses deterministically, off the curve', async () => {
    const { findProgramAddress, metadataAddress } = await import('../providers/solana-rpc')
    const { base58 } = await import('@scure/base')
    const a = metadataAddress(MINT)
    const b = metadataAddress(MINT)
    expect(a).toBe(b)
    expect(base58.decode(a)).toHaveLength(32)
    expect(a).not.toBe(MINT)
    const { bump } = findProgramAddress([new TextEncoder().encode('metadata'), base58.decode(AUTHORITY), base58.decode(MINT)], base58.decode(AUTHORITY))
    expect(bump).toBeGreaterThanOrEqual(0)
    expect(bump).toBeLessThanOrEqual(255)
  })

  it('parses Metaplex metadata and ignores anything else', async () => {
    const { encodeMetadataForTests, parseMetadata } = await import('../providers/solana-rpc')
    const bytes = encodeMetadataForTests({ mint: MINT, updateAuthority: AUTHORITY, name: 'Charizard #4', symbol: 'PKMN', uri: 'https://meta.example/4.json' })
    expect(parseMetadata(bytes)).toEqual({ mint: MINT, updateAuthority: AUTHORITY, name: 'Charizard #4', symbol: 'PKMN', uri: 'https://meta.example/4.json' })
    expect(parseMetadata(new Uint8Array([1, 2, 3]))).toBeNull()
    expect(parseMetadata(new Uint8Array(80))).toBeNull()
  })

  it('walks token accounts → metadata accounts → off-chain JSON through a plain RPC', async () => {
    const { encodeMetadataForTests, fetchSolanaAssetsViaRpc, metadataAddress } = await import('../providers/solana-rpc')
    const otherMint = 'Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS'
    const calls: string[] = []
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = String(input instanceof Request ? input.url : input)
      if (url === 'https://meta.example/4.json') {
        return jsonResponse({ name: 'Charizard', image: 'https://img.example/4.png', attributes: [{ trait_type: 'Set', value: 'Base Set' }, { trait_type: 'Price', value: 9 }], collection: { name: 'Pokémon Cards' } })
      }
      const body = JSON.parse(String(init?.body)) as { method: string; params: unknown[] }
      calls.push(body.method)
      if (body.method === 'getTokenAccountsByOwner') {
        const program = (body.params[1] as { programId: string }).programId
        const value =
          program === 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
            ? [
                { account: { data: { parsed: { info: { mint: MINT, tokenAmount: { amount: '1', decimals: 0 } } } } } },
                { account: { data: { parsed: { info: { mint: otherMint, tokenAmount: { amount: '1', decimals: 0 } } } } } },
                { account: { data: { parsed: { info: { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', tokenAmount: { amount: '2500000', decimals: 6 } } } } } },
              ]
            : []
        return jsonResponse({ jsonrpc: '2.0', id: 1, result: { value } })
      }
      if (body.method === 'getMultipleAccounts') {
        const addresses = body.params[0] as string[]
        const value = addresses.map((address) =>
          address === metadataAddress(MINT)
            ? { data: [Buffer.from(encodeMetadataForTests({ mint: MINT, updateAuthority: AUTHORITY, name: 'Charizard #4', symbol: 'PKMN', uri: 'https://meta.example/4.json' })).toString('base64'), 'base64'] }
            : null,
        )
        return jsonResponse({ jsonrpc: '2.0', id: 1, result: { value } })
      }
      return jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } })
    })
    const assets = await fetchSolanaAssetsViaRpc('https://rpc.example', OWNER, { fetch: fetchMock as unknown as typeof fetch })
    expect(calls.filter((c) => c === 'getTokenAccountsByOwner')).toHaveLength(2)
    expect(calls.filter((c) => c === 'getMultipleAccounts')).toHaveLength(1)
    expect(assets).toHaveLength(2)
    const charizard = assets.find((a) => a.tokenId === MINT)
    expect(charizard).toMatchObject({
      platform: 'solana',
      chain: 'solana',
      contractAddress: 'Pokémon Cards',
      name: 'Charizard',
      metadataUri: 'https://meta.example/4.json',
      imageUri: 'https://img.example/4.png',
      attributes: { Set: 'Base Set' },
    })
    expect(JSON.stringify(charizard?.rawMetadata)).not.toMatch(/price/i)
    // A mint without metadata still counts, named by its mint only.
    expect(assets.find((a) => a.tokenId === otherMint)).toMatchObject({ name: null, contractAddress: otherMint })
  })

  it('is available with nothing configured, and a non-DAS endpoint falls back to the plain RPC', async () => {
    const provider = createSolanaDasProvider({ env: {} })
    expect(provider.availability()).toMatchObject({ available: true })
    expect(provider.availability().reason).toMatch(/public RPC/)
    const methods: string[] = []
    const fetchMock = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as { method: string }
      methods.push(body.method)
      if (body.method === 'getAssetsByOwner') return jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -32601, message: 'Method not found' } })
      return jsonResponse({ jsonrpc: '2.0', id: 1, result: { value: [] } })
    })
    const withPlainRpc = createSolanaDasProvider({ env: { SOLANA_RPC_URL: 'https://plain.example' }, fetch: fetchMock as unknown as typeof fetch })
    const assets = await withPlainRpc.fetchAssets(OWNER, 'solana')
    expect(assets).toEqual([])
    expect(methods[0]).toBe('getAssetsByOwner')
    expect(methods).toContain('getTokenAccountsByOwner')
  })
})

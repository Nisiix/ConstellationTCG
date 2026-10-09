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

  it('is unavailable without an endpoint and refuses to fetch', async () => {
    const provider = createSolanaDasProvider({ env: {} })
    expect(provider.availability()).toMatchObject({ available: false })
    expect(provider.availability().reason).toMatch(/SOLANA_RPC_URL/)
    await expect(
      provider.fetchAssets('11111111111111111111111111111111', 'solana'),
    ).rejects.toThrow(/not configured/)
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
    expect(list.find((p) => p.id === 'solana')?.availability.available).toBe(false)
    expect(list.find((p) => p.id === 'evm')?.chains.map((c) => c.id)).toContain('ethereum')
    expect(() => registry.require('opensea')).toThrow(/Unknown provider/)
  })
})

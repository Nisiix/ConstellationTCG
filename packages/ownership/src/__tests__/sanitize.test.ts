import { describe, expect, it } from 'vitest'
import { isMarketKey, stripMarketData } from '../sanitize'
import { signalsFromAsset } from '../signals'
import type { ProviderAsset } from '../types'

describe('stripMarketData', () => {
  it('removes every market-looking key at any depth and keeps the rest', () => {
    const input = {
      name: 'Charizard #4',
      token: {
        address: '0xabc',
        exchange_rate: '12.3',
        volume_24h: '99',
        holders: 10,
        circulating_market_cap: '1',
      },
      metadata: {
        attributes: [
          { trait_type: 'Set', value: 'Base Set' },
          { trait_type: 'Floor Price', value: 3 },
          { name: 'Artist', value: 'Arita' },
        ],
        last_sale: { usd: 1 },
      },
      price_info: { price_per_token: 1 },
      list: [{ priceUsd: 1, keep: true }],
    }
    const out = stripMarketData(input) as Record<string, unknown>
    expect(out).toEqual({
      name: 'Charizard #4',
      token: { address: '0xabc', holders: 10 },
      metadata: {
        attributes: [
          { trait_type: 'Set', value: 'Base Set' },
          { name: 'Artist', value: 'Arita' },
        ],
      },
      list: [{ keep: true }],
    })
    // The input is not mutated.
    expect(input.token.exchange_rate).toBe('12.3')
  })

  it('knows the usual names', () => {
    for (const key of [
      'price',
      'pricing',
      'exchange_rate',
      'floorPrice',
      'usd_value',
      'market_cap',
      'last_sale',
      'roi',
      'valuation',
      'eur',
    ]) {
      expect(isMarketKey(key), key).toBe(true)
    }
    for (const key of ['name', 'image', 'attributes', 'holders', 'total_supply', 'collection']) {
      expect(isMarketKey(key), key).toBe(false)
    }
  })
})

describe('signalsFromAsset', () => {
  const asset: ProviderAsset = {
    platform: 'evm',
    chain: 'polygon',
    contractAddress: '0xabc',
    tokenId: '42',
    name: 'Charizard #4 - Base Set',
    metadataUri: null,
    imageUri: 'https://img.example/4.png',
    attributes: {
      Set: 'Base Set',
      'Card Number': '4/102',
      Language: 'en',
      Artist: 'Mitsuhiro Arita',
      Finish: 'holo',
      'TCGdex ID': 'base1-4',
      HP: 120,
    },
    rawMetadata: {},
    quantity: 1,
  }

  it('maps trait names loosely and cleans the token name', () => {
    const signals = signalsFromAsset(asset, 'pokemon')
    expect(signals).toMatchObject({
      game: 'pokemon',
      name: 'Charizard',
      set: 'Base Set',
      cardNumber: '4/102',
      language: 'en',
      artist: 'Mitsuhiro Arita',
      finish: 'holo',
      imageUri: 'https://img.example/4.png',
      externalIds: { tcgdex: 'base1-4' },
    })
    expect(signals.platformMetadata).toEqual({
      platform: 'evm',
      chain: 'polygon',
      contractAddress: '0xabc',
      tokenId: '42',
    })
    // Card statistics never become signals.
    expect(JSON.stringify(signals)).not.toContain('120')
  })

  it('copes with nothing but a name', () => {
    const signals = signalsFromAsset({ ...asset, name: 'Pikachu', attributes: {} }, 'pokemon')
    expect(signals.name).toBe('Pikachu')
    expect(signals.externalIds).toBeUndefined()
    expect(signals.set).toBeUndefined()
  })
})

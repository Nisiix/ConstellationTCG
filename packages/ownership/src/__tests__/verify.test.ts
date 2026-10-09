import { ed25519 } from '@noble/curves/ed25519.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { base58 } from '@scure/base'
import { describe, expect, it } from 'vitest'
import { normalizeEvmAddress, normalizeSolanaAddress, shortAddress } from '../address'
import {
  challengeMessage,
  createChallenge,
  evmAddressFromPublicKey,
  signEvmMessage,
  signSolanaMessage,
  verifyEvmSignature,
  verifySignature,
  verifySolanaSignature,
} from '../verify'

const evmKey = secp256k1.utils.randomSecretKey()
const evmAddress = evmAddressFromPublicKey(secp256k1.getPublicKey(evmKey, false))
const solKey = ed25519.utils.randomSecretKey()
const solAddress = base58.encode(ed25519.getPublicKey(solKey))

describe('challenge', () => {
  it('is deterministic from its inputs and carries nonce and expiry', () => {
    const now = new Date('2026-10-09T10:00:00Z')
    const c = createChallenge({ address: evmAddress, chain: 'ethereum', now, nonce: 'abc' })
    expect(c.expiresAt).toBe('2026-10-09T10:10:00.000Z')
    expect(c.message).toContain('Nonce: abc')
    expect(c.message).toContain(`Address: ${evmAddress}`)
    expect(c.message).toBe(
      challengeMessage({
        address: evmAddress,
        chain: 'ethereum',
        nonce: 'abc',
        expiresAt: c.expiresAt,
      }),
    )
    expect(c.message).not.toMatch(/price|transaction fee/i)
  })
})

describe('EVM (EIP-191) signatures', () => {
  it('derives a well-known address from a public key', () => {
    // Private key 1 → the address everybody knows from the secp256k1 generator point.
    const key = new Uint8Array(32)
    key[31] = 1
    expect(evmAddressFromPublicKey(secp256k1.getPublicKey(key, false))).toBe(
      '0x7e5f4552091a69125d5dfcb7b8c2659029395bdf',
    )
  })

  it('round-trips a signature made with the matching key', () => {
    const message = createChallenge({ address: evmAddress, chain: 'ethereum' }).message
    const signature = signEvmMessage(message, evmKey)
    expect(signature).toMatch(/^0x[0-9a-f]{130}$/)
    expect(verifyEvmSignature(message, signature, evmAddress)).toBe(true)
    expect(
      verifyEvmSignature(message, signature, evmAddress.toUpperCase().replace('0X', '0x')),
    ).toBe(true)
    expect(verifySignature('evm', message, signature, evmAddress)).toBe(true)
  })

  it('accepts v as 0/1 as well as 27/28', () => {
    const message = 'hello constellation'
    const signature = signEvmMessage(message, evmKey)
    const v = Number.parseInt(signature.slice(-2), 16) - 27
    const alt = `${signature.slice(0, -2)}${v.toString(16).padStart(2, '0')}`
    expect(verifyEvmSignature(message, alt, evmAddress)).toBe(true)
  })

  it('rejects a tampered message, another address and garbage', () => {
    const message = 'link me'
    const signature = signEvmMessage(message, evmKey)
    expect(verifyEvmSignature('link me!', signature, evmAddress)).toBe(false)
    const other = evmAddressFromPublicKey(
      secp256k1.getPublicKey(secp256k1.utils.randomSecretKey(), false),
    )
    expect(verifyEvmSignature(message, signature, other)).toBe(false)
    expect(() => verifyEvmSignature(message, '0x1234', evmAddress)).toThrow(/Malformed signature/)
    expect(() => verifyEvmSignature(message, signature, 'not-an-address')).toThrow(/EVM address/)
  })
})

describe('Solana (ed25519) signatures', () => {
  it('round-trips base58 and hex signatures', () => {
    const message = createChallenge({ address: solAddress, chain: 'solana' }).message
    const signature = signSolanaMessage(message, solKey)
    expect(verifySolanaSignature(message, signature, solAddress)).toBe(true)
    const hex = Buffer.from(base58.decode(signature)).toString('hex')
    expect(verifySolanaSignature(message, hex, solAddress)).toBe(true)
    expect(verifySignature('solana', message, signature, solAddress)).toBe(true)
  })

  it('rejects a tampered message and another key', () => {
    const message = 'link me'
    const signature = signSolanaMessage(message, solKey)
    expect(verifySolanaSignature('link me?', signature, solAddress)).toBe(false)
    const other = base58.encode(ed25519.getPublicKey(ed25519.utils.randomSecretKey()))
    expect(verifySolanaSignature(message, signature, other)).toBe(false)
  })

  it('has no scheme for declared cards', () => {
    expect(() => verifySignature('manual', 'x', 'y', 'z')).toThrow(/no signature scheme/)
  })
})

describe('addresses', () => {
  it('normalises EVM addresses to lower case and rejects anything else', () => {
    expect(normalizeEvmAddress(' 0xABCDEFabcdef0123456789abcdefABCDEF012345 ')).toBe(
      '0xabcdefabcdef0123456789abcdefabcdef012345',
    )
    expect(() => normalizeEvmAddress('0x123')).toThrow(/EVM address/)
    expect(() => normalizeEvmAddress(solAddress)).toThrow(/EVM address/)
  })

  it('accepts 32-byte base58 Solana keys only', () => {
    expect(normalizeSolanaAddress(` ${solAddress} `)).toBe(solAddress)
    expect(() => normalizeSolanaAddress('0xabc')).toThrow(/Solana address/)
    expect(() => normalizeSolanaAddress(base58.encode(new Uint8Array(20)))).toThrow(/32 bytes/)
  })

  it('shortens long addresses for labels', () => {
    expect(shortAddress(evmAddress)).toMatch(/^0x[0-9a-f]{4}…[0-9a-f]{4}$/)
    expect(shortAddress('short')).toBe('short')
  })
})

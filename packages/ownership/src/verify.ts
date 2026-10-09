/**
 * Proof of control of an address: the person signs a one-time challenge with the wallet; the
 * server recovers / verifies the signature. Signing a message is free and sends no transaction.
 *
 * - EVM: EIP-191 `personal_sign` (keccak-256 of the prefixed message, secp256k1 recovery; the
 *   recovered public key must hash to the address).
 * - Solana: ed25519 over the UTF-8 message; the public key is the address itself.
 */
import { ValidationError } from '@constellation/domain'
import { ed25519 } from '@noble/curves/ed25519.js'
import { secp256k1 } from '@noble/curves/secp256k1.js'
import { keccak_256 } from '@noble/hashes/sha3.js'
import { bytesToHex, hexToBytes, randomBytes, utf8ToBytes } from '@noble/hashes/utils.js'
import { base58 } from '@scure/base'
import { normalizeEvmAddress, normalizeSolanaAddress } from './address'
import type { ProviderKind } from './types'

export const CHALLENGE_TTL_MS = 10 * 60_000

export interface ChallengeInput {
  address: string
  chain: string
  nonce: string
  /** ISO timestamp. */
  expiresAt: string
  appName?: string
}

export interface Challenge {
  nonce: string
  expiresAt: string
  message: string
}

export function newNonce(): string {
  return bytesToHex(randomBytes(16))
}

/** The text the wallet shows and signs. Deterministic from its inputs, so it can be rebuilt server-side. */
export function challengeMessage(input: ChallengeInput): string {
  const app = input.appName ?? 'Constellation TCG'
  return [
    `${app} wants to link this address to your account.`,
    '',
    `Address: ${input.address}`,
    `Chain: ${input.chain}`,
    `Nonce: ${input.nonce}`,
    `Expires: ${input.expiresAt}`,
    '',
    'Signing proves you control the address. It costs nothing and sends no transaction.',
  ].join('\n')
}

export function createChallenge(input: {
  address: string
  chain: string
  now?: Date
  ttlMs?: number
  nonce?: string
  appName?: string
}): Challenge {
  const now = input.now ?? new Date()
  const nonce = input.nonce ?? newNonce()
  const expiresAt = new Date(now.getTime() + (input.ttlMs ?? CHALLENGE_TTL_MS)).toISOString()
  return {
    nonce,
    expiresAt,
    message: challengeMessage({
      address: input.address,
      chain: input.chain,
      nonce,
      expiresAt,
      appName: input.appName,
    }),
  }
}

/** EIP-191 hash of a personal message. */
export function eip191Hash(message: string): Uint8Array {
  const body = utf8ToBytes(message)
  const prefix = utf8ToBytes(`\u0019Ethereum Signed Message:\n${body.length}`)
  const joined = new Uint8Array(prefix.length + body.length)
  joined.set(prefix, 0)
  joined.set(body, prefix.length)
  return keccak_256(joined)
}

/** `0x…` address of an uncompressed (65-byte) or compressed secp256k1 public key. */
export function evmAddressFromPublicKey(publicKey: Uint8Array): string {
  const uncompressed =
    publicKey.length === 65 ? publicKey : secp256k1.Point.fromBytes(publicKey).toBytes(false)
  return `0x${bytesToHex(keccak_256(uncompressed.subarray(1)).subarray(12))}`
}

function signatureBytes(signature: string, expectedLengths: number[]): Uint8Array {
  const trimmed = signature.trim()
  let bytes: Uint8Array | null = null
  if (/^(0x)?[0-9a-fA-F]+$/.test(trimmed) && trimmed.replace(/^0x/, '').length % 2 === 0) {
    try {
      bytes = hexToBytes(trimmed.replace(/^0x/, ''))
    } catch {
      bytes = null
    }
  }
  if (!bytes || !expectedLengths.includes(bytes.length)) {
    try {
      const decoded = base58.decode(trimmed)
      if (expectedLengths.includes(decoded.length)) bytes = decoded
    } catch {
      // not base58
    }
  }
  if (!bytes || !expectedLengths.includes(bytes.length)) {
    throw new ValidationError('Malformed signature', { expectedBytes: expectedLengths })
  }
  return bytes
}

/** True when `signature` (r‖s‖v, hex) over `message` was made by the key behind `address`. */
export function verifyEvmSignature(message: string, signature: string, address: string): boolean {
  const expected = normalizeEvmAddress(address)
  const bytes = signatureBytes(signature, [65])
  let v = bytes[64] ?? 0
  if (v >= 27) v -= 27
  if (v !== 0 && v !== 1) return false
  try {
    const sig = secp256k1.Signature.fromBytes(bytes.subarray(0, 64), 'compact').addRecoveryBit(v)
    const point = sig.recoverPublicKey(eip191Hash(message))
    return evmAddressFromPublicKey(point.toBytes(false)) === expected
  } catch {
    return false
  }
}

/** True when `signature` (64 bytes, base58 or hex) over `message` verifies against the address's key. */
export function verifySolanaSignature(
  message: string,
  signature: string,
  address: string,
): boolean {
  const publicKey = base58.decode(normalizeSolanaAddress(address))
  const bytes = signatureBytes(signature, [64])
  try {
    return ed25519.verify(bytes, utf8ToBytes(message), publicKey)
  } catch {
    return false
  }
}

export function verifySignature(
  kind: ProviderKind,
  message: string,
  signature: string,
  address: string,
): boolean {
  switch (kind) {
    case 'evm':
      return verifyEvmSignature(message, signature, address)
    case 'solana':
      return verifySolanaSignature(message, signature, address)
    default:
      throw new ValidationError(`Provider kind ${kind} has no signature scheme`, { kind })
  }
}

/** Test and tooling helper: sign an EIP-191 message with a raw secp256k1 private key → r‖s‖v hex. */
export function signEvmMessage(message: string, privateKey: Uint8Array): string {
  const sig = secp256k1.sign(eip191Hash(message), privateKey, {
    format: 'recovered',
    prehash: false,
  })
  const recovery = sig[0] ?? 0
  return `0x${bytesToHex(sig.subarray(1))}${(recovery + 27).toString(16).padStart(2, '0')}`
}

/** Test and tooling helper: sign a message with an ed25519 private key → base58 signature. */
export function signSolanaMessage(message: string, privateKey: Uint8Array): string {
  return base58.encode(ed25519.sign(utf8ToBytes(message), privateKey))
}

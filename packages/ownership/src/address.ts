import { ValidationError } from '@constellation/domain'
import { base58 } from '@scure/base'

const EVM_ADDRESS = /^0x[0-9a-fA-F]{40}$/

/** Lower-case hex form of an EVM address (checksum casing is presentation only). */
export function normalizeEvmAddress(address: string): string {
  const trimmed = address.trim()
  if (!EVM_ADDRESS.test(trimmed)) {
    throw new ValidationError('Not an EVM address (expected 0x followed by 40 hex characters)', {
      address: trimmed,
    })
  }
  return trimmed.toLowerCase()
}

/** A Solana public key: base58, 32 bytes. Returned as given (base58 is case sensitive). */
export function normalizeSolanaAddress(address: string): string {
  const trimmed = address.trim()
  let bytes: Uint8Array
  try {
    bytes = base58.decode(trimmed)
  } catch {
    throw new ValidationError('Not a Solana address (expected base58)', { address: trimmed })
  }
  if (bytes.length !== 32) {
    throw new ValidationError('Not a Solana address (expected 32 bytes)', { address: trimmed })
  }
  return trimmed
}

/** `0x1234…abcd` / `3xk2…9fQp` for labels. */
export function shortAddress(address: string): string {
  if (address.length <= 12) return address
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

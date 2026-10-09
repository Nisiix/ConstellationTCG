/**
 * Browser wallets, through the standards they already implement: EIP-1193 (`window.ethereum`,
 * MetaMask, Rabby, Coinbase Wallet, …) and the Phantom-style Solana provider (`window.solana`).
 * Only two things are ever asked of a wallet: its address, and a signature over our challenge.
 * No transaction, no approval, no balance.
 */

interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>
}

interface SolanaProvider {
  isPhantom?: boolean
  publicKey?: { toString(): string } | null
  connect(options?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toString(): string } }>
  signMessage(
    message: Uint8Array,
    display?: 'utf8' | 'hex',
  ): Promise<{ signature: Uint8Array } | Uint8Array>
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
    solana?: SolanaProvider
    phantom?: { solana?: SolanaProvider }
  }
}

export function bytesToHex(bytes: Uint8Array): string {
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

export function utf8ToHex(text: string): string {
  return `0x${bytesToHex(new TextEncoder().encode(text))}`
}

export interface BrowserWallets {
  evm: boolean
  solana: boolean
}

export function browserWallets(): BrowserWallets {
  if (typeof window === 'undefined') return { evm: false, solana: false }
  return { evm: Boolean(window.ethereum), solana: Boolean(solanaProvider()) }
}

function solanaProvider(): SolanaProvider | null {
  if (typeof window === 'undefined') return null
  return window.phantom?.solana ?? window.solana ?? null
}

/** The wallet's active EVM account (asks the person to connect the first time). */
export async function connectEvm(): Promise<string> {
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined
  if (!provider) throw new Error('No EVM wallet found in this browser.')
  const accounts = (await provider.request({ method: 'eth_requestAccounts' })) as string[]
  const address = accounts?.[0]
  if (!address) throw new Error('The wallet returned no account.')
  return address
}

/** `personal_sign` (EIP-191) of the challenge; the signature comes back as r‖s‖v hex. */
export async function signEvm(address: string, message: string): Promise<string> {
  const provider = typeof window !== 'undefined' ? window.ethereum : undefined
  if (!provider) throw new Error('No EVM wallet found in this browser.')
  const signature = (await provider.request({
    method: 'personal_sign',
    params: [utf8ToHex(message), address],
  })) as string
  if (typeof signature !== 'string') throw new Error('The wallet returned no signature.')
  return signature
}

export async function connectSolana(): Promise<string> {
  const provider = solanaProvider()
  if (!provider) throw new Error('No Solana wallet found in this browser.')
  const { publicKey } = await provider.connect()
  return publicKey.toString()
}

/** ed25519 signature of the challenge, hex encoded. */
export async function signSolana(message: string): Promise<string> {
  const provider = solanaProvider()
  if (!provider) throw new Error('No Solana wallet found in this browser.')
  const result = await provider.signMessage(new TextEncoder().encode(message), 'utf8')
  const bytes = result instanceof Uint8Array ? result : result.signature
  return bytesToHex(bytes)
}

/** A human sentence for a wallet error (the person cancelled, the wallet is locked, …). */
export function walletErrorMessage(error: unknown): string {
  const e = error as { code?: unknown; message?: unknown } | null
  if (e && (e.code === 4001 || e.code === 'ACTION_REJECTED'))
    return 'You cancelled the request in the wallet.'
  if (e && e.code === -32002)
    return 'The wallet is already asking for your attention: open it to continue.'
  if (e && typeof e.message === 'string' && e.message) return e.message.replace(/^\w+:\s*/, '')
  return 'The wallet did not answer.'
}

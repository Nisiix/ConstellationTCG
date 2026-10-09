import type {
  Challenge,
  OwnedAsset,
  OwnershipSnapshot,
  ProviderDescriptor,
  SyncSummary,
  WalletRecord,
} from '@constellation/ownership'
import { send } from './api'

export type {
  Challenge,
  OwnedAsset,
  OwnershipSnapshot,
  ProviderDescriptor,
  SyncSummary,
  WalletRecord,
}

export interface AccountUser {
  id: string
  email: string | null
}

export interface AccountResponse {
  configured: boolean
  user: AccountUser | null
  providers: ProviderDescriptor[]
}

export function fetchAccount(signal?: AbortSignal) {
  return send<AccountResponse>('/api/account', { method: 'GET', signal })
}

export function requestMagicLink(email: string, next = '/explore') {
  return send<{ sent: boolean; email: string }>('/api/account/magic-link', {
    body: { email, next },
  })
}

export function signOut() {
  return send<{ ok: boolean }>('/api/account/sign-out')
}

export interface WalletsResponse {
  wallets: WalletRecord[]
  challenges: Record<string, Challenge>
}

export function fetchWallets(signal?: AbortSignal) {
  return send<WalletsResponse>('/api/wallets', { method: 'GET', signal })
}

export interface LinkWalletInput {
  provider: string
  chain: string
  address: string
  label?: string
}

export function linkWallet(input: LinkWalletInput) {
  return send<{ wallet: WalletRecord; challenge: Challenge | null }>('/api/wallets', {
    body: input,
  })
}

export function verifyWallet(walletId: string, signature: string) {
  return send<{ wallet: WalletRecord }>(`/api/wallets/${encodeURIComponent(walletId)}/verify`, {
    body: { signature },
  })
}

export function syncWallet(walletId: string, game: string) {
  return send<{ summary: SyncSummary; wallet: WalletRecord | null }>(
    `/api/wallets/${encodeURIComponent(walletId)}/sync`,
    { body: { game } },
  )
}

export function removeWallet(walletId: string) {
  return send<{ removed: boolean }>(`/api/wallets/${encodeURIComponent(walletId)}`, {
    method: 'DELETE',
  })
}

export function fetchOwnership(signal?: AbortSignal) {
  return send<OwnershipSnapshot & { syncedAt: string }>('/api/ownership', { method: 'GET', signal })
}

export function declareOwned(printing: string, quantity?: number) {
  return send<{ assetId: string; printingId: string }>('/api/ownership/manual', {
    body: { printing, quantity },
  })
}

export function releaseOwned(printing: string) {
  return send<{ removed: boolean }>('/api/ownership/manual', {
    method: 'DELETE',
    body: { printing },
  })
}

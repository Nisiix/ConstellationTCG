'use client'

import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '@/lib/api'
import {
  chooseResolution,
  linkWallet,
  removeWallet,
  requestMagicLink,
  signOut,
  syncWallet,
  verifyWallet,
  type Challenge,
  type OwnedAsset,
  type ProviderDescriptor,
  type SyncSummary,
  type WalletRecord,
} from '@/lib/account-api'
import { useTheme } from '@/lib/theme'
import {
  browserWallets,
  connectEvm,
  connectSolana,
  signEvm,
  signSolana,
  walletErrorMessage,
} from '@/lib/wallet-bridge'
import { useAccountStore } from '@/state/account-store'
import { useCatalogStore } from '@/state/catalog-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'

function shortAddress(address: string): string {
  return address.length <= 14 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`
}

function messageOf(error: unknown, fallback: string): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error && error.message) return error.message
  return fallback
}

/**
 * My Constellation: the account (email link), the linked wallets (proved by a signed message,
 * read through public providers) and the cards declared by hand. Everything here is an overlay on
 * the same graph: owned cards only change color. No price is ever shown.
 */
export function AccountPanel() {
  const open = useUiStore((s) => s.accountOpen)
  const setOpen = useUiStore((s) => s.setAccountOpen)
  const status = useAccountStore((s) => s.status)
  const error = useAccountStore((s) => s.error)
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-void/60 p-4 pt-[6vh] backdrop-blur-sm"
      onMouseDown={() => setOpen(false)}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My Constellation"
        className="panel panel-strong fade-up w-full max-w-2xl p-6"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-1">My Constellation</p>
            <h2 className="serif text-[24px] leading-tight">Your cards, in the sky</h2>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="btn btn-quiet"
            aria-label="Close My Constellation"
          >
            ×
          </button>
        </div>
        {status === 'unknown' ? (
          <p className="text-[14px] text-ink-dim">Checking your account…</p>
        ) : null}
        {status === 'unconfigured' ? <Unconfigured /> : null}
        {status === 'anonymous' ? <SignIn /> : null}
        {status === 'signed-in' ? <SignedIn /> : null}
        {error ? <p className="mt-4 text-[13px] text-rose-500">{error}</p> : null}
        <p className="mt-5 text-[12.5px] text-ink-dim">
          Owned cards glow gold in the sky and in the lists; nothing else changes. Searching and
          exploring never need an account. There are no prices here, and never will be.
        </p>
      </div>
    </div>
  )
}

function Unconfigured() {
  return (
    <div className="space-y-2 text-[14px] text-ink/90">
      <p>Accounts are not set up on this deployment.</p>
      <p className="text-ink-dim">
        To enable them, point the app at a Supabase project: set{' '}
        <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> (see{' '}
        <code>.env.example</code>).
      </p>
    </div>
  )
}

function SignIn() {
  const navigation = useExploreNavigation()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setState('sending')
    setMessage(null)
    try {
      const next =
        typeof window === 'undefined'
          ? '/explore'
          : navigation.shareUrl().replace(window.location.origin, '')
      const res = await requestMagicLink(email.trim(), next || '/explore')
      setState('sent')
      setMessage(res.email)
    } catch (err) {
      setState('error')
      setMessage(messageOf(err, 'The link could not be sent.'))
    }
  }

  if (state === 'sent') {
    return (
      <div className="fade-up space-y-2 text-[14px]">
        <p>
          <strong className="font-semibold">Check your inbox.</strong> A sign-in link is on its way
          to {message}.
        </p>
        <p className="text-ink-dim">
          Open it on this device: it brings you straight back here, signed in. No password to
          remember.
        </p>
      </div>
    )
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-[14px] text-ink/90">
        Sign in with your email to link wallets and keep the cards you own. A link, no password.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="field"
          aria-label="Email address"
          disabled={state === 'sending'}
        />
        <button
          type="submit"
          className="btn btn-primary whitespace-nowrap"
          disabled={state === 'sending' || !email.trim()}
        >
          {state === 'sending' ? 'Sending…' : 'Send me a link'}
        </button>
      </div>
      {state === 'error' && message ? <p className="text-[13px] text-rose-500">{message}</p> : null}
    </form>
  )
}

function SignedIn() {
  const user = useAccountStore((s) => s.user)
  const wallets = useAccountStore((s) => s.wallets)
  const challenges = useAccountStore((s) => s.challenges)
  const providers = useAccountStore((s) => s.providers)
  const assets = useAccountStore((s) => s.assets)
  const counts = useAccountStore((s) => s.counts)
  const stats = useAccountStore((s) => s.stats)
  const setFocusOnOwned = useOwnershipStore((s) => s.setFocusOnOwned)
  const refreshWallets = useAccountStore((s) => s.refreshWallets)
  const refreshOwnership = useAccountStore((s) => s.refreshOwnership)
  const signedOut = useAccountStore((s) => s.signedOut)
  const setOpen = useUiStore((s) => s.setAccountOpen)
  const theme = useTheme()
  const [leaving, setLeaving] = useState(false)

  const leave = async () => {
    setLeaving(true)
    try {
      await signOut()
    } catch {
      // the local state is cleared regardless; cookies expire on their own
    }
    signedOut()
    setLeaving(false)
  }

  const declared = assets.filter((a) => a.platform === 'manual')
  const ambiguous = assets.filter((a) => a.status === 'ambiguous')
  const linkable = providers.filter((p) => p.kind !== 'manual')

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[13.5px]">
        <span className="text-ink-dim">
          Signed in as <span className="text-ink">{user?.email ?? 'you'}</span>
        </span>
        <button
          type="button"
          onClick={leave}
          className="btn btn-quiet text-[12.5px]"
          disabled={leaving}
        >
          {leaving ? 'Signing out…' : 'Sign out'}
        </button>
      </div>

      {/* ── what you own, at a glance ── */}
      <section aria-label="Your cards" className="rounded-xl border border-ink/10 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="serif flex items-center gap-2 text-[17px]">
            <span className="dot" style={{ color: theme.ownership }} aria-hidden />
            Your cards
          </h3>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => refreshOwnership()}
              className="btn btn-quiet text-[12.5px]"
              title="Reload what you own"
            >
              Refresh
            </button>
            {counts && counts.resolved > 0 ? (
              <button
                type="button"
                onClick={() => {
                  setFocusOnOwned(true)
                  setOpen(false)
                }}
                className="btn btn-ghost pill text-[12.5px]"
                title="Back to the sky; your cards are the gold points"
              >
                Show in the sky
              </button>
            ) : null}
          </div>
        </div>
        {counts && counts.total > 0 ? (
          <p className="text-[13.5px] text-ink/90">
            <strong className="font-semibold">{counts.resolved}</strong> card
            {counts.resolved === 1 ? '' : 's'} found in the sky
            {counts.ambiguous > 0 ? <> · {counts.ambiguous} need a closer look</> : null}
            {counts.unresolved > 0 ? <> · {counts.unresolved} not in the catalog</> : null}
          </p>
        ) : (
          <p className="text-[13.5px] text-ink-dim">
            Nothing yet. Link a wallet below, or open a card and press “I own this”.
          </p>
        )}
        {stats && stats.ownedCards > 0 ? (
          <p className="mt-1 text-[12.5px] text-ink-dim">
            {stats.ownedCards} owned card{stats.ownedCards === 1 ? '' : 's'} · {stats.connected}{' '}
            connected point
            {stats.connected === 1 ? '' : 's'} · {stats.constellations} constellation
            {stats.constellations === 1 ? '' : 's'}
          </p>
        ) : null}
        {ambiguous.length > 0 ? (
          <AmbiguousList assets={ambiguous} onChanged={refreshOwnership} />
        ) : null}
        {declared.length > 0 ? <DeclaredList assets={declared} /> : null}
      </section>

      {/* ── wallets ── */}
      <section aria-label="Wallets" className="rounded-xl border border-ink/10 p-4">
        <h3 className="serif mb-2 text-[17px]">Wallets</h3>
        {wallets.length === 0 ? (
          <p className="mb-3 text-[13.5px] text-ink-dim">No wallet linked yet.</p>
        ) : null}
        <ul className="space-y-2">
          {wallets.map((w, i) => (
            <li key={w.id} className="pop-in" style={{ '--i': i } as React.CSSProperties}>
              <WalletRow
                wallet={w}
                challenge={challenges[w.id] ?? null}
                providers={providers}
                onChanged={() => Promise.all([refreshWallets(), refreshOwnership()])}
              />
            </li>
          ))}
        </ul>
        <LinkWalletForm
          providers={linkable}
          onLinked={() => Promise.all([refreshWallets(), refreshOwnership()])}
        />
      </section>
    </div>
  )
}

function statusLabel(wallet: WalletRecord): { text: string; tone: string } {
  if (!wallet.verifiedAt) return { text: 'Signature needed', tone: 'text-amber-500' }
  if (wallet.syncStatus === 'syncing') return { text: 'Syncing…', tone: 'text-ink-dim' }
  if (wallet.syncStatus === 'error') return { text: 'Last sync failed', tone: 'text-rose-500' }
  if (!wallet.lastSyncedAt) return { text: 'Verified · not synced yet', tone: 'text-ink-dim' }
  return {
    text: `${wallet.assetCount} asset${wallet.assetCount === 1 ? '' : 's'} · synced ${new Date(wallet.lastSyncedAt).toLocaleString()}`,
    tone: 'text-ink-dim',
  }
}

function WalletRow({
  wallet,
  challenge,
  providers,
  onChanged,
}: {
  wallet: WalletRecord
  challenge: Challenge | null
  providers: ProviderDescriptor[]
  onChanged: () => Promise<unknown>
}) {
  const game = useCatalogStore((s) => s.game)
  const provider = providers.find((p) => p.id === wallet.provider)
  const chain = provider?.chains.find((c) => c.id === wallet.chain)
  const [busy, setBusy] = useState<'verify' | 'sync' | 'remove' | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [pasting, setPasting] = useState(false)
  const [signature, setSignature] = useState('')
  const [confirmRemove, setConfirmRemove] = useState(false)
  const wallets = browserWallets()
  const canSignHere =
    provider?.kind === 'evm' ? wallets.evm : provider?.kind === 'solana' ? wallets.solana : false
  const label = statusLabel(wallet)

  const verifyWith = async (sig: string) => {
    setBusy('verify')
    setMessage(null)
    try {
      await verifyWallet(wallet.id, sig)
      setPasting(false)
      await onChanged()
    } catch (err) {
      setMessage(messageOf(err, 'The signature was not accepted.'))
    } finally {
      setBusy(null)
    }
  }

  const signHere = async () => {
    if (!challenge || !provider) return
    setBusy('verify')
    setMessage(null)
    try {
      const sig =
        provider.kind === 'evm'
          ? await signEvm(wallet.address, challenge.message)
          : await signSolana(challenge.message)
      await verifyWith(sig)
    } catch (err) {
      setMessage(walletErrorMessage(err))
      setBusy(null)
    }
  }

  const sync = async () => {
    setBusy('sync')
    setMessage(null)
    try {
      const res = await syncWallet(wallet.id, game)
      setMessage(summaryText(res.summary))
      await onChanged()
    } catch (err) {
      setMessage(messageOf(err, 'The sync failed.'))
    } finally {
      setBusy(null)
    }
  }

  const remove = async () => {
    if (!confirmRemove) {
      setConfirmRemove(true)
      setTimeout(() => setConfirmRemove(false), 4000)
      return
    }
    setBusy('remove')
    try {
      await removeWallet(wallet.id)
      await onChanged()
    } catch (err) {
      setMessage(messageOf(err, 'The wallet could not be removed.'))
      setBusy(null)
    }
  }

  return (
    <div className="rounded-lg bg-void/40 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] text-ink" title={wallet.address}>
            {wallet.label ? `${wallet.label} · ` : ''}
            <span className="font-mono text-[13px]">{shortAddress(wallet.address)}</span>
          </p>
          <p className={`truncate text-[12px] ${label.tone}`}>
            {chain?.label ?? wallet.chain}
            {chain?.source ? ` via ${chain.source}` : ''} · {label.text}
          </p>
        </div>
        <div className="flex flex-none items-center gap-1">
          {!wallet.verifiedAt && challenge ? (
            canSignHere ? (
              <button
                type="button"
                onClick={signHere}
                className="btn btn-primary text-[12.5px]"
                disabled={busy !== null}
              >
                {busy === 'verify' ? 'Waiting for the wallet…' : 'Sign to verify'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPasting((p) => !p)}
                className="btn btn-primary text-[12.5px]"
                disabled={busy !== null}
              >
                Verify with a signature
              </button>
            )
          ) : null}
          {wallet.verifiedAt && provider?.availability.available ? (
            <button
              type="button"
              onClick={sync}
              className="btn btn-ghost text-[12.5px]"
              disabled={busy !== null}
              title="Read what this address holds and match it to the catalog"
            >
              {busy === 'sync' ? 'Syncing…' : 'Sync'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={remove}
            className={`btn text-[12.5px] ${confirmRemove ? 'btn-on' : 'btn-quiet'}`}
            disabled={busy !== null}
            title="Unlink this wallet"
          >
            {busy === 'remove' ? '…' : confirmRemove ? 'Sure? Remove' : 'Remove'}
          </button>
        </div>
      </div>
      {!wallet.verifiedAt && challenge && !canSignHere && !pasting ? (
        <p className="mt-1.5 text-[12px] text-ink-dim">
          No browser wallet found for this chain: sign the text with your wallet app and paste the
          signature.
        </p>
      ) : null}
      {pasting && challenge ? (
        <div className="fade-up mt-2 space-y-2">
          <p className="text-[12.5px] text-ink-dim">
            Sign exactly this text with the wallet that owns the address (a free “sign message”, not
            a transaction):
          </p>
          <pre className="scroll-thin max-h-32 overflow-auto rounded-lg bg-void/60 p-2 text-[11.5px] leading-snug text-ink/90">
            {challenge.message}
          </pre>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Paste the signature (hex or base58)"
              className="field font-mono text-[12.5px]"
              aria-label="Signature"
            />
            <button
              type="button"
              onClick={() => verifyWith(signature.trim())}
              className="btn btn-primary whitespace-nowrap text-[12.5px]"
              disabled={busy !== null || !signature.trim()}
            >
              {busy === 'verify' ? 'Checking…' : 'Verify'}
            </button>
          </div>
        </div>
      ) : null}
      {wallet.verifiedAt && provider && !provider.availability.available ? (
        <p className="mt-1.5 text-[12px] text-amber-500">{provider.availability.reason}</p>
      ) : null}
      {wallet.syncStatus === 'error' && wallet.syncError && !message ? (
        <p className="mt-1.5 text-[12px] text-rose-500">{wallet.syncError}</p>
      ) : null}
      {message ? <p className="mt-1.5 text-[12.5px] text-ink/90">{message}</p> : null}
    </div>
  )
}

function summaryText(summary: SyncSummary): string {
  const parts = [
    `${summary.assetsSeen} asset${summary.assetsSeen === 1 ? '' : 's'} read`,
    `${summary.assetsResolved} matched to a card`,
  ]
  if (summary.assetsAmbiguous) parts.push(`${summary.assetsAmbiguous} ambiguous`)
  if (summary.assetsUnresolved) parts.push(`${summary.assetsUnresolved} not in the catalog`)
  if (summary.released) parts.push(`${summary.released} released`)
  return parts.join(' · ')
}

function LinkWalletForm({
  providers,
  onLinked,
}: {
  providers: ProviderDescriptor[]
  onLinked: () => Promise<unknown>
}) {
  const [providerId, setProviderId] = useState(
    () => providers.find((p) => p.availability.available)?.id ?? providers[0]?.id ?? '',
  )
  const provider = providers.find((p) => p.id === providerId) ?? providers[0]
  const [chainId, setChainId] = useState(provider?.chains[0]?.id ?? '')
  const [address, setAddress] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [fromBrowser, setFromBrowser] = useState(false)
  const wallets = browserWallets()
  const canConnect =
    provider?.kind === 'evm' ? wallets.evm : provider?.kind === 'solana' ? wallets.solana : false

  useEffect(() => {
    setChainId(provider?.chains[0]?.id ?? '')
  }, [provider])

  const chains = useMemo(() => provider?.chains ?? [], [provider])

  const connect = async () => {
    if (!provider) return
    setMessage(null)
    try {
      const a = provider.kind === 'evm' ? await connectEvm() : await connectSolana()
      setAddress(a)
      setFromBrowser(true)
    } catch (err) {
      setMessage(walletErrorMessage(err))
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!provider) return
    setBusy(true)
    setMessage(null)
    try {
      const linked = await linkWallet({
        provider: provider.id,
        chain: chainId,
        address: address.trim(),
        label: label.trim() || undefined,
      })
      // The browser wallet that gave us the address can sign right away.
      if (linked.challenge && fromBrowser && canConnect) {
        try {
          const sig =
            provider.kind === 'evm'
              ? await signEvm(linked.wallet.address, linked.challenge.message)
              : await signSolana(linked.challenge.message)
          await verifyWallet(linked.wallet.id, sig)
          setMessage('Wallet linked and verified. Press Sync to read its cards.')
        } catch (err) {
          setMessage(`Linked. ${walletErrorMessage(err)} You can sign later from the list above.`)
        }
      } else {
        setMessage(
          linked.challenge
            ? 'Linked. Now prove it is yours: sign the challenge from the list above.'
            : 'This wallet was already linked and verified.',
        )
      }
      setAddress('')
      setLabel('')
      setFromBrowser(false)
      await onLinked()
    } catch (err) {
      setMessage(messageOf(err, 'The wallet could not be linked.'))
    } finally {
      setBusy(false)
    }
  }

  if (!provider) return null
  return (
    <form onSubmit={submit} className="mt-4 space-y-2.5 border-t border-ink/10 pt-3">
      <h4 className="eyebrow">Link a wallet</h4>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-[12.5px] text-ink-dim">
          Wallet type
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="field mt-1"
            aria-label="Wallet type"
          >
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
                {p.availability.available ? '' : ' (not configured here)'}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-[12.5px] text-ink-dim">
          Network
          <select
            value={chainId}
            onChange={(e) => setChainId(e.target.value)}
            className="field mt-1"
            aria-label="Network"
          >
            {chains.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label} · {c.source}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!provider.availability.available ? (
        <p className="text-[12.5px] text-amber-500">
          {provider.availability.reason} You can still link and verify the address; syncing waits
          for the endpoint.
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={address}
          onChange={(e) => {
            setAddress(e.target.value)
            setFromBrowser(false)
          }}
          placeholder={provider.kind === 'evm' ? '0x…' : 'Public key (base58)'}
          className="field font-mono text-[12.5px]"
          aria-label="Wallet address"
          required
        />
        {canConnect ? (
          <button
            type="button"
            onClick={connect}
            className="btn btn-ghost whitespace-nowrap text-[12.5px]"
            title="Ask the wallet in this browser for its address"
          >
            Use browser wallet
          </button>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Label (optional)"
          className="field"
          aria-label="Label"
          maxLength={80}
        />
        <button
          type="submit"
          className="btn btn-primary whitespace-nowrap"
          disabled={busy || !address.trim()}
        >
          {busy ? 'Linking…' : 'Link wallet'}
        </button>
      </div>
      <p className="text-[12px] text-ink-dim">
        Linking asks the wallet for one signature over a short text. Nothing is sent on chain,
        nothing is spent, nothing is approved.
      </p>
      {message ? <p className="text-[12.5px] text-ink/90">{message}</p> : null}
    </form>
  )
}

/**
 * Assets the resolver could not pin down: the owner picks the right printing. The choice sticks
 * across syncs.
 */
function AmbiguousList({
  assets,
  onChanged,
}: {
  assets: OwnedAsset[]
  onChanged: () => Promise<void>
}) {
  const game = useCatalogStore((s) => s.game)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? assets : assets.slice(0, 4)

  const pick = async (assetId: string, printingId: string) => {
    setBusy(assetId)
    setError(null)
    try {
      await chooseResolution(assetId, printingId, game)
      await onChanged()
    } catch (err) {
      setError(messageOf(err, 'The choice could not be saved.'))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mt-3">
      <h4 className="eyebrow mb-1">Need a closer look · {assets.length}</h4>
      <p className="mb-2 text-[12.5px] text-ink-dim">
        These could be more than one card. Pick the right printing and it joins your constellation.
      </p>
      <ul className="space-y-2">
        {shown.map((a) => (
          <li key={a.assetId} className="rounded-lg bg-void/40 px-3 py-2">
            <p className="truncate text-[13.5px] text-ink" title={a.tokenId ?? ''}>
              {a.name ?? a.tokenId ?? 'Asset'}
              <span className="text-ink-dim"> · {a.chain ?? a.platform}</span>
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {a.candidates.map((c) => (
                <button
                  key={c.printingId}
                  type="button"
                  className="chip text-[12.5px]"
                  disabled={busy !== null}
                  onClick={() => pick(a.assetId, c.printingId)}
                  title={`Confidence ${Math.round(c.confidence * 100)}%`}
                >
                  {c.name}
                  {c.setName ? <span className="text-ink-dim"> · {c.setName}</span> : null}
                  {c.collectorNumber ? (
                    <span className="text-ink-dim"> #{c.collectorNumber}</span>
                  ) : null}
                </button>
              ))}
              {a.candidates.length === 0 ? (
                <span className="text-[12.5px] text-ink-dim">
                  No plausible printing in the catalog yet.
                </span>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      {assets.length > 4 ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="btn btn-quiet mt-1 text-[12.5px]"
        >
          {expanded ? 'Show less' : `+${assets.length - 4} more`}
        </button>
      ) : null}
      {error ? <p className="mt-1 text-[12.5px] text-rose-500">{error}</p> : null}
    </div>
  )
}

function DeclaredList({ assets }: { assets: OwnedAsset[] }) {
  const navigation = useExploreNavigation()
  const setOpen = useUiStore((s) => s.setAccountOpen)
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? assets : assets.slice(0, 6)
  return (
    <div className="mt-3">
      <h4 className="eyebrow mb-1">Declared by you</h4>
      <div className="flex flex-wrap gap-1.5">
        {shown.map((a) => (
          <button
            key={a.assetId}
            type="button"
            className="chip text-[12.5px]"
            onClick={() => {
              if (a.printingNodeId) {
                navigation.goTo(a.printingNodeId)
                setOpen(false)
              }
            }}
            title="Fly to this card"
          >
            {a.printingName ?? a.name ?? 'Card'}
            {a.collectorNumber ? (
              <span className="text-ink-dim"> · {a.collectorNumber}</span>
            ) : null}
          </button>
        ))}
        {assets.length > 6 ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="chip text-[12.5px]"
          >
            {expanded ? 'Show less' : `+${assets.length - 6} more`}
          </button>
        ) : null}
      </div>
    </div>
  )
}

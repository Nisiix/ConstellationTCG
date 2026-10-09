'use client'

import { useState } from 'react'
import type { GraphNode } from '@constellation/domain'
import { ApiError } from '@/lib/api'
import { declareOwned, releaseOwned } from '@/lib/account-api'
import { useTheme } from '@/lib/theme'
import { useAccountStore } from '@/state/account-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useUiStore } from '@/state/ui-store'

/**
 * "I own this card": declares (or un-declares) the printing in focus for the signed-in account.
 * A card already there through a linked wallet is shown as such and cannot be un-declared here.
 * Anonymous visitors see nothing: ownership is an overlay, never a gate.
 */
export function OwnButton({ node, className = '' }: { node: GraphNode; className?: string }) {
  const status = useAccountStore((s) => s.status)
  const assets = useAccountStore((s) => s.assets)
  const refreshOwnership = useAccountStore((s) => s.refreshOwnership)
  const owned = useOwnershipStore((s) => s.ownedNodeIds.has(node.id))
  const setAccountOpen = useUiStore((s) => s.setAccountOpen)
  const theme = useTheme()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (node.nodeType !== 'card_printing') return null
  if (status !== 'signed-in') {
    if (status !== 'anonymous') return null
    return (
      <button
        type="button"
        onClick={() => setAccountOpen(true)}
        className={`btn btn-ghost pill text-[12.5px] ${className}`}
        title="Sign in to mark the cards you own"
      >
        <span className="dot" style={{ color: theme.ownership }} aria-hidden />I own this
      </button>
    )
  }

  const declared = assets.some((a) => a.platform === 'manual' && a.printingNodeId === node.id)
  const fromWallet = owned && !declared

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      if (declared) await releaseOwned(node.id)
      else await declareOwned(node.id)
      await refreshOwnership()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your cards.')
    } finally {
      setBusy(false)
    }
  }

  if (fromWallet) {
    return (
      <span
        className={`btn btn-quiet pill cursor-default text-[12.5px] ${className}`}
        title="This card is in one of your linked wallets"
      >
        <span className="dot" style={{ color: theme.ownership }} aria-hidden />
        In your wallet
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={declared}
        className={`btn pill text-[12.5px] ${declared ? 'btn-on' : 'btn-ghost'}`}
        title={
          declared ? 'Remove from the cards you own' : 'Add to the cards you own (no wallet needed)'
        }
      >
        <span className="dot" style={{ color: theme.ownership }} aria-hidden />
        {busy ? '…' : declared ? 'Yours · remove' : 'I own this'}
      </button>
      {error ? <span className="text-[12px] text-rose-500">{error}</span> : null}
    </span>
  )
}

'use client'

import { useTheme } from '@/lib/theme'
import { useAccountStore } from '@/state/account-store'
import { useCatalogStore } from '@/state/catalog-store'
import { useOwnershipStore } from '@/state/ownership-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'
import { SearchBar } from './SearchBar'
import { ThemeToggle } from './ThemeToggle'

export function TopBar() {
  const navigation = useExploreNavigation()
  const game = useCatalogStore((s) => s.game)
  const games = useCatalogStore((s) => s.games)
  const toggleHelp = useUiStore((s) => s.toggleHelp)
  const accountOpen = useUiStore((s) => s.accountOpen)
  const toggleAccount = useUiStore((s) => s.toggleAccount)
  const accountStatus = useAccountStore((s) => s.status)
  const ownedCount = useAccountStore((s) => s.counts?.resolved ?? 0)
  const connected = useOwnershipStore((s) => s.connected)
  const theme = useTheme()
  const current = games.find((g) => g.slug === game)
  const gameLabel = (current?.name ?? 'Pokémon').replace(' Trading Card Game', '')

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={navigation.goUniverse}
        className="focus-ring pointer-events-auto flex items-center gap-2.5 rounded-xl px-2 py-1 text-left"
        aria-label="Show the whole universe"
        title="Back to the universe (U)"
      >
        <span className="brand-orb" aria-hidden />
        <span className="serif text-[19px] text-ink">Constellation</span>
      </button>

      <div className="pointer-events-auto mx-auto w-full max-w-xl">
        <SearchBar />
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        {games.length > 1 ? (
          <label className="panel pill hidden items-center gap-2 px-3 py-1.5 text-[13px] text-ink-dim md:flex">
            <span className="dot" style={{ color: 'var(--c-primary)' }} aria-hidden />
            <select
              aria-label="Trading card game"
              value={game}
              onChange={(e) => (window.location.href = `/explore?game=${encodeURIComponent(e.target.value)}`)}
              className="bg-transparent text-ink focus:outline-none"
            >
              {games.map((g) => (
                <option key={g.slug} value={g.slug} disabled={!g.available}>
                  {g.name.replace(' Trading Card Game', '')}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="panel pill hidden items-center gap-2 px-3 py-1.5 text-[13px] text-ink-dim md:flex" title="Active game">
            <span className="dot" style={{ color: 'var(--c-primary)' }} aria-hidden />
            {gameLabel}
          </span>
        )}
        <button type="button" onClick={toggleHelp} className="btn btn-ghost pill" aria-label="Help and shortcuts" title="Help (?)">
          ?
        </button>
        <ThemeToggle />
        <button
          type="button"
          onClick={toggleAccount}
          className={`btn pill whitespace-nowrap ${accountOpen ? 'btn-on' : 'btn-ghost'}`}
          title={accountStatus === 'signed-in' ? 'My Constellation: your wallets and the cards you own' : 'My Constellation: sign in to mark the cards you own'}
          aria-expanded={accountOpen}
          aria-haspopup="dialog"
        >
          <span className="dot" style={{ color: theme.ownership }} aria-hidden />
          <span className="hidden md:inline">My Constellation</span>
          {connected && ownedCount > 0 ? <span className="count">{ownedCount}</span> : null}
        </button>
      </div>
    </header>
  )
}

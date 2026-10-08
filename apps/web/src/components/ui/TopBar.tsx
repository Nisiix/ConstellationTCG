'use client'

import { isMac } from '@/lib/env'
import { useCatalogStore } from '@/state/catalog-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'
import { SearchBar } from './SearchBar'

export function TopBar() {
  const navigation = useExploreNavigation()
  const game = useCatalogStore((s) => s.game)
  const games = useCatalogStore((s) => s.games)
  const togglePalette = useUiStore((s) => s.togglePalette)
  const current = games.find((g) => g.slug === game)
  const gameLabel = (current?.name ?? 'Pokémon').replace(' Trading Card Game', '')

  return (
    <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center gap-4 px-4 py-3">
      <button
        type="button"
        onClick={navigation.goUniverse}
        className="focus-ring pointer-events-auto flex items-center gap-2.5 rounded-md px-2 py-1 text-left"
        aria-label="Constellation home — show the universe"
      >
        <span className="brand-orb" aria-hidden />
        <span className="text-[13px] font-semibold tracking-[0.32em] text-ink">CONSTELLATION</span>
      </button>

      <div className="pointer-events-auto mx-auto w-full max-w-xl">
        <SearchBar />
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        {games.length > 1 ? (
          <label className="glass hidden items-center gap-2 rounded-full px-3 py-1 text-xs text-ink-dim md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
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
          <span className="glass hidden items-center gap-2 rounded-full px-3 py-1 text-xs text-ink-dim md:flex" title="Active TCG">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
            {gameLabel}
          </span>
        )}
        <button
          type="button"
          onClick={togglePalette}
          className="glass chip focus-ring hidden rounded-full px-3 py-1 font-mono text-[11px] text-ink-dim hover:text-ink md:block"
          aria-label="Open command palette"
        >
          {isMac() ? '⌘' : 'Ctrl'} K
        </button>
        <button
          type="button"
          className="glass chip focus-ring rounded-full px-3 py-1 text-xs text-ink-dim/70"
          title="My Constellation — connecting digital assets arrives in a later milestone"
          aria-disabled="true"
        >
          ◉ Connect
        </button>
      </div>
    </header>
  )
}

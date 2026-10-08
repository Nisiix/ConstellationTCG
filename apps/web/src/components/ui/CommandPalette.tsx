'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { NodeType } from '@constellation/domain'
import type { SearchHit } from '@constellation/search'
import { fetchSearch } from '@/lib/api'
import { NODE_TYPE_LABELS } from '@/lib/colors'
import { useNodeColor } from '@/lib/theme'
import type { ViewMode } from '@/lib/url'
import { useCatalogStore } from '@/state/catalog-store'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { useExploreNavigation } from '../navigation'

interface Command {
  id: string
  label: string
  hint?: string
  disabled?: boolean
  run: () => void
}

type Scope = { label: string; types: NodeType[] } | null

export function CommandPalette({ view }: { view: ViewMode }) {
  const open = useUiStore((s) => s.paletteOpen)
  const setOpen = useUiStore((s) => s.setPaletteOpen)
  const toggleFilters = useUiStore((s) => s.toggleFilters)
  const navigation = useExploreNavigation()
  const game = useCatalogStore((s) => s.game)
  const colorOf = useNodeColor()
  const depth = useGraphStore((s) => s.depth)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)

  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<Scope>(null)
  const [results, setResults] = useState<SearchHit[]>([])
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setScope(null)
      setResults([])
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => {
    if (!open || !query.trim()) {
      setResults([])
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetchSearch(query, { game, types: scope?.types, limit: 10 }, controller.signal)
        .then((res) => {
          setResults(res.results)
          setActive(0)
        })
        .catch(() => {})
    }, 140)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, scope, game, open])

  const close = () => setOpen(false)

  const commands = useMemo<Command[]>(
    () => [
      { id: 'search', label: 'Search', hint: 'cards, sets, Pokémon, artists', run: () => setScope(null) },
      { id: 'go-set', label: 'Go to set…', run: () => setScope({ label: 'Set', types: ['set'] }) },
      {
        id: 'go-card',
        label: 'Go to card…',
        run: () => setScope({ label: 'Card', types: ['card_identity', 'card_printing'] }),
      },
      { id: 'go-artist', label: 'Go to artist…', run: () => setScope({ label: 'Artist', types: ['artist'] }) },
      {
        id: 'expand',
        label: 'Expand relationships',
        hint: `depth ${Math.min(3, depth + 1)} · E`,
        disabled: !focusNodeId || depth >= 3,
        run: () => {
          navigation.expand()
          close()
        },
      },
      {
        id: 'collapse',
        label: 'Collapse',
        hint: 'depth 1 · C',
        disabled: !focusNodeId || depth <= 1,
        run: () => {
          navigation.collapse()
          close()
        },
      },
      {
        id: 'reset',
        label: 'Reset view',
        hint: 'universe · U',
        run: () => {
          navigation.goUniverse()
          close()
        },
      },
      {
        id: 'filters',
        label: 'Toggle filters',
        hint: 'F',
        run: () => {
          toggleFilters()
          close()
        },
      },
      {
        id: 'view',
        label: view === 'list' ? 'Switch to 3D view' : 'Switch to list view',
        hint: 'L',
        run: () => {
          navigation.setView(view === 'list' ? '3d' : 'list')
          close()
        },
      },
      { id: 'mine', label: 'My Constellation', hint: 'coming soon', disabled: true, run: () => {} },
      { id: 'connect', label: 'Connect wallet', hint: 'coming soon', disabled: true, run: () => {} },
    ],
    [depth, focusNodeId, navigation, toggleFilters, view],
  )

  const filteredCommands = useMemo(() => {
    if (scope) return []
    const q = query.trim().toLowerCase()
    if (!q) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(q))
  }, [commands, query, scope])

  const items: Array<{ kind: 'command'; command: Command } | { kind: 'hit'; hit: SearchHit }> = [
    ...results.map((hit) => ({ kind: 'hit' as const, hit })),
    ...filteredCommands.map((command) => ({ kind: 'command' as const, command })),
  ]

  const run = (index: number) => {
    const item = items[index]
    if (!item) return
    if (item.kind === 'hit') {
      close()
      navigation.goTo(item.hit.nodeId)
    } else if (!item.command.disabled) {
      item.command.run()
      if (item.command.id.startsWith('go-') || item.command.id === 'search') {
        setQuery('')
        inputRef.current?.focus()
      }
    }
  }

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((a) => (items.length ? (a + 1) % items.length : 0))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((a) => (items.length ? (a - 1 + items.length) % items.length : 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      run(active)
    } else if (event.key === 'Backspace' && !query && scope) {
      setScope(null)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-void/60 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={close}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="glass glass-strong fade-up w-full max-w-xl overflow-hidden rounded-2xl"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-ink-dim/15 px-4 py-3">
          {scope ? (
            <span className="rounded-full border border-primary/50 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-primary">
              {scope.label}
            </span>
          ) : (
            <span className="text-ink-dim" aria-hidden>
              ⌘
            </span>
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={scope ? `Search ${scope.label.toLowerCase()}s…` : 'Type a command or search…'}
            aria-label="Command or search"
            className="w-full bg-transparent text-sm text-ink placeholder:text-ink-dim/70 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded border border-ink-dim/30 px-1.5 font-mono text-[10px] text-ink-dim">esc</kbd>
        </div>
        <ul role="listbox" className="scroll-thin max-h-[52vh] overflow-y-auto p-1" aria-label="Results">
          {items.length === 0 ? <li className="px-3 py-6 text-center text-sm text-ink-dim">No matches</li> : null}
          {items.map((item, index) => {
            const isActive = index === active
            if (item.kind === 'hit') {
              return (
                <li
                  key={`hit-${item.hit.nodeId}`}
                  role="option"
                  aria-selected={isActive}
                  style={{ '--i': index } as React.CSSProperties}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(index)}
                  className={`pop-in lift flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                    isActive ? 'bg-primary/15 text-ink' : 'text-ink/85'
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: colorOf(item.hit.type), boxShadow: '0 0 0 1px var(--c-outline)' }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {item.hit.title}
                    {item.hit.subtitle ? <span className="ml-2 text-xs text-ink-dim">{item.hit.subtitle}</span> : null}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.18em]" style={{ color: colorOf(item.hit.type) }}>
                    {NODE_TYPE_LABELS[item.hit.type]}
                  </span>
                </li>
              )
            }
            return (
              <li
                key={`cmd-${item.command.id}`}
                role="option"
                aria-selected={isActive}
                aria-disabled={item.command.disabled}
                style={{ '--i': index } as React.CSSProperties}
                onMouseEnter={() => setActive(index)}
                onClick={() => run(index)}
                className={`pop-in lift flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm ${
                  item.command.disabled ? 'opacity-40' : ''
                } ${isActive ? 'bg-primary/15 text-ink' : 'text-ink/85'}`}
              >
                <span>{item.command.label}</span>
                {item.command.hint ? <span className="font-mono text-[11px] text-ink-dim">{item.command.hint}</span> : null}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

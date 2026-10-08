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
  const setHelpOpen = useUiStore((s) => s.setHelpOpen)
  const navigation = useExploreNavigation()
  const game = useCatalogStore((s) => s.game)
  const colorOf = useNodeColor()
  const depth = useGraphStore((s) => s.depth)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const isUniverse = useGraphStore((s) => s.isUniverse)

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
  const canExpand = Boolean(focusNodeId) && !isUniverse

  const commands = useMemo<Command[]>(
    () => [
      { id: 'go-card', label: 'Go to a card…', run: () => setScope({ label: 'Cards', types: ['card_identity', 'card_printing'] }) },
      { id: 'go-set', label: 'Go to a set…', run: () => setScope({ label: 'Sets', types: ['set'] }) },
      { id: 'go-artist', label: 'Go to an artist…', run: () => setScope({ label: 'Artists', types: ['artist'] }) },
      {
        id: 'expand',
        label: 'Show more connections',
        hint: depth >= 3 ? 'at maximum' : `${depth === 1 ? 'extended' : 'deep'} · E`,
        disabled: !canExpand || depth >= 3,
        run: () => {
          navigation.expand()
          close()
        },
      },
      {
        id: 'collapse',
        label: 'Show direct connections only',
        hint: 'C',
        disabled: !canExpand || depth <= 1,
        run: () => {
          navigation.collapse()
          close()
        },
      },
      {
        id: 'reset',
        label: 'Back to the universe',
        hint: 'U',
        run: () => {
          navigation.goUniverse()
          close()
        },
      },
      {
        id: 'filters',
        label: 'Open filters',
        hint: 'F',
        run: () => {
          toggleFilters()
          close()
        },
      },
      {
        id: 'view',
        label: view === 'list' ? 'Switch to the 3D view' : 'Switch to the list view',
        hint: 'L',
        run: () => {
          navigation.setView(view === 'list' ? '3d' : 'list')
          close()
        },
      },
      {
        id: 'help',
        label: 'Help and keyboard shortcuts',
        hint: '?',
        run: () => {
          close()
          setHelpOpen(true)
        },
      },
      { id: 'mine', label: 'My Constellation', hint: 'coming soon', disabled: true, run: () => {} },
    ],
    [canExpand, depth, navigation, setHelpOpen, toggleFilters, view],
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
      if (item.command.id.startsWith('go-')) {
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
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-void/60 p-4 pt-[12vh] backdrop-blur-sm" onMouseDown={close} role="presentation">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command menu"
        className="panel panel-strong fade-up w-full max-w-xl overflow-hidden"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-ink/10 px-4 py-3">
          {scope ? (
            <button type="button" className="chip chip-on" onClick={() => setScope(null)} title="Back to all commands">
              {scope.label} ×
            </button>
          ) : null}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={scope ? `Search ${scope.label.toLowerCase()}…` : 'Search anything, or type a command…'}
            aria-label="Command or search"
            className="w-full bg-transparent text-[14.5px] text-ink placeholder:text-ink-dim/80 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd>esc</kbd>
        </div>
        <ul role="listbox" className="scroll-thin max-h-[52vh] overflow-y-auto p-1.5" aria-label="Results">
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
                  className={`row-link pop-in cursor-pointer ${isActive ? 'bg-primary/15' : ''}`}
                >
                  <span className="dot" style={{ background: colorOf(item.hit.type) }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate">
                    {item.hit.title}
                    {item.hit.subtitle ? <span className="ml-2 text-[12.5px] text-ink-dim">{item.hit.subtitle}</span> : null}
                  </span>
                  <span className="text-[12px]" style={{ color: colorOf(item.hit.type) }}>
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
                className={`row-link pop-in cursor-pointer justify-between ${item.command.disabled ? 'opacity-45' : ''} ${isActive ? 'bg-primary/15' : ''}`}
              >
                <span>{item.command.label}</span>
                {item.command.hint ? <span className="text-[12px] text-ink-dim">{item.command.hint}</span> : null}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

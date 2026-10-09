'use client'

import { useEffect, useMemo } from 'react'
import { ApiError, fetchFilters, fetchFocus, fetchGames, fetchUniverse, prefetchFocus } from '@/lib/api'
import { connectionNodeTypes } from '@/lib/connections'
import { detectWebGL, prefersReducedMotion } from '@/lib/env'
import { applyThemeToDocument, clearThemeFromDocument } from '@/lib/theme'
import { filtersKey } from '@/lib/url'
import { useAccountStore } from '@/state/account-store'
import { useCameraStore } from '@/state/camera-store'
import { useCatalogStore } from '@/state/catalog-store'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { RelationshipList } from './fallback/RelationshipList'
import { setNavigator, useExploreNavigation } from './navigation'
import { ConstellationCanvas } from './three/ConstellationCanvas'
import { AccountPanel } from './ui/AccountPanel'
import { ErrorState } from './ui/ErrorState'
import { FilterPanel } from './ui/FilterPanel'
import { FocusPanel } from './ui/FocusPanel'
import { GraphHUD } from './ui/GraphHUD'
import { HelpOverlay } from './ui/HelpOverlay'
import { LoadingState } from './ui/LoadingState'
import { NodeTooltip } from './ui/NodeTooltip'
import { TopBar } from './ui/TopBar'
import { WelcomeCard } from './ui/WelcomeCard'

export function Explorer() {
  const navigation = useExploreNavigation()
  const { node, depth, view, game, filters } = navigation.current
  const filterKey = filtersKey(filters)

  const status = useGraphStore((s) => s.status)
  const error = useGraphStore((s) => s.error)
  const revision = useGraphStore((s) => s.revision)
  const focusNodeId = useGraphStore((s) => s.focusNodeId)
  const graphNodes = useGraphStore((s) => s.nodes)
  const graphEdges = useGraphStore((s) => s.edges)
  const setLoading = useGraphStore((s) => s.setLoading)
  const setError = useGraphStore((s) => s.setError)
  const setNeighborhood = useGraphStore((s) => s.setNeighborhood)

  const webgl = useUiStore((s) => s.webgl)
  const uiView = useUiStore((s) => s.view)
  const setCapabilities = useUiStore((s) => s.setCapabilities)
  const hoveredNodeId = useUiStore((s) => s.hoveredNodeId)
  const setHighlight = useUiStore((s) => s.setHighlight)
  const toggleFilters = useUiStore((s) => s.toggleFilters)
  const setFiltersOpen = useUiStore((s) => s.setFiltersOpen)
  const toggleHelp = useUiStore((s) => s.toggleHelp)
  const setHelpOpen = useUiStore((s) => s.setHelpOpen)
  const setAccountOpen = useUiStore((s) => s.setAccountOpen)
  const notice = useUiStore((s) => s.notice)
  const setNotice = useUiStore((s) => s.setNotice)
  const refreshAccount = useAccountStore((s) => s.refreshAccount)
  const setHovered = useUiStore((s) => s.setHovered)

  const setGame = useCatalogStore((s) => s.setGame)
  const setGames = useCatalogStore((s) => s.setGames)
  const theme = useCatalogStore((s) => s.resolved)
  const setFilters = useCatalogStore((s) => s.setFilters)
  const setFiltersStatus = useCatalogStore((s) => s.setFiltersStatus)
  const setSelection = useCatalogStore((s) => s.setSelection)

  const flyTo = useCameraStore((s) => s.flyTo)
  const cameraMode = useCameraStore((s) => s.mode)

  // Wire the router into the module-level navigator used by canvas components.
  useEffect(() => {
    setNavigator(navigation.goTo)
    return () => setNavigator(null)
  }, [navigation.goTo])

  // Capabilities (WebGL, reduced motion) — client only.
  useEffect(() => {
    setCapabilities({ reducedMotion: prefersReducedMotion(), webgl: detectWebGL(), narrow: window.matchMedia('(max-width: 767px)').matches })
  }, [setCapabilities])

  // Who is signed in and what they own (an overlay: the graph loads regardless). Coming back
  // from a sign-in link (`?account=…`) opens My Constellation once; the marker leaves the URL.
  useEffect(() => {
    refreshAccount()
    const url = new URL(window.location.href)
    const marker = url.searchParams.get('account')
    const missing = url.searchParams.get('missing')
    if (marker) setAccountOpen(true)
    // A readable address that named nothing: say so once, then show the universe.
    if (missing) setNotice(`Nothing answers to “${missing}” in this catalog, so here is the whole universe.`)
    if (marker || missing) {
      url.searchParams.delete('account')
      url.searchParams.delete('missing')
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }, [refreshAccount, setAccountOpen, setNotice])

  // Notices fade out on their own.
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 9000)
    return () => clearTimeout(timer)
  }, [notice, setNotice])

  // Games and their themes.
  useEffect(() => {
    const controller = new AbortController()
    fetchGames(controller.signal)
      .then((res) => setGames(res.games))
      .catch(() => {})
    return () => controller.abort()
  }, [setGames])

  // The palette follows the selected game (and the mode) while the explorer is on screen; the
  // platform palette from the stylesheet returns when it leaves.
  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])
  useEffect(() => () => clearThemeFromDocument(), [])

  // Filter definitions per game.
  useEffect(() => {
    const controller = new AbortController()
    setGame(game)
    setFiltersStatus('loading')
    fetchFilters(game, controller.signal)
      .then((res) => setFilters(res.filters))
      .catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') setFiltersStatus('error')
      })
    return () => controller.abort()
  }, [game, setFilters, setFiltersStatus, setGame])

  // Selection mirrors the URL.
  useEffect(() => {
    setSelection(filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterKey, setSelection])

  // Neighborhood or universe.
  useEffect(() => {
    const controller = new AbortController()
    setLoading()
    const request = node
      ? fetchFocus(node, { depth, filters, nodeTypes: connectionNodeTypes(filters) }, controller.signal).then((res) =>
          setNeighborhood(res, { summary: res.summary, filtered: res.filtered }),
        )
      : fetchUniverse(game, controller.signal).then((res) => setNeighborhood(res, { isUniverse: true }))
    request.catch((err: unknown) => {
      if ((err as Error).name === 'AbortError') return
      const message = err instanceof ApiError ? err.message : 'Could not load the constellation.'
      setError(message)
    })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, depth, game, filterKey, setLoading, setError, setNeighborhood])

  // Every new neighborhood triggers a camera flight to its focus.
  useEffect(() => {
    if (revision === 0 || !focusNodeId) return
    flyTo(focusNodeId, cameraMode === 'follow' ? 'follow' : 'focus')
    setHighlight(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision])

  // Preloading: once a neighborhood is on screen, warm the neighborhoods of its strongest direct
  // connections, so following one of them is instant. The focus flight hides the delay.
  useEffect(() => {
    if (status !== 'ready' || !focusNodeId) return
    const timer = setTimeout(() => {
      const { edges } = useGraphStore.getState()
      const best = new Map<string, number>()
      for (const e of edges) {
        const other = e.sourceNodeId === focusNodeId ? e.targetNodeId : e.targetNodeId === focusNodeId ? e.sourceNodeId : null
        if (other) best.set(other, Math.max(best.get(other) ?? 0, e.weight))
      }
      const ids = [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)
      for (const [id] of ids) prefetchFocus(id, { depth: 1, filters, nodeTypes: connectionNodeTypes(filters) })
    }, 450)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, revision, filterKey])

  // Whatever is under the pointer for a moment is probably the next focus: preload it.
  useEffect(() => {
    if (!hoveredNodeId || hoveredNodeId === focusNodeId) return
    const timer = setTimeout(() => prefetchFocus(hoveredNodeId, { depth: 1, filters, nodeTypes: connectionNodeTypes(filters) }), 120)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hoveredNodeId, filterKey])

  const effectiveView = useMemo(() => {
    if (webgl === false) return 'list'
    return view ?? uiView
  }, [view, uiView, webgl])

  // The sky from the keyboard: arrows walk the focus's direct connections (strongest first), Enter
  // flies to the one in hand. The same hover state the pointer uses, so the point lights up and the
  // live region below names it for screen readers.
  const neighborIds = useMemo(() => {
    if (!focusNodeId) return [] as string[]
    const best = new Map<string, number>()
    for (const e of graphEdges) {
      const other = e.sourceNodeId === focusNodeId ? e.targetNodeId : e.targetNodeId === focusNodeId ? e.sourceNodeId : null
      if (other) best.set(other, Math.max(best.get(other) ?? 0, e.weight))
    }
    const labels = new Map(graphNodes.map((n) => [n.id, n.label]))
    return [...best.entries()]
      .sort((a, b) => b[1] - a[1] || (labels.get(a[0]) ?? '').localeCompare(labels.get(b[0]) ?? ''))
      .map(([id]) => id)
  }, [focusNodeId, graphEdges, graphNodes])
  const hoveredLabel = useMemo(() => {
    const node = hoveredNodeId ? graphNodes.find((n) => n.id === hoveredNodeId) : undefined
    return node ? `${node.label}${node.subtitle ? `, ${node.subtitle}` : ''}` : ''
  }, [hoveredNodeId, graphNodes])

  // Keyboard shortcuts.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)
      if (event.key === 'Escape') {
        setFiltersOpen(false)
        setHelpOpen(false)
        setAccountOpen(false)
        setHovered(null)
        setHighlight(null)
        return
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return
      const arrow = event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'ArrowDown' || event.key === 'ArrowUp'
      if (arrow && neighborIds.length > 0) {
        event.preventDefault()
        const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
        const index = hoveredNodeId ? neighborIds.indexOf(hoveredNodeId) : -1
        const next = index < 0 ? (forward ? 0 : neighborIds.length - 1) : (index + (forward ? 1 : -1) + neighborIds.length) % neighborIds.length
        const id = neighborIds[next]
        if (id) setHovered(id, { x: window.innerWidth / 2, y: 72 })
        return
      }
      if (event.key === 'Enter' && hoveredNodeId && hoveredNodeId !== focusNodeId) {
        event.preventDefault()
        navigation.goTo(hoveredNodeId, { follow: true })
        setHovered(null)
        return
      }
      if (event.key === '?') {
        event.preventDefault()
        toggleHelp()
        return
      }
      switch (event.key.toLowerCase()) {
        case 'f':
          event.preventDefault()
          toggleFilters()
          break
        case 'l':
          event.preventDefault()
          navigation.setView(effectiveView === 'list' ? '3d' : 'list')
          break
        case 'e':
          navigation.expand()
          break
        case 'c':
          navigation.collapse()
          break
        case 'u':
          navigation.goUniverse()
          break
        case 'backspace':
          navigation.back()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const listMode = effectiveView === 'list'

  return (
    <div id="main" className="explorer-shell relative w-full bg-void" data-theme={theme.id} data-mode={theme.mode}>
      {!listMode && webgl ? <ConstellationCanvas /> : null}
      {listMode ? <RelationshipList /> : null}
      <TopBar />
      <FilterPanel />
      {!listMode ? <FocusPanel /> : null}
      {!listMode ? <WelcomeCard /> : null}
      <GraphHUD view={effectiveView} />
      {!listMode ? <NodeTooltip /> : null}
      <HelpOverlay />
      <AccountPanel />
      <p className="sr-only" aria-live="polite">
        {hoveredLabel}
      </p>
      {notice ? (
        <div role="status" className="panel fade-up absolute left-1/2 top-16 z-40 flex max-w-md -translate-x-1/2 items-center gap-3 px-4 py-2 text-[13px] text-ink">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="btn btn-quiet" aria-label="Dismiss">
            ×
          </button>
        </div>
      ) : null}
      {status === 'loading' ? <LoadingState overlay label="Charting connections" /> : null}
      {status === 'error' ? <ErrorState message={error ?? 'Something went wrong'} /> : null}
    </div>
  )
}

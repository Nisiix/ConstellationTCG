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
    setCapabilities({ reducedMotion: prefersReducedMotion(), webgl: detectWebGL() })
  }, [setCapabilities])

  // Who is signed in and what they own (an overlay: the graph loads regardless). Coming back
  // from a sign-in link (`?account=…`) opens My Constellation once; the marker leaves the URL.
  useEffect(() => {
    refreshAccount()
    const url = new URL(window.location.href)
    const marker = url.searchParams.get('account')
    if (marker) {
      setAccountOpen(true)
      url.searchParams.delete('account')
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }, [refreshAccount, setAccountOpen])

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
      {status === 'loading' ? <LoadingState overlay label="Charting connections" /> : null}
      {status === 'error' ? <ErrorState message={error ?? 'Something went wrong'} /> : null}
    </div>
  )
}

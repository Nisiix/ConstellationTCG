'use client'

import { useEffect, useMemo } from 'react'
import { ApiError, fetchFilters, fetchFocus, fetchGames, fetchUniverse } from '@/lib/api'
import { detectWebGL, prefersReducedMotion } from '@/lib/env'
import { applyThemeToDocument } from '@/lib/theme'
import { filtersKey } from '@/lib/url'
import { useCameraStore } from '@/state/camera-store'
import { useCatalogStore } from '@/state/catalog-store'
import { useGraphStore } from '@/state/graph-store'
import { useUiStore } from '@/state/ui-store'
import { RelationshipList } from './fallback/RelationshipList'
import { setNavigator, useExploreNavigation } from './navigation'
import { ConstellationCanvas } from './three/ConstellationCanvas'
import { CommandPalette } from './ui/CommandPalette'
import { ErrorState } from './ui/ErrorState'
import { FilterPanel } from './ui/FilterPanel'
import { FocusPanel } from './ui/FocusPanel'
import { GraphHUD } from './ui/GraphHUD'
import { LoadingState } from './ui/LoadingState'
import { NodeTooltip } from './ui/NodeTooltip'
import { TopBar } from './ui/TopBar'

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
  const togglePalette = useUiStore((s) => s.togglePalette)
  const setPaletteOpen = useUiStore((s) => s.setPaletteOpen)
  const toggleFilters = useUiStore((s) => s.toggleFilters)
  const setFiltersOpen = useUiStore((s) => s.setFiltersOpen)
  const setHovered = useUiStore((s) => s.setHovered)

  const setGame = useCatalogStore((s) => s.setGame)
  const setGames = useCatalogStore((s) => s.setGames)
  const theme = useCatalogStore((s) => s.theme)
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

  // Games and their themes.
  useEffect(() => {
    const controller = new AbortController()
    fetchGames(controller.signal)
      .then((res) => setGames(res.games))
      .catch(() => {})
    return () => controller.abort()
  }, [setGames])

  // The palette follows the selected game.
  useEffect(() => {
    applyThemeToDocument(theme)
  }, [theme])

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
      ? fetchFocus(node, { depth, filters }, controller.signal).then((res) =>
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision])

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
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        togglePalette()
        return
      }
      if (event.key === 'Escape') {
        setPaletteOpen(false)
        setFiltersOpen(false)
        setHovered(null)
        return
      }
      if (typing || event.metaKey || event.ctrlKey || event.altKey) return
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

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-void" data-theme={theme.id}>
      {effectiveView === '3d' && webgl ? <ConstellationCanvas /> : null}
      {effectiveView === 'list' ? <RelationshipList /> : null}
      <TopBar />
      <FilterPanel />
      <FocusPanel />
      <GraphHUD view={effectiveView} />
      <NodeTooltip />
      <CommandPalette view={effectiveView} />
      {status === 'loading' ? <LoadingState overlay label="Charting relationships" /> : null}
      {status === 'error' ? <ErrorState message={error ?? 'Something went wrong'} /> : null}
    </div>
  )
}

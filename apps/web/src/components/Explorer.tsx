'use client'

import { useEffect, useMemo } from 'react'
import { ApiError, fetchFilters, fetchFocus, fetchGames, fetchLandmarks, fetchLineage, fetchPath, fetchUniverse, prefetchFocus } from '@/lib/api'
import { connectionNodeTypes } from '@/lib/connections'
import { detectWebGL, prefersReducedMotion } from '@/lib/env'
import { applyThemeToDocument, clearThemeFromDocument } from '@/lib/theme'
import { landmarksLayout, landmarksNeighborhood } from '@/lib/landmarks-view'
import { lineageLayout, lineageNeighborhood } from '@/lib/lineage-view'
import { neighbours, pathNeighborhood } from '@/lib/path-steps'
import { nextStep, timeSteps, visibilityAt, yearsOf } from '@/lib/time'
import { filtersKey } from '@/lib/url'
import { useAccountStore } from '@/state/account-store'
import { useCameraStore } from '@/state/camera-store'
import { useCatalogStore } from '@/state/catalog-store'
import { useGraphStore } from '@/state/graph-store'
import { useLensStore } from '@/state/lens-store'
import { usePathStore } from '@/state/path-store'
import { useThreadStore } from '@/state/thread-store'
import { useTimeStore } from '@/state/time-store'
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
import { LandmarksPage, LandmarksPanel } from './ui/LandmarksView'
import { hasLineage, LineagePage, LineagePanel } from './ui/LineageView'
import { LoadingState } from './ui/LoadingState'
import { NodeTooltip } from './ui/NodeTooltip'
import { PathPanel } from './ui/PathPanel'
import { ThreadPanel } from './ui/ThreadPanel'
import { TimeBar } from './ui/TimeBar'
import { TopBar } from './ui/TopBar'
import { WelcomeCard } from './ui/WelcomeCard'

export function Explorer() {
  const navigation = useExploreNavigation()
  const { node, depth, view, game, filters, path, pathMax, year, lens } = navigation.current
  const filterKey = filtersKey(filters)
  const pathKey = path ? `${path[0]},${path[1]},${pathMax ?? ''}` : null

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

  const pathData = usePathStore((s) => s.data)
  const setPathLoading = usePathStore((s) => s.setLoading)
  const setPath = usePathStore((s) => s.setPath)
  const setPathError = usePathStore((s) => s.setError)
  const resetPath = usePathStore((s) => s.reset)
  const hydrateThread = useThreadStore((s) => s.hydrate)
  const recordThread = useThreadStore((s) => s.record)
  const pathFound = pathData?.found && pathKey ? pathData : null
  const setLineage = useLensStore((s) => s.setLineage)
  const setLandmarks = useLensStore((s) => s.setLandmarks)
  const lineage = useLensStore((s) => s.lineage)
  const graphLens = useGraphStore((s) => s.lens)
  const playing = useTimeStore((s) => s.playing)
  const steps = useTimeStore((s) => s.steps)
  const setTime = useTimeStore((s) => s.setTime)
  const setPlaying = useTimeStore((s) => s.setPlaying)

  // Wire the router into the module-level navigator used by canvas components. On a path, clicking
  // one of its points walks to that step instead of leaving the path.
  useEffect(() => {
    setNavigator((nodeId, options) => {
      if (pathFound?.nodes.some((n) => n.id === nodeId)) navigation.goTo(nodeId, { ...options, keepPath: true, replace: true })
      // In a genealogy, the other members of the line open their own; anything else is explored.
      else if (lens === 'lineage' && lineage?.family.some((m) => m.node.id === nodeId)) navigation.openLineage(nodeId)
      else navigation.goTo(nodeId, options)
    })
    return () => setNavigator(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation.goTo, pathFound, lens, lineage])

  // The thread kept for this tab.
  useEffect(() => {
    hydrateThread()
  }, [hydrateThread])

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

  // Neighborhood, universe or path.
  useEffect(() => {
    const controller = new AbortController()
    setLoading()
    const focusRequest = (id: string) =>
      fetchFocus(id, { depth, filters, nodeTypes: connectionNodeTypes(filters) }, controller.signal).then((res) =>
        setNeighborhood(res, { summary: res.summary, filtered: res.filtered }),
      )
    let request: Promise<unknown>
    if (lens === 'lineage' && node) {
      resetPath()
      setLineage(null)
      request = fetchLineage(node, controller.signal).then((res) => {
        setLineage(res)
        const hood = lineageNeighborhood(res)
        setNeighborhood(hood, { positions: lineageLayout(res, hood), lens: 'lineage' })
      })
    } else if (lens === 'landmarks') {
      resetPath()
      request = fetchLandmarks(game, controller.signal).then((res) => {
        setLandmarks(res)
        setNeighborhood(landmarksNeighborhood(res), { positions: landmarksLayout(res), lens: 'landmarks' })
      })
    } else if (path && pathKey) {
      // The sky shows the whole path around the step in hand; no path: the first end, and the
      // panel says so and offers to search further.
      setPathLoading(pathKey)
      request = fetchPath(path[0], path[1], pathMax, controller.signal).then((res) => {
        setPath(pathKey, res)
        if (res.found) setNeighborhood(pathNeighborhood(res, node ?? path[0]))
        else return focusRequest(node ?? path[0])
      })
      request.catch((err: unknown) => {
        if ((err as Error).name !== 'AbortError') setPathError(pathKey, err instanceof ApiError ? err.message : 'Could not find a path.')
      })
    } else {
      resetPath()
      request = node ? focusRequest(node) : fetchUniverse(game, controller.signal).then((res) => setNeighborhood(res, { isUniverse: true }))
    }
    request.catch((err: unknown) => {
      if ((err as Error).name === 'AbortError') return
      const message = err instanceof ApiError ? err.message : 'Could not load the constellation.'
      setError(message)
    })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, depth, game, filterKey, pathKey, lens, setLoading, setError, setNeighborhood])

  // Every new focus is a step of the thread (the universe is not a place, it is the overview).
  useEffect(() => {
    if (revision === 0 || !focusNodeId) return
    const { isUniverse, lens: shown, positions, nodeById } = useGraphStore.getState()
    const focus = nodeById(focusNodeId)
    if (!isUniverse && shown !== 'landmarks' && focus) recordThread(focus, positions)
  }, [revision, focusNodeId, recordThread])

  // Every new neighborhood triggers a camera flight to its focus.
  useEffect(() => {
    if (revision === 0 || !focusNodeId) return
    flyTo(focusNodeId, cameraMode === 'follow' ? 'follow' : 'focus')
    setHighlight(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision])

  // The sky in time: the year in the URL, what it hides and what it marks as new, for every view.
  const timeYears = useMemo(() => yearsOf(graphNodes, graphEdges), [graphNodes, graphEdges])
  useEffect(() => {
    setTime({ year, steps: timeSteps(timeYears), ...visibilityAt(timeYears, year, focusNodeId) })
  }, [timeYears, year, focusNodeId, setTime])
  // Playing walks the years that hold something, one at a time, and stops at the last.
  useEffect(() => {
    if (!playing) return
    if (year === null) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => {
      const next = nextStep(steps, year)
      if (next === null) setPlaying(false)
      else navigation.setYear(next)
    }, 1300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, year, steps])

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
      // On a path, ← and → walk it step by step.
      if (pathFound && focusNodeId && (event.key === 'ArrowRight' || event.key === 'ArrowLeft')) {
        event.preventDefault()
        const { previous, next } = neighbours(pathFound, focusNodeId)
        const target = event.key === 'ArrowRight' ? next : previous
        if (target) navigation.goTo(target, { follow: true, keepPath: true, replace: true })
        return
      }
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
      // Along the thread: [ back, ] forward, without adding steps.
      if (event.key === '[' || event.key === ']') {
        const step = useThreadStore.getState().walk(event.key === '[' ? -1 : 1)
        if (step) {
          event.preventDefault()
          navigation.goTo(step.id, { follow: true })
        }
        return
      }
      // T: the sky in time (from the first year, playing), or back to all of time.
      if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        if (year === null) {
          const first = steps[0]
          if (first !== undefined) {
            navigation.setYear(first)
            setPlaying(true)
          }
        } else {
          setPlaying(false)
          navigation.setYear(null)
        }
        return
      }
      // G: the genealogy of the point in hand (or back from it).
      if (event.key.toLowerCase() === 'g' && focusNodeId) {
        event.preventDefault()
        if (lens === 'lineage') navigation.closeLens()
        else {
          const focus = useGraphStore.getState().nodeById(focusNodeId)
          if (focus && hasLineage(focus)) navigation.openLineage(focus.id)
        }
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
  // A dedicated view replaces the focus panel (3D) and the list (List) once its data is on screen.
  const lensShown = lens && graphLens === lens ? lens : null

  return (
    <div id="main" className="explorer-shell relative w-full bg-void" data-theme={theme.id} data-mode={theme.mode}>
      {/* the app bar comes first in the document, so search is the first stop for the keyboard */}
      <TopBar />
      {!listMode && webgl ? <ConstellationCanvas /> : null}
      {listMode && path ? <PathPanel variant="page" /> : null}
      {listMode && lensShown === 'lineage' ? <LineagePage /> : null}
      {listMode && lensShown === 'landmarks' ? <LandmarksPage /> : null}
      {listMode && !path && !lens ? <RelationshipList /> : null}
      <FilterPanel />
      {!listMode && path ? <PathPanel variant="panel" /> : null}
      {!listMode && lensShown === 'lineage' ? <LineagePanel /> : null}
      {!listMode && lensShown === 'landmarks' ? <LandmarksPanel /> : null}
      {!listMode && !path && !lens ? <FocusPanel /> : null}
      <ThreadPanel />
      {!listMode && !lens ? <WelcomeCard /> : null}
      <TimeBar />
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

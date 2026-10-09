'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { MAX_GRAPH_DEPTH } from '@constellation/domain'
import { buildExploreUrl, parseExploreParams, PATH_DEPTH_LIMIT, threadPath, type ExploreParams, type ViewMode } from '@/lib/url'
import { useCameraStore } from '@/state/camera-store'

export interface GoToOptions {
  depth?: number
  /** Keep the current camera framing and glide along the edge instead of re-framing. */
  follow?: boolean
  replace?: boolean
  /** Stay in path mode (walking a path step by step). Any other move leaves it. */
  keepPath?: boolean
}

export interface ExploreNavigation {
  current: ExploreParams
  goTo(nodeId: string, options?: GoToOptions): void
  goUniverse(): void
  setDepth(depth: number): void
  expand(): void
  collapse(): void
  setView(view: ViewMode): void
  setFilters(filters: Record<string, string>): void
  back(): void
  shareUrl(): string
  /** Show the path from one point to another (path mode, starting on the first end). */
  startPath(from: string, to: string): void
  /** No path within 6 steps: search again up to 8. */
  searchFurther(): void
  /** Leave path mode and explore from a point (the step in hand by default). */
  leavePath(nodeId?: string): void
}

/**
 * Components rendered inside the R3F canvas live in a separate React root and cannot use
 * next/navigation hooks; they call `navigateTo`, which the Explorer wires to the router.
 */
const navigatorRef: { current: ((nodeId: string, options?: GoToOptions) => void) | null } = {
  current: null,
}

export function setNavigator(fn: ((nodeId: string, options?: GoToOptions) => void) | null): void {
  navigatorRef.current = fn
}

export function navigateTo(nodeId: string, options?: GoToOptions): void {
  navigatorRef.current?.(nodeId, options)
}

export function useExploreNavigation(): ExploreNavigation {
  const router = useRouter()
  const params = useSearchParams()
  const current = useMemo(() => parseExploreParams(new URLSearchParams(params.toString())), [params])
  const flyTo = useCameraStore((s) => s.flyTo)
  const resetCamera = useCameraStore((s) => s.reset)

  const goTo = useCallback(
    (nodeId: string, options: GoToOptions = {}) => {
      flyTo(nodeId, options.follow ? 'follow' : 'focus')
      const url = buildExploreUrl({
        ...current,
        node: nodeId,
        depth: options.depth ?? 1,
        ...(options.keepPath ? {} : { path: null, pathMax: null }),
      })
      if (options.replace) router.replace(url)
      else router.push(url)
    },
    [current, flyTo, router],
  )

  const goUniverse = useCallback(() => {
    resetCamera()
    router.push(buildExploreUrl({ ...current, node: null, depth: 1, path: null, pathMax: null }))
  }, [current, resetCamera, router])

  const setDepth = useCallback(
    (depth: number) => {
      const next = Math.min(MAX_GRAPH_DEPTH, Math.max(0, depth))
      router.replace(buildExploreUrl({ ...current, depth: next }))
    },
    [current, router],
  )

  const setView = useCallback(
    (view: ViewMode) => router.replace(buildExploreUrl({ ...current, view })),
    [current, router],
  )

  const setFilters = useCallback(
    (filters: Record<string, string>) => router.replace(buildExploreUrl({ ...current, filters })),
    [current, router],
  )

  return {
    current,
    goTo,
    goUniverse,
    setDepth,
    expand: () => setDepth(current.depth + 1),
    collapse: () => setDepth(1),
    setView,
    setFilters,
    back: () => router.back(),
    shareUrl: () => {
      const local = current.path ? threadPath(current.path[0], current.path[1], current.view) : buildExploreUrl(current)
      return typeof window === 'undefined' ? local : `${window.location.origin}${local}`
    },
    startPath: (from: string, to: string) => {
      flyTo(from, 'focus')
      router.push(buildExploreUrl({ ...current, node: from, depth: 1, path: [from, to], pathMax: null }))
    },
    searchFurther: () => {
      if (current.path) router.replace(buildExploreUrl({ ...current, pathMax: PATH_DEPTH_LIMIT }))
    },
    leavePath: (nodeId?: string) => {
      router.push(buildExploreUrl({ ...current, node: nodeId ?? current.node, depth: 1, path: null, pathMax: null }))
    },
  }
}

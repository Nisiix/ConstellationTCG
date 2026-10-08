'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo } from 'react'
import { MAX_GRAPH_DEPTH } from '@constellation/domain'
import { buildExploreUrl, parseExploreParams, type ExploreParams, type ViewMode } from '@/lib/url'
import { useCameraStore } from '@/state/camera-store'

export interface GoToOptions {
  depth?: number
  /** Keep the current camera framing and glide along the edge instead of re-framing. */
  follow?: boolean
  replace?: boolean
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
      const url = buildExploreUrl({ ...current, node: nodeId, depth: options.depth ?? 1 })
      if (options.replace) router.replace(url)
      else router.push(url)
    },
    [current, flyTo, router],
  )

  const goUniverse = useCallback(() => {
    resetCamera()
    router.push(buildExploreUrl({ ...current, node: null, depth: 1 }))
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
    shareUrl: () =>
      typeof window === 'undefined' ? buildExploreUrl(current) : `${window.location.origin}${buildExploreUrl(current)}`,
  }
}

'use client'

import type { NodeType, ResolvedTheme, ThemeMode } from '@constellation/domain'
import { DEFAULT_THEME, edgeColor, nodeColor, resolveTheme, themeCssVariables } from '@constellation/ui'
import { useCatalogStore } from '@/state/catalog-store'

export { DEFAULT_THEME, edgeColor, nodeColor }

/** The palette every component paints with: the selected game's theme in the active mode. */
export function useTheme(): ResolvedTheme {
  return useCatalogStore((s) => s.resolved)
}

export function useThemeMode(): ThemeMode {
  return useCatalogStore((s) => s.mode)
}

/** The palette of the 3D scene: the game's theme always in dark mode (the sky stays dark). */
export function useSceneTheme(): ResolvedTheme {
  return useCatalogStore((s) => s.scene)
}

/** Node color helper bound to the scene palette. */
export function useSceneNodeColor(): (type: NodeType) => string {
  const theme = useSceneTheme()
  return (type) => nodeColor(theme, type)
}

/** Names of the variables `applyThemeToDocument` writes (so they can be removed again). */
const APPLIED_VARS = Object.keys(themeCssVariables(resolveTheme(DEFAULT_THEME, 'dark')))

/**
 * Push a game's palette into CSS custom properties on the document root. The server-rendered
 * stylesheet (see the root layout) holds the neutral platform palette; the explorer overrides it
 * with the selected game's colors while it is mounted.
 */
export function applyThemeToDocument(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const [name, value] of Object.entries(themeCssVariables(theme))) root.style.setProperty(name, value)
  root.dataset.theme = theme.id
  root.dataset.mode = theme.mode
  root.style.colorScheme = theme.mode
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', theme.background)
}

/** Remove a game's palette so the platform defaults from the stylesheet apply again. */
export function clearThemeFromDocument(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const name of APPLIED_VARS) root.style.removeProperty(name)
  delete root.dataset.theme
  document.querySelector('meta[name="theme-color"]:not([media])')?.removeAttribute('content')
}

/** Node color helper bound to the current theme. */
export function useNodeColor(): (type: NodeType) => string {
  const theme = useTheme()
  return (type) => nodeColor(theme, type)
}

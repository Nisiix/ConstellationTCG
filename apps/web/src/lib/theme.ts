'use client'

import type { NodeType, TCGTheme } from '@constellation/domain'
import { DEFAULT_THEME, edgeColor, nodeColor, themeCssVariables } from '@constellation/ui'
import { useCatalogStore } from '@/state/catalog-store'

export { DEFAULT_THEME, edgeColor, nodeColor }

/** Current theme (from the selected game's adapter). */
export function useTheme(): TCGTheme {
  return useCatalogStore((s) => s.theme)
}

/** Push a theme's palette into CSS custom properties on the document root. */
export function applyThemeToDocument(theme: TCGTheme): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const [name, value] of Object.entries(themeCssVariables(theme))) root.style.setProperty(name, value)
  root.dataset.theme = theme.id
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.background)
}

/** Node color helper bound to the current theme. */
export function useNodeColor(): (type: NodeType) => string {
  const theme = useTheme()
  return (type) => nodeColor(theme, type)
}

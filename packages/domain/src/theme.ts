import type { NodeType } from './graph'

export const THEME_MODES = ['dark', 'light'] as const

export type ThemeMode = (typeof THEME_MODES)[number]

/** What a visitor asked for: a fixed mode, or whatever the operating system prefers. */
export type ThemeModePreference = ThemeMode | 'system'

export function isThemeMode(value: unknown): value is ThemeMode {
  return typeof value === 'string' && (THEME_MODES as readonly string[]).includes(value)
}

/**
 * Color roles. A game's brand colors are used only for contours — rings around nodes, borders,
 * edges, active states — never as large fills. Backgrounds are a dirty black (dark mode) or a
 * dirty white (light mode).
 */
export type ColorRole = 'primary' | 'contrast' | 'accent' | 'muted'

export interface TCGThemeMode {
  /** Page and scene background. */
  background: string
  /** Translucent panel surface (any CSS color). */
  surface: string
  text: string
  textDim: string
  /** Neutral fill of node spheres and image discs. */
  nodeFill: string
  /** The "contrast" role: near-white in dark mode, near-black in light mode. */
  contrast: string
  /** Contour color for generic nodes and edges (mechanics, attributes). */
  muted: string
  /** Faint star-field color. */
  particles: string
}

export interface TCGTheme {
  /** Stable id (usually the game slug). */
  id: string
  /** Main brand color for contours (Pokémon: red). */
  primary: string
  /** Secondary brand color for contours (One Piece: violet). */
  accent: string
  /** Ownership accent (My Constellation overlay). */
  ownership: string
  /** Contour role per node type; missing types use `muted`. */
  nodes: Partial<Record<NodeType, ColorRole>>
  /** Contour role per relationship type; missing types use `muted`. */
  edges: Record<string, ColorRole>
  modes: Record<ThemeMode, TCGThemeMode>
}

/** A theme flattened for one mode: every color is a concrete CSS value. */
export interface ResolvedTheme extends TCGThemeMode {
  id: string
  mode: ThemeMode
  primary: string
  accent: string
  ownership: string
  nodes: Record<NodeType, string>
  edges: Record<string, string>
}

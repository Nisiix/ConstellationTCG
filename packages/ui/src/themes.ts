import { NODE_TYPES, type ColorRole, type NodeType, type ResolvedTheme, type TCGTheme, type ThemeMode } from '@constellation/domain'

/** Neutral theme used before a game is selected or when an adapter declares none. */
export const DEFAULT_THEME: TCGTheme = {
  id: 'default',
  primary: '#38c6e0',
  accent: '#9b8cf5',
  ownership: '#e0b25a',
  nodes: {
    game: 'contrast',
    series: 'accent',
    set: 'primary',
    card_identity: 'contrast',
    card_printing: 'contrast',
    pokemon: 'contrast',
    artist: 'contrast',
    mechanic: 'muted',
    attribute: 'muted',
    digital_asset: 'accent',
  },
  edges: {
    BELONGS_TO: 'primary',
    PART_OF: 'accent',
    PRINTING_OF: 'contrast',
    ILLUSTRATED_BY: 'contrast',
    SAME_POKEMON: 'contrast',
    EVOLVES_FROM: 'contrast',
    EVOLUTION_OF: 'contrast',
  },
  modes: {
    dark: {
      background: '#0f1116',
      surface: 'rgba(22, 25, 33, 0.74)',
      text: '#eceff5',
      textDim: '#9aa3b4',
      nodeFill: '#171a21',
      contrast: '#f2f4f8',
      muted: '#5d6676',
      particles: '#3a4458',
    },
    light: {
      background: '#eef0f4',
      surface: 'rgba(252, 253, 255, 0.8)',
      text: '#161a22',
      textDim: '#646c7c',
      nodeFill: '#fbfcfe',
      contrast: '#161a22',
      muted: '#a7aebb',
      particles: '#c3c9d4',
    },
  },
}

/**
 * Preset for the One Piece adapter (second TCG): deep blue and violet contours, white in dark
 * mode. Lives here so the palette is ready before the adapter lands.
 */
export const ONE_PIECE_THEME: TCGTheme = {
  id: 'one-piece',
  primary: '#2e49c9',
  accent: '#8b6cf6',
  ownership: '#e0b25a',
  nodes: {
    game: 'contrast',
    series: 'accent',
    set: 'primary',
    card_identity: 'contrast',
    card_printing: 'contrast',
    artist: 'contrast',
    mechanic: 'muted',
    attribute: 'muted',
    digital_asset: 'accent',
  },
  edges: {
    BELONGS_TO: 'primary',
    PART_OF: 'accent',
    PRINTING_OF: 'contrast',
    ILLUSTRATED_BY: 'contrast',
  },
  modes: {
    dark: {
      background: '#0c0e1c',
      surface: 'rgba(18, 21, 44, 0.74)',
      text: '#eef0ff',
      textDim: '#9aa0cc',
      nodeFill: '#151834',
      contrast: '#f4f5ff',
      muted: '#555c8e',
      particles: '#2f3570',
    },
    light: {
      background: '#eef0f8',
      surface: 'rgba(252, 252, 255, 0.8)',
      text: '#141632',
      textDim: '#5f6490',
      nodeFill: '#fbfbff',
      contrast: '#141632',
      muted: '#a7abcf',
      particles: '#c5c8e6',
    },
  },
}

export const THEME_PRESETS: Record<string, TCGTheme> = {
  default: DEFAULT_THEME,
  'one-piece': ONE_PIECE_THEME,
}

export function roleColor(theme: TCGTheme, mode: ThemeMode, role: ColorRole): string {
  const colors = theme.modes[mode]
  switch (role) {
    case 'primary':
      return theme.primary
    case 'accent':
      return theme.accent
    case 'contrast':
      return colors.contrast
    default:
      return colors.muted
  }
}

/** Flatten a theme for one mode: every node type and edge gets a concrete color. */
export function resolveTheme(theme: TCGTheme, mode: ThemeMode): ResolvedTheme {
  const colors = theme.modes[mode]
  const nodes = {} as Record<NodeType, string>
  for (const type of NODE_TYPES) nodes[type] = roleColor(theme, mode, theme.nodes[type] ?? 'muted')
  const edges: Record<string, string> = {}
  for (const [rel, role] of Object.entries(theme.edges)) edges[rel] = roleColor(theme, mode, role)
  return {
    ...colors,
    id: theme.id,
    mode,
    primary: theme.primary,
    accent: theme.accent,
    ownership: theme.ownership,
    nodes,
    edges,
  }
}

export function nodeColor(theme: ResolvedTheme, type: NodeType): string {
  return theme.nodes[type] ?? theme.muted
}

export function edgeColor(theme: ResolvedTheme, relationshipType: string): string {
  return theme.edges[relationshipType] ?? theme.muted
}

/** CSS custom properties for a resolved theme, applied on `:root` by the web app. */
export function themeCssVariables(theme: ResolvedTheme): Record<string, string> {
  return {
    '--c-bg': theme.background,
    '--c-surface': theme.surface,
    '--c-text': theme.text,
    '--c-text-dim': theme.textDim,
    '--c-primary': theme.primary,
    '--c-accent': theme.accent,
    '--c-contrast': theme.contrast,
    '--c-muted': theme.muted,
    '--c-node-fill': theme.nodeFill,
    '--c-own': theme.ownership,
  }
}

/** Hex → [r, g, b] in 0..1 (short and long forms). Non-hex colors return white. */
export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim())
  if (!m || !m[1]) return [1, 1, 1]
  const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1]
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255]
}

import type { NodeType, TCGTheme } from '@constellation/domain'

/** Neutral theme used before a game is selected or when an adapter declares none. */
export const DEFAULT_THEME: TCGTheme = {
  id: 'default',
  background: '#05070d',
  surface: 'rgba(10, 16, 30, 0.6)',
  primary: '#38e1ff',
  secondary: '#3b82f6',
  accent: '#a78bfa',
  outline: '#0a1a33',
  text: '#e6f1ff',
  textDim: '#8aa4c8',
  particles: '#2f4f8f',
  nodes: {
    game: '#ffffff',
    series: '#a78bfa',
    set: '#3b82f6',
    card_identity: '#38e1ff',
    card_printing: '#9ff0ff',
    pokemon: '#c4b5fd',
    artist: '#f5d0fe',
    mechanic: '#60a5fa',
    attribute: '#2563eb',
    digital_asset: '#ffd166',
  },
  edges: {
    BELONGS_TO: '#3b82f6',
    PART_OF: '#a78bfa',
    PRINTING_OF: '#38e1ff',
    ILLUSTRATED_BY: '#f5d0fe',
    SAME_POKEMON: '#c4b5fd',
    EVOLVES_FROM: '#7dd3fc',
    EVOLUTION_OF: '#7dd3fc',
    HAS_TYPE: '#2563eb',
    WEAK_TO: '#1d4ed8',
    RESISTS: '#1e40af',
    HAS_ATTACK: '#60a5fa',
    HAS_ABILITY: '#60a5fa',
    HAS_ATTRIBUTE: '#1d4ed8',
  },
  ownership: '#ffd166',
}

/**
 * Preset for the One Piece adapter (second TCG): deep blue, violet and white.
 * Lives here so the palette is ready before the adapter lands.
 */
export const ONE_PIECE_THEME: TCGTheme = {
  id: 'one-piece',
  background: '#05071a',
  surface: 'rgba(14, 18, 48, 0.66)',
  primary: '#2f4fd8',
  secondary: '#ffffff',
  accent: '#a78bfa',
  outline: '#070a1f',
  text: '#eef0ff',
  textDim: '#9aa3d6',
  particles: '#2a2f6a',
  nodes: {
    game: '#ffffff',
    series: '#8b6cff',
    set: '#2f4fd8',
    card_identity: '#ffffff',
    card_printing: '#e3e6ff',
    artist: '#c4b5fd',
    mechanic: '#5b6cff',
    attribute: '#3730a3',
    digital_asset: '#ffd166',
  },
  edges: {
    BELONGS_TO: '#2f4fd8',
    PART_OF: '#8b6cff',
    PRINTING_OF: '#ffffff',
    ILLUSTRATED_BY: '#c4b5fd',
    HAS_ATTRIBUTE: '#3730a3',
  },
  ownership: '#ffd166',
}

export const THEME_PRESETS: Record<string, TCGTheme> = {
  default: DEFAULT_THEME,
  'one-piece': ONE_PIECE_THEME,
}

export function nodeColor(theme: TCGTheme, type: NodeType): string {
  return theme.nodes[type] ?? theme.secondary
}

export function edgeColor(theme: TCGTheme, relationshipType: string): string {
  return theme.edges[relationshipType] ?? theme.primary
}

/** CSS custom properties for a theme, applied on `:root` by the web app. */
export function themeCssVariables(theme: TCGTheme): Record<string, string> {
  return {
    '--c-bg': theme.background,
    '--c-surface': theme.surface,
    '--c-primary': theme.primary,
    '--c-secondary': theme.secondary,
    '--c-accent': theme.accent,
    '--c-outline': theme.outline,
    '--c-text': theme.text,
    '--c-text-dim': theme.textDim,
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

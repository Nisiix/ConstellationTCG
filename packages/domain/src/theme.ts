import type { NodeType } from './graph'

/**
 * Visual theme declared by a TCG adapter. The UI stays dark and spatial; the palette is what makes
 * a game recognizable (Pokémon: red and white with black contours; One Piece: deep blue, violet
 * and white). Everything is plain data so the core never hardcodes a game.
 */
export interface TCGTheme {
  /** Stable id (usually the game slug). */
  id: string
  /** Page background — near-black, possibly tinted. */
  background: string
  /** Glass surface tint (any CSS color, usually rgba). */
  surface: string
  /** Main brand color. */
  primary: string
  /** Secondary brand color. */
  secondary: string
  /** Accent for highlights, labels and hover states. */
  accent: string
  /** Contour / outline color (UI borders and 3D node outlines). */
  outline: string
  text: string
  textDim: string
  /** Faint star-field color. */
  particles: string
  /** Node colors per node type; missing types fall back to `secondary`. */
  nodes: Partial<Record<NodeType, string>>
  /** Edge colors per relationship type; missing types fall back to `primary`. */
  edges: Record<string, string>
  /** Ownership accent (My Constellation overlay). */
  ownership: string
}

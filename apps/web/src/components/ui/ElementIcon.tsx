import type { GraphNode } from '@constellation/domain'

/**
 * The elements (energy types) as small living icons: a flame that flickers, a drop that bobs, a
 * leaf that sways… Shown to the left of an element wherever one is named (connections, chips,
 * details, tooltip). Pure SVG + CSS; still under `prefers-reduced-motion`.
 */
export const ELEMENTS = [
  'grass',
  'fire',
  'water',
  'lightning',
  'psychic',
  'fighting',
  'darkness',
  'metal',
  'fairy',
  'dragon',
  'colorless',
] as const

export type Element = (typeof ELEMENTS)[number]

const ALIASES: Record<string, Element> = {
  electric: 'lightning',
  dark: 'darkness',
  steel: 'metal',
  normal: 'colorless',
}

export const ELEMENT_COLORS: Record<Element, string> = {
  grass: '#4caf50',
  fire: '#f0693a',
  water: '#3b8ee6',
  lightning: '#f2c530',
  psychic: '#a560d8',
  fighting: '#c6753a',
  darkness: '#5b6080',
  metal: '#8f9aa8',
  fairy: '#e58ac4',
  dragon: '#c09a3a',
  colorless: '#c9c4bc',
}

/** `Fire`, `type:fire`, `Lightning ` → the element, or null when the text names none. */
export function elementOf(value: string | null | undefined): Element | null {
  if (!value) return null
  const key = value
    .toLowerCase()
    .replace(/^type:/, '')
    .trim()
  if ((ELEMENTS as readonly string[]).includes(key)) return key as Element
  return ALIASES[key] ?? null
}

/** The element an attribute point stands for (`type:*` entities), else null. */
export function elementOfNode(
  node: Pick<GraphNode, 'nodeType' | 'metadata' | 'label'>,
): Element | null {
  if (node.nodeType !== 'attribute') return null
  const key = typeof node.metadata.key === 'string' ? node.metadata.key : ''
  if (!key.startsWith('type:')) return null
  return elementOf(key) ?? elementOf(node.label)
}

export function ElementIcon({
  element,
  size = 14,
  className = '',
}: {
  element: Element
  size?: number
  className?: string
}) {
  const color = ELEMENT_COLORS[element]
  return (
    <svg
      className={`el el-${element} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      focusable="false"
      style={{ color }}
    >
      <Shape element={element} />
    </svg>
  )
}

function Shape({ element }: { element: Element }) {
  switch (element) {
    case 'fire':
      return (
        <g className="el-anim el-flicker">
          <path
            d="M12 2c1 4 6 6 6 11a6 6 0 0 1-12 0c0-2.5 1.2-4 2.5-5.3 0 2.2 1 3.3 2.3 3.3.4-3.3-1-6.3 1.2-9z"
            fill="currentColor"
          />
          <path
            d="M12 12c.6 1.8 2.3 2.6 2.3 4.4a2.3 2.3 0 0 1-4.6 0c0-1.3.9-2.1 1.3-2.9.1.9.4 1.4 1 1.4-.2-1-.4-2 0-2.9z"
            fill="#fff"
            opacity="0.75"
          />
        </g>
      )
    case 'water':
      return (
        <g className="el-anim el-bob">
          <path
            d="M12 2.5C8.3 8 6 11.2 6 14.5a6 6 0 0 0 12 0c0-3.3-2.3-6.5-6-12z"
            fill="currentColor"
          />
          <path
            d="M9.2 13.2c-.6 1.4-.4 2.9.6 3.9"
            stroke="#fff"
            strokeWidth="1.3"
            strokeLinecap="round"
            opacity="0.8"
          />
        </g>
      )
    case 'grass':
      return (
        <g className="el-anim el-sway">
          <path d="M4 20C4.5 10.5 11 4 20 4c0 9-6.5 15.5-16 16z" fill="currentColor" />
          <path
            d="M5 19c3-5 7-9 12-12"
            stroke="#fff"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.75"
          />
        </g>
      )
    case 'lightning':
      return (
        <g className="el-anim el-flash">
          <path d="M13.5 2 4.5 14h6l-1.3 8L19.5 10h-6z" fill="currentColor" />
        </g>
      )
    case 'psychic':
      return (
        <g className="el-anim el-pulse">
          <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="4.2" fill="currentColor" />
          <circle cx="12" cy="12" r="1.4" fill="#fff" opacity="0.9" />
        </g>
      )
    case 'fighting':
      return (
        <g className="el-anim el-punch">
          <path
            d="M12 2.5l2.3 5.6 6 .7-4.5 4 1.4 5.9L12 15.6l-5.2 3.1 1.4-5.9-4.5-4 6-.7z"
            fill="currentColor"
          />
        </g>
      )
    case 'darkness':
      return (
        <g className="el-anim el-drift">
          <path d="M14.5 2.5a9.5 9.5 0 1 0 7 15.8A8 8 0 1 1 14.5 2.5z" fill="currentColor" />
          <circle cx="17.5" cy="7" r="1" fill="#fff" opacity="0.8" />
        </g>
      )
    case 'metal':
      return (
        <g className="el-anim el-spin">
          <path
            d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle cx="12" cy="12" r="3" fill="currentColor" />
        </g>
      )
    case 'fairy':
      return (
        <g className="el-anim el-twinkle">
          <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="currentColor" />
          <circle cx="12" cy="12" r="1.6" fill="#fff" opacity="0.9" />
        </g>
      )
    case 'dragon':
      return (
        <g className="el-anim el-coil">
          <path
            d="M12 3a9 9 0 1 0 9 9"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M12 7.5a4.5 4.5 0 1 0 4.5 4.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.7"
          />
          <circle cx="12" cy="12" r="1.6" fill="currentColor" />
        </g>
      )
    case 'colorless':
    default:
      return (
        <g className="el-anim el-shimmer">
          <circle cx="12" cy="12" r="5.5" fill="currentColor" />
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeDasharray="2.5 3"
            opacity="0.7"
          />
        </g>
      )
  }
}

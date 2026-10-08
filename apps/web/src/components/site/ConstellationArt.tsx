import { createRandom } from '@/lib/layout'

interface Point {
  x: number
  y: number
  r: number
  role: 'primary' | 'accent' | 'contrast'
}

/**
 * A small constellation drawn in the platform's visual language: neutral points with colored
 * contours, joined by thin lines. Deterministic (seeded), pure SVG, animated only with CSS so it
 * respects reduced-motion and costs nothing.
 */
export function ConstellationArt({ className = '' }: { className?: string }) {
  const random = createRandom(2024)
  const points: Point[] = []
  // A focus point in the middle, a ring of direct connections, a sparser outer ring.
  points.push({ x: 300, y: 210, r: 16, role: 'primary' })
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + random() * 0.5
    const d = 95 + random() * 30
    points.push({ x: 300 + Math.cos(a) * d, y: 210 + Math.sin(a) * d * 0.8, r: 8 + random() * 4, role: i % 3 === 0 ? 'primary' : 'contrast' })
  }
  for (let i = 0; i < 14; i += 1) {
    const a = (i / 14) * Math.PI * 2 + random() * 0.4
    const d = 185 + random() * 60
    points.push({ x: 300 + Math.cos(a) * d, y: 210 + Math.sin(a) * d * 0.72, r: 4 + random() * 3, role: i % 4 === 0 ? 'accent' : 'contrast' })
  }
  const lines: Array<[Point, Point]> = []
  for (let i = 1; i <= 7; i += 1) lines.push([points[0] as Point, points[i] as Point])
  for (let i = 8; i < points.length; i += 1) {
    const anchor = points[1 + ((i * 3) % 7)] as Point
    lines.push([anchor, points[i] as Point])
  }
  const color = (role: Point['role']) => (role === 'primary' ? 'var(--c-primary)' : role === 'accent' ? 'var(--c-accent)' : 'var(--c-contrast)')

  return (
    <svg viewBox="0 0 600 420" className={className} role="img" aria-label="A constellation: a focused card connected to its set, Pokémon, artist and evolutions">
      <defs>
        <radialGradient id="halo" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--c-primary)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--c-primary)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="300" cy="210" r="120" fill="url(#halo)" className="drift" />
      <g stroke="var(--c-primary)" strokeOpacity="0.45" strokeWidth="1">
        {lines.map(([a, b], i) => (
          <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeOpacity={i < 7 ? 0.55 : 0.22} />
        ))}
      </g>
      <g fill="var(--c-node-fill)">
        {points.map((p, i) => (
          <g key={i} className={i === 0 ? undefined : 'twinkle'} style={{ ['--i' as string]: i % 9 }}>
            <circle cx={p.x} cy={p.y} r={p.r} stroke={color(p.role)} strokeWidth={i === 0 ? 3 : 2} />
            {i === 0 ? <circle cx={p.x} cy={p.y} r={p.r * 0.45} fill="none" stroke="var(--c-contrast)" strokeWidth="2" /> : null}
          </g>
        ))}
      </g>
      {/* the focus ring: primary above, contrast below */}
      <g fill="none" strokeWidth="2.5" className="drift">
        <path d="M 272 210 A 28 28 0 0 1 328 210" stroke="var(--c-primary)" />
        <path d="M 328 210 A 28 28 0 0 1 272 210" stroke="var(--c-contrast)" />
      </g>
    </svg>
  )
}

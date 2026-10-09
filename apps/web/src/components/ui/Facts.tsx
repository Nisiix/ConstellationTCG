import { ElementIcon, elementOf } from './ElementIcon'

/**
 * The data of a point as small tiles (label above value) that wrap, instead of a flat table:
 * quicker to scan, less schematic. Tiles appear one after the other. An element (Fire, Water…)
 * gets its living icon to the left of its name.
 */
export function Facts({ rows, className = '' }: { rows: Array<[string, string]>; className?: string }) {
  if (rows.length === 0) return null
  return (
    <dl className={`facts ${className}`}>
      {rows.map(([label, value], i) => (
        <div key={label} className="fact pop-in" style={{ '--i': i } as React.CSSProperties}>
          <dt>{label}</dt>
          <dd title={value}>{label === 'Type' ? <TypeValue value={value} /> : value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** `Fire / Water` → each element with its icon on the left. */
function TypeValue({ value }: { value: string }) {
  const parts = value.split(' / ')
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
      {parts.map((part) => {
        const element = elementOf(part)
        return (
          <span key={part} className="inline-flex items-center gap-1">
            {element ? <ElementIcon element={element} /> : null}
            {part}
          </span>
        )
      })}
    </span>
  )
}

/** A description with a little voice: serif, a soft accent bar, a slightly larger lead. */
export function Prose({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`quote fade-up ${className}`}>{children}</p>
}

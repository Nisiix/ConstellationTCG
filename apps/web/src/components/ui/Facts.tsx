/**
 * The data of a point as small tiles (label above value) that wrap, instead of a flat table:
 * quicker to scan, less schematic. Tiles appear one after the other.
 */
export function Facts({ rows, className = '' }: { rows: Array<[string, string]>; className?: string }) {
  if (rows.length === 0) return null
  return (
    <dl className={`facts ${className}`}>
      {rows.map(([label, value], i) => (
        <div key={label} className="fact pop-in" style={{ '--i': i } as React.CSSProperties}>
          <dt>{label}</dt>
          <dd title={value}>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** A description with a little voice: serif, a soft accent bar, a slightly larger lead. */
export function Prose({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`quote fade-up ${className}`}>{children}</p>
}

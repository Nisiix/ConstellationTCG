/**
 * Dates as people read them here: `dd-MM-yyyy`, everywhere a date is shown. Catalog dates arrive
 * as `YYYY-MM-DD` and are formatted as they are, with no time-zone shift; timestamps (sync times)
 * are read in the viewer's local time.
 */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T/

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function parts(iso: string | null | undefined): { year: number; month: number; day: number } | null {
  if (typeof iso !== 'string') return null
  const value = iso.trim()
  const match = DATE_ONLY.exec(value)
  if (match) {
    const year = Number(match[1])
    const month = Number(match[2])
    const day = Number(match[3])
    // Reject the 30th of February and the like: the calendar must agree with the string.
    const check = new Date(Date.UTC(year, month - 1, day))
    if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null
    return { year, month, day }
  }
  if (TIMESTAMP.test(value)) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return null
    return { year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() }
  }
  return null
}

/** `1999-01-09` (or `1999-01-09T…`) → `09-01-1999`; anything that is not a date → ``. */
export function formatDate(iso: string | null | undefined): string {
  const p = parts(iso)
  return p ? `${pad(p.day)}-${pad(p.month)}-${p.year}` : ''
}

/** A timestamp → `09-01-1999 14:05` in local time (sync times); a plain date keeps no time. */
export function formatDateTime(iso: string | null | undefined): string {
  const date = formatDate(iso)
  if (!date || typeof iso !== 'string' || !TIMESTAMP.test(iso.trim())) return date
  const time = new Date(iso.trim())
  return `${date} ${pad(time.getHours())}:${pad(time.getMinutes())}`
}

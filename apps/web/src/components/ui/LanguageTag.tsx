import { BR, CN, DE, ES, FR, GB, ID, IT, JP, KR, MX, NL, PL, PT, RU, TH, TW } from 'country-flag-icons/react/3x2'
import { languageInfo } from '@/lib/language'

/** The flags that ship with the app: one inline SVG per country a catalog language points at. */
const FLAGS: Record<string, typeof GB> = { BR, CN, DE, ES, FR, GB, ID, IT, JP, KR, MX, NL, PL, PT, RU, TH, TW }

/**
 * A card's language: the flag of its country on the left, at text height, then the code in
 * capitals (`EN`, `ZH-TW`). Inline SVG, never an emoji (they do not render everywhere) and never a
 * remote image. An unknown language shows its code alone.
 */
export function LanguageTag({ language, className = '' }: { language: string | null | undefined; className?: string }) {
  const info = languageInfo(language)
  if (!info) return null
  const Flag = info.country ? FLAGS[info.country] : undefined
  const name = info.name ?? info.code
  return (
    <span className={`lang ${className}`} title={name}>
      {Flag ? <Flag className="lang-flag" role="img" aria-label={name} /> : null}
      <span>{info.code}</span>
    </span>
  )
}

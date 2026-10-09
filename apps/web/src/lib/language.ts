/**
 * The languages a card is printed in (TCGdex codes) and the country whose flag stands for each.
 * A language is not a country, so the pairing is a convention: English takes the United Kingdom's
 * flag, Spanish Spain's unless Mexico is named, Portuguese Portugal's unless Brazil is named.
 */
export interface LanguageInfo {
  /** The code in capitals, as shown next to the flag: `EN`, `FR`, `ZH-TW`. */
  code: string
  /** ISO 3166-1 alpha-2 country of the flag, or null when the language is not known. */
  country: string | null
  /** The language's English name (`English`, `Japanese`), or null when not known. */
  name: string | null
}

export const TCGDEX_LANGUAGES: Record<string, { country: string; name: string }> = {
  en: { country: 'GB', name: 'English' },
  fr: { country: 'FR', name: 'French' },
  de: { country: 'DE', name: 'German' },
  it: { country: 'IT', name: 'Italian' },
  es: { country: 'ES', name: 'Spanish' },
  'es-mx': { country: 'MX', name: 'Spanish (Mexico)' },
  pt: { country: 'PT', name: 'Portuguese' },
  'pt-br': { country: 'BR', name: 'Portuguese (Brazil)' },
  'pt-pt': { country: 'PT', name: 'Portuguese (Portugal)' },
  nl: { country: 'NL', name: 'Dutch' },
  pl: { country: 'PL', name: 'Polish' },
  ru: { country: 'RU', name: 'Russian' },
  ja: { country: 'JP', name: 'Japanese' },
  ko: { country: 'KR', name: 'Korean' },
  'zh-tw': { country: 'TW', name: 'Chinese (Traditional)' },
  'zh-cn': { country: 'CN', name: 'Chinese (Simplified)' },
  id: { country: 'ID', name: 'Indonesian' },
  th: { country: 'TH', name: 'Thai' },
}

/** `en`, ` FR `, `zh_CN` → how to show it; null when there is no language at all. */
export function languageInfo(language: string | null | undefined): LanguageInfo | null {
  if (typeof language !== 'string') return null
  const key = language.trim().toLowerCase().replace(/_/g, '-')
  if (!key) return null
  const known = TCGDEX_LANGUAGES[key]
  return { code: key.toUpperCase(), country: known?.country ?? null, name: known?.name ?? null }
}

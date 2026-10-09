import { describe, expect, it } from 'vitest'
import { TCGDEX_LANGUAGES, languageInfo } from '../language'

describe('languageInfo', () => {
  it('maps a TCGdex language code to its flag country, an uppercase code and a name', () => {
    expect(languageInfo('en')).toEqual({ code: 'EN', country: 'GB', name: 'English' })
    expect(languageInfo('ja')).toEqual({ code: 'JA', country: 'JP', name: 'Japanese' })
    expect(languageInfo('zh-tw')).toEqual({ code: 'ZH-TW', country: 'TW', name: 'Chinese (Traditional)' })
    expect(languageInfo('pt-br')).toEqual({ code: 'PT-BR', country: 'BR', name: 'Portuguese (Brazil)' })
    expect(languageInfo('es-mx')?.country).toBe('MX')
    expect(languageInfo('pt-pt')?.country).toBe('PT')
  })

  it('normalizes case, surrounding spaces and underscores', () => {
    expect(languageInfo(' FR ')).toEqual({ code: 'FR', country: 'FR', name: 'French' })
    expect(languageInfo('zh_CN')).toEqual({ code: 'ZH-CN', country: 'CN', name: 'Chinese (Simplified)' })
  })

  it('keeps an unknown code uppercase, without a flag', () => {
    expect(languageInfo('xx')).toEqual({ code: 'XX', country: null, name: null })
  })

  it('is null when there is no language', () => {
    expect(languageInfo('')).toBeNull()
    expect(languageInfo('   ')).toBeNull()
    expect(languageInfo(null)).toBeNull()
    expect(languageInfo(undefined)).toBeNull()
  })

  it('knows a flag for every TCGdex language', () => {
    const expected = ['en', 'fr', 'de', 'it', 'es', 'es-mx', 'pt', 'pt-br', 'pt-pt', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh-tw', 'zh-cn', 'id', 'th']
    expect(Object.keys(TCGDEX_LANGUAGES).sort()).toEqual([...expected].sort())
    for (const code of expected) expect(languageInfo(code)?.country, code).toMatch(/^[A-Z]{2}$/)
  })
})

import { describe, expect, it } from 'vitest'
import { isEmail, safeNextPath } from '../auth-redirect'
import { bytesToHex, utf8ToHex, walletErrorMessage } from '../wallet-bridge'

describe('safeNextPath', () => {
  it('keeps same-origin paths and refuses everything else', () => {
    expect(safeNextPath('/explore?node=x')).toBe('/explore?node=x')
    expect(safeNextPath(undefined)).toBe('/explore')
    expect(safeNextPath('')).toBe('/explore')
    expect(safeNextPath('https://evil.example')).toBe('/explore')
    expect(safeNextPath('//evil.example')).toBe('/explore')
    expect(safeNextPath('/\\evil.example')).toBe('/explore')
    expect(safeNextPath('/x\nSet-Cookie: a=b')).toBe('/explore')
    expect(safeNextPath('javascript:alert(1)', '/help')).toBe('/help')
  })
})

describe('isEmail', () => {
  it('accepts ordinary addresses and rejects junk', () => {
    expect(isEmail('someone@example.com')).toBe(true)
    expect(isEmail('a.b+c@sub.example.co')).toBe(true)
    expect(isEmail('nope')).toBe(false)
    expect(isEmail('a@b')).toBe(false)
    expect(isEmail('a b@example.com')).toBe(false)
  })
})

describe('wallet bridge helpers', () => {
  it('encodes messages the way personal_sign expects', () => {
    expect(bytesToHex(new Uint8Array([0, 15, 255]))).toBe('000fff')
    expect(utf8ToHex('hi')).toBe('0x6869')
  })

  it('turns wallet errors into sentences', () => {
    expect(walletErrorMessage({ code: 4001, message: 'User rejected' })).toMatch(/cancelled/)
    expect(walletErrorMessage({ code: -32002 })).toMatch(/already asking/)
    expect(walletErrorMessage(new Error('Error: locked'))).toBe('locked')
    expect(walletErrorMessage(null)).toBe('The wallet did not answer.')
  })
})

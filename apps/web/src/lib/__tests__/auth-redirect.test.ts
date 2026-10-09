import { describe, expect, it } from 'vitest'
import { authCallbackRedirect, isEmail, safeNextPath } from '../auth-redirect'
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

describe('authCallbackRedirect', () => {
  it('re-addresses a sign-in code that landed on another page to the callback', () => {
    expect(authCallbackRedirect('http://localhost:3000/?code=abc')).toBe(
      '/auth/callback?code=abc&next=%2F',
    )
    expect(authCallbackRedirect('http://localhost:3000/explore?node=x&code=abc&depth=2')).toBe(
      '/auth/callback?code=abc&next=%2Fexplore%3Fnode%3Dx%26depth%3D2',
    )
    expect(authCallbackRedirect('http://localhost:3000/?token_hash=h&type=magiclink')).toBe(
      '/auth/callback?token_hash=h&type=magiclink&next=%2F',
    )
    expect(
      authCallbackRedirect(
        'http://localhost:3000/?error=access_denied&error_code=otp_expired&error_description=x',
      ),
    ).toBe('/auth/callback?error=access_denied&error_code=otp_expired&error_description=x&next=%2F')
  })

  it('leaves ordinary pages and the callback itself alone', () => {
    expect(authCallbackRedirect('http://localhost:3000/explore?node=x')).toBeNull()
    expect(authCallbackRedirect('http://localhost:3000/auth/callback?code=abc')).toBeNull()
    expect(authCallbackRedirect('http://localhost:3000/?type=magiclink')).toBeNull()
    expect(authCallbackRedirect('not a url')).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { formatDate, formatDateTime } from '../dates'

describe('formatDate', () => {
  it('turns a calendar date into dd-MM-yyyy without shifting the day', () => {
    expect(formatDate('1999-01-09')).toBe('09-01-1999')
    expect(formatDate('2016-11-02')).toBe('02-11-2016')
    expect(formatDate(' 2000-04-24 ')).toBe('24-04-2000')
  })

  it('accepts an ISO timestamp and keeps its date', () => {
    expect(formatDate('2016-11-02T12:00:00.000Z')).toBe('02-11-2016')
  })

  it('is empty for anything that is not a date', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('yesterday')).toBe('')
    expect(formatDate('1999')).toBe('')
    expect(formatDate('1999-13-40')).toBe('')
    expect(formatDate('1999-02-30')).toBe('')
  })
})

describe('formatDateTime', () => {
  it('adds the local time of day, for sync times', () => {
    const local = new Date(2024, 4, 3, 9, 7, 30)
    expect(formatDateTime(local.toISOString())).toBe('03-05-2024 09:07')
  })

  it('shows a plain date without a time', () => {
    expect(formatDateTime('2024-05-03')).toBe('03-05-2024')
  })

  it('is empty for missing or broken timestamps', () => {
    expect(formatDateTime(null)).toBe('')
    expect(formatDateTime('')).toBe('')
    expect(formatDateTime('nope')).toBe('')
  })
})

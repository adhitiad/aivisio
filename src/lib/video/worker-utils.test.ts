import { describe, expect, test } from 'bun:test'
import { isLeaseExpired, retryDelayMs } from './worker-utils'

describe('durable video worker utilities', () => {
  test('uses exponential backoff capped at thirty minutes', () => {
    expect(retryDelayMs(1)).toBe(60_000)
    expect(retryDelayMs(2)).toBe(120_000)
    expect(retryDelayMs(3)).toBe(240_000)
    expect(retryDelayMs(99)).toBe(30 * 60_000)
  })

  test('normalizes unexpected attempt values safely', () => {
    expect(retryDelayMs(0)).toBe(60_000)
    expect(retryDelayMs(Number.NaN)).toBe(60_000)
  })

  test('detects missing and expired heartbeats', () => {
    const now = new Date('2026-11-20T00:10:00.000Z')
    expect(isLeaseExpired(null, now, 60_000)).toBe(true)
    expect(isLeaseExpired(new Date('2026-11-20T00:08:00.000Z'), now, 60_000)).toBe(true)
    expect(isLeaseExpired(new Date('2026-11-20T00:09:30.000Z'), now, 60_000)).toBe(false)
  })
})

import { describe, expect, test } from 'bun:test'
import { calculateYoutubeRetryDelay, isYoutubeUploadAttemptExhausted, parseYoutubeUploadOffset } from './publishing-utils'

function expectThrows(callback: () => unknown) {
  let didThrow = false
  try { callback() } catch { didThrow = true }
  expect(didThrow).toBe(true)
}

describe('parseYoutubeUploadOffset', () => {
  test('converts the inclusive Range end into the next byte offset', () => expect(parseYoutubeUploadOffset('bytes=0-8388607', 20_000_000)).toBe(8_388_608))
  test('returns zero when no bytes have been acknowledged', () => expect(parseYoutubeUploadOffset(null, 10_000)).toBe(0))
  test('rejects malformed and out-of-range offsets', () => {
    expectThrows(() => parseYoutubeUploadOffset('bytes=1-9', 100))
    expectThrows(() => parseYoutubeUploadOffset('bytes=0-100', 100))
  })
})

describe('calculateYoutubeRetryDelay', () => {
  test('uses capped exponential backoff with bounded jitter', () => {
    expect(calculateYoutubeRetryDelay(1, 0)).toBe(24_000)
    expect(calculateYoutubeRetryDelay(2, 1)).toBe(72_000)
    expect(calculateYoutubeRetryDelay(30, 0.5)).toBe(21_600_000)
  })
})

describe('isYoutubeUploadAttemptExhausted', () => {
  test('allows attempts up to the configured maximum', () => {
    expect(isYoutubeUploadAttemptExhausted(1, 8)).toBe(false)
    expect(isYoutubeUploadAttemptExhausted(8, 8)).toBe(false)
  })
  test('stops after the configured maximum and rejects invalid counters', () => {
    expect(isYoutubeUploadAttemptExhausted(9, 8)).toBe(true)
    expect(isYoutubeUploadAttemptExhausted(Number.NaN, 8)).toBe(true)
  })
})

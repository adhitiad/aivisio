import { describe, expect, it } from 'bun:test'
import { calculateYoutubeRetryDelay, parseYoutubeUploadOffset } from './publishing-utils'

describe('parseYoutubeUploadOffset', () => {
  it('converts the inclusive Range end into the next byte offset', () => expect(parseYoutubeUploadOffset('bytes=0-8388607', 20_000_000)).toBe(8_388_608))
  it('returns zero when no bytes have been acknowledged', () => expect(parseYoutubeUploadOffset(null, 10_000)).toBe(0))
  it('rejects malformed and out-of-range offsets', () => {
    expect(() => parseYoutubeUploadOffset('bytes=1-9', 100)).toThrow()
    expect(() => parseYoutubeUploadOffset('bytes=0-100', 100)).toThrow()
  })
})

describe('calculateYoutubeRetryDelay', () => {
  it('uses capped exponential backoff with bounded jitter', () => {
    expect(calculateYoutubeRetryDelay(1, 0)).toBe(24_000)
    expect(calculateYoutubeRetryDelay(2, 1)).toBe(72_000)
    expect(calculateYoutubeRetryDelay(30, 0.5)).toBe(21_600_000)
  })
})

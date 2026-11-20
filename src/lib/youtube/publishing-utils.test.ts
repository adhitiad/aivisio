import { describe, expect, test } from 'bun:test'
import { calculateYoutubeRetryDelay, getYoutubeWorkerHealthStatus, hasYoutubeUploadAttemptsRemaining, isYoutubeChannelOwned, isYoutubeObjectReady, isYoutubeUploadAttemptExhausted, isYoutubeScheduleValid, parseYoutubeUploadOffset } from './publishing-utils'

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

describe('YouTube publishing preflight', () => {
  test('requires the selected channel to belong to the connected Google account', () => {
    expect(isYoutubeChannelOwned(['UC123', 'UC456'], 'UC123')).toBe(true)
    expect(isYoutubeChannelOwned(['UC123'], 'UC999')).toBe(false)
    expect(isYoutubeChannelOwned([], 'UC123')).toBe(false)
  })

  test('requires a positive exact object size match', () => {
    expect(isYoutubeObjectReady(1024, 1024)).toBe(true)
    expect(isYoutubeObjectReady(1024, 1023)).toBe(false)
    expect(isYoutubeObjectReady(0, 0)).toBe(false)
    expect(isYoutubeObjectReady(1024, null)).toBe(false)
  })

  test('respects the configured retry budget', () => {
    expect(hasYoutubeUploadAttemptsRemaining(0, 8)).toBe(true)
    expect(hasYoutubeUploadAttemptsRemaining(7, 8)).toBe(true)
    expect(hasYoutubeUploadAttemptsRemaining(8, 8)).toBe(false)
    expect(hasYoutubeUploadAttemptsRemaining(0, 0)).toBe(false)
  })
})

describe('YouTube scheduled publishing', () => {
  test('requires the scheduled time to remain at least ten minutes ahead', () => {
    const now = Date.now()
    expect(isYoutubeScheduleValid(null, now)).toBe(true)
    expect(isYoutubeScheduleValid(new Date(now + 11 * 60_000), now)).toBe(true)
    expect(isYoutubeScheduleValid(new Date(now + 9 * 60_000), now)).toBe(false)
    expect(isYoutubeScheduleValid(new Date(now - 1), now)).toBe(false)
  })
})


describe('YouTube worker observability health', () => {
  test('does not report an uninitialized worker as healthy', () => {
    expect(getYoutubeWorkerHealthStatus({
      staleUploads: 0, overdueJobs: 0, heartbeatAgeMs: null, lastRunStatus: null,
    })).toBe('unknown')
  })

  test('distinguishes a recent successful or running scheduler', () => {
    expect(getYoutubeWorkerHealthStatus({
      staleUploads: 0, overdueJobs: 0, heartbeatAgeMs: 60_000, lastRunStatus: 'success',
    })).toBe('ok')
    expect(getYoutubeWorkerHealthStatus({
      staleUploads: 0, overdueJobs: 0, heartbeatAgeMs: 60_000, lastRunStatus: 'running',
    })).toBe('running')
  })

  test('degrades on stale heartbeats, failed runs, stale leases, and overdue jobs', () => {
    expect(getYoutubeWorkerHealthStatus({
      staleUploads: 0, overdueJobs: 0, heartbeatAgeMs: 16 * 60_000, lastRunStatus: 'success',
    })).toBe('degraded')
    expect(getYoutubeWorkerHealthStatus({
      staleUploads: 0, overdueJobs: 0, heartbeatAgeMs: 60_000, lastRunStatus: 'error',
    })).toBe('degraded')
    expect(getYoutubeWorkerHealthStatus({
      staleUploads: 1, overdueJobs: 0, heartbeatAgeMs: 60_000, lastRunStatus: 'success',
    })).toBe('degraded')
    expect(getYoutubeWorkerHealthStatus({
      staleUploads: 0, overdueJobs: 1, heartbeatAgeMs: 60_000, lastRunStatus: 'success',
    })).toBe('degraded')
  })
})

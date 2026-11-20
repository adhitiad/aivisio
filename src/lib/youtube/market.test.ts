import { describe, expect, test } from 'bun:test'
import { median, parseYoutubeDuration } from './market'

describe('YouTube market metrics helpers', () => {
  test('parses ISO-8601 video durations', () => {
    expect(parseYoutubeDuration('PT1H2M3S')).toBe(3723)
    expect(parseYoutubeDuration('PT4M10S')).toBe(250)
    expect(parseYoutubeDuration('PT35S')).toBe(35)
    expect(parseYoutubeDuration('not-a-duration')).toBe(null)
  })

  test('calculates a median baseline for velocity comparison', () => {
    expect(median([10, 20, 30])).toBe(20)
    expect(median([10, 20, 30, 40])).toBe(25)
    expect(median([])).toBe(0)
  })
})

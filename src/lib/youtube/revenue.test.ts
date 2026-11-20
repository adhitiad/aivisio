import { describe, expect, test } from 'bun:test'
import { percentageChange, summarizeRevenue } from './revenue'

describe('Revenue Intelligence calculations', () => {
  test('calculates revenue totals and RPM per thousand views', () => {
    const summary = summarizeRevenue([
      { views: 10_000n, estimatedRevenue: 125_000, estimatedAdRevenue: 100_000 },
      { views: 15_000n, estimatedRevenue: 225_000, estimatedAdRevenue: 180_000 },
    ])
    expect(summary.views).toBe('25000')
    expect(summary.estimatedRevenue).toBe(350_000)
    expect(summary.estimatedAdRevenue).toBe(280_000)
    expect(summary.rpm).toBe(14_000)
    expect(summary.adRpm).toBe(11_200)
    expect(summary.daysWithRevenue).toBe(2)
  })

  test('distinguishes unavailable revenue from a true zero', () => {
    const summary = summarizeRevenue([
      { views: 2_000n, estimatedRevenue: null, estimatedAdRevenue: null },
    ])
    expect(summary.estimatedRevenue).toBe(null)
    expect(summary.rpm).toBe(null)
    expect(summary.daysWithRevenue).toBe(0)
  })

  test('returns null when comparison revenue is missing or zero', () => {
    expect(percentageChange(120, 100)).toBe(20)
    expect(percentageChange(0, 0)).toBe(null)
    expect(percentageChange(null, 12)).toBe(null)
  })
})

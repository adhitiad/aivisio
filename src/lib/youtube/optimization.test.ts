import { describe, expect, test } from 'bun:test'
import { buildRevenueRecommendations, calculateRevenueForecast, calculateYppProgress } from './optimization'

describe('YouTube optimization calculations', () => {
  test('does not invent YPP thresholds when manual Studio values are missing', () => {
    const result = calculateYppProgress({
      validPublicWatchHours: null,
      requiredPublicWatchHours: null,
      validShortsViews: 10_000,
      requiredShortsViews: null,
    })
    expect(result.watchHoursProgress).toBe(null)
    expect(result.shortsViewsProgress).toBe(null)
    expect(result.hasManualThresholds).toBe(false)
    expect(result.checked).toBe(true)
  })

  test('calculates progress using supplied thresholds only', () => {
    const result = calculateYppProgress({
      validPublicWatchHours: 1500,
      requiredPublicWatchHours: 3000,
      validShortsViews: 2_000_000,
      requiredShortsViews: 3_000_000,
    })
    expect(result.watchHoursProgress).toBe(50)
    expect(result.shortsViewsProgress).toBe(2_000_000 / 3_000_000 * 100)
  })

  test('calculates an explicit what-if revenue range', () => {
    const result = calculateRevenueForecast({
      targetRevenue: 2_000_000,
      rpm: 20_000,
      baselineDailyViews: 5_000,
      projectionDays: 30,
    })
    expect(result.projectedViews).toBe(150_000)
    expect(result.projectedRevenue).toBe(3_000_000)
    expect(result.lowerForecast).toBe(2_400_000)
    expect(result.upperForecast).toBe(3_600_000)
    expect(result.requiredViews).toBe(100_000)
  })

  test('rejects invalid assumptions instead of returning misleading projections', () => {
    let invalidTargetRejected = false
    try {
      calculateRevenueForecast({
        targetRevenue: 0, rpm: 10_000, baselineDailyViews: 100, projectionDays: 30,
      })
    } catch {
      invalidTargetRejected = true
    }
    expect(invalidTargetRejected).toBe(true)

    let invalidWindowRejected = false
    try {
      calculateRevenueForecast({
        targetRevenue: 1_000_000, rpm: 10_000, baselineDailyViews: 100, projectionDays: 0,
      })
    } catch {
      invalidWindowRejected = true
    }
    expect(invalidWindowRejected).toBe(true)
  })

  test('recommendations do not label forecasts or missing metrics as actual revenue', () => {
    const recommendations = buildRevenueRecommendations({
      revenueAvailable: false,
      views: 1200,
      averageViewPercentage: null,
      rpm: null,
    })
    expect(recommendations[0].includes('belum tersedia sebagai metrik aktual')).toBe(true)
  })
})

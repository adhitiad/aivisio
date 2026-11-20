import { describe, expect, test } from 'bun:test'
import { deriveObservedMomentum, scoreYoutubeOpportunity } from './scoring'

describe('YouTube opportunity scoring', () => {
  test('derives views/day from two observed public-stat snapshots', () => {
    const momentum = deriveObservedMomentum({
      currentViews: 13_000n,
      previousViews: 10_000n,
      sampleHours: 24,
    })
    expect(momentum?.viewsPerDay).toBe(3000)
    expect(momentum?.growthPct).toBe(30)
    expect(momentum?.sampleHours).toBe(24)
  })

  test('does not infer momentum from missing or invalid history', () => {
    expect(deriveObservedMomentum({
      currentViews: 13_000n,
      previousViews: 10_000n,
      sampleHours: 12,
    })).toBe(null)
    expect(deriveObservedMomentum({
      currentViews: 10_000n,
      previousViews: 13_000n,
      sampleHours: 24,
    })).toBe(null)
  })

  test('returns bounded, explainable scores and limited confidence without history', () => {
    const result = scoreYoutubeOpportunity({
      viewsPerDay: 1200,
      engagementRate: 4.2,
      subscriberCount: 20_000n,
      publishedAt: new Date('2026-11-10T00:00:00.000Z'),
      momentumViewsPerDay: null,
      momentumGrowthPct: null,
      momentumSampleHours: null,
      sampleVelocityIndex: 135,
      observationCount: 0,
    }, new Date('2026-11-20T00:00:00.000Z'))

    expect(result.score >= 0 && result.score <= 100).toBe(true)
    expect(result.confidence).toBe('limited')
    expect(result.components.momentum.available).toBe(false)
    expect(result.rationale.length).toBe(7)
  })

  test('increases confidence after repeated observations', () => {
    const result = scoreYoutubeOpportunity({
      viewsPerDay: 1200,
      engagementRate: 4.2,
      subscriberCount: 20_000n,
      publishedAt: new Date('2026-11-10T00:00:00.000Z'),
      momentumViewsPerDay: 2400,
      momentumGrowthPct: 100,
      momentumSampleHours: 48,
      sampleVelocityIndex: 135,
      observationCount: 4,
    })
    expect(result.confidence).toBe('high')
    expect(result.components.momentum.available).toBe(true)
  })
})

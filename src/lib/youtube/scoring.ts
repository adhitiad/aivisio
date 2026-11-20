export type MomentumInput = {
  currentViews: bigint
  previousViews: bigint
  sampleHours: number
}

export type OpportunityInput = {
  viewsPerDay: number
  engagementRate: number
  subscriberCount: bigint | null
  publishedAt: Date | null
  momentumViewsPerDay: number | null
  momentumGrowthPct: number | null
  momentumSampleHours: number | null
  sampleVelocityIndex: number
  observationCount: number
}

export type OpportunityComponent = {
  score: number
  available: boolean
  weight: number
  rationale: string
}

export type OpportunityScore = {
  score: number
  confidence: 'high' | 'medium' | 'limited'
  components: {
    momentum: OpportunityComponent
    demand: OpportunityComponent
    engagement: OpportunityComponent
    competition: OpportunityComponent
    freshness: OpportunityComponent
  }
  rationale: string[]
}

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))

const safeNumber = (value: bigint | null): number | null => {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export function deriveObservedMomentum(input: MomentumInput): {
  viewsPerDay: number
  growthPct: number | null
  sampleHours: number
} | null {
  if (
    !Number.isFinite(input.sampleHours) ||
    input.sampleHours < 18 ||
    input.sampleHours > 24 * 10 ||
    input.currentViews < input.previousViews
  ) {
    return null
  }

  const previous = Number(input.previousViews)
  const delta = Number(input.currentViews - input.previousViews)
  if (!Number.isFinite(previous) || !Number.isFinite(delta)) return null

  return {
    viewsPerDay: delta / input.sampleHours * 24,
    growthPct: previous > 0 ? delta / previous * 100 : null,
    sampleHours: input.sampleHours,
  }
}

/**
 * Deterministic, explainable score from public observations.
 * It is a relative research priority, not a prediction of guaranteed virality.
 */
export function scoreYoutubeOpportunity(
  input: OpportunityInput,
  now = new Date(),
): OpportunityScore {
  const momentumAvailable =
    input.momentumViewsPerDay !== null &&
    input.momentumSampleHours !== null &&
    input.momentumSampleHours >= 18 &&
    input.momentumSampleHours <= 24 * 10

  const momentumRatio = momentumAvailable
    ? input.momentumViewsPerDay! / Math.max(input.viewsPerDay, 1)
    : 0
  const momentumScore = momentumAvailable
    ? clamp(Math.log10(1 + Math.max(0, momentumRatio)) * 55)
    : 0

  const demandScore = clamp(
    Math.log10(1 + Math.max(0, input.viewsPerDay)) / Math.log10(100_001) * 100,
  )
  const engagementScore = clamp(Math.max(0, input.engagementRate) / 8 * 100)

  const subscribers = safeNumber(input.subscriberCount)
  const reachRatio = subscribers && subscribers > 0
    ? Math.max(0, input.viewsPerDay / subscribers)
    : null
  const competitionScore = reachRatio === null
    ? 0
    : clamp(Math.log10(1 + reachRatio * 100) / Math.log10(1001) * 100)

  const ageDays = input.publishedAt
    ? Math.max(0, (now.getTime() - input.publishedAt.getTime()) / 86_400_000)
    : null
  const freshnessScore = ageDays === null ? 0 : clamp(100 * Math.exp(-ageDays / 60))

  const components = {
    momentum: {
      score: momentumScore,
      available: momentumAvailable,
      weight: 0.35,
      rationale: momentumAvailable
        ? 'Kecepatan aktual sekitar ' + Math.round(input.momentumViewsPerDay!).toLocaleString('id-ID') +
          ' views/hari berdasarkan snapshot ' + Math.round(input.momentumSampleHours!) + ' jam.'
        : 'Belum ada dua snapshot terpisah minimal 18 jam untuk menghitung momentum aktual.',
    },
    demand: {
      score: demandScore,
      available: true,
      weight: 0.25,
      rationale: 'Rata-rata lifetime sekitar ' + Math.round(input.viewsPerDay).toLocaleString('id-ID') +
        ' views/hari sejak video diterbitkan.',
    },
    engagement: {
      score: engagementScore,
      available: true,
      weight: 0.15,
      rationale: 'Engagement publik (likes + comments dibanding views) ' + input.engagementRate.toFixed(2) + '%.',
    },
    competition: {
      score: competitionScore,
      available: reachRatio !== null,
      weight: 0.15,
      rationale: reachRatio === null
        ? 'Subscriber channel tidak tersedia atau disembunyikan; komponen kompetisi tidak dinilai.'
        : 'Rasio views/hari terhadap subscriber channel ' + (reachRatio * 100).toFixed(2) + '%.',
    },
    freshness: {
      score: freshnessScore,
      available: ageDays !== null,
      weight: 0.10,
      rationale: ageDays === null
        ? 'Tanggal publikasi tidak tersedia; freshness tidak dinilai.'
        : 'Usia video sekitar ' + Math.floor(ageDays) + ' hari.',
    },
  } satisfies Record<string, OpportunityComponent>

  const availableWeight = Object.values(components)
    .filter((component) => component.available)
    .reduce((sum, component) => sum + component.weight, 0)
  const weighted = Object.values(components)
    .filter((component) => component.available)
    .reduce((sum, component) => sum + component.score * component.weight, 0)

  const confidence: OpportunityScore['confidence'] =
    momentumAvailable && input.observationCount >= 4
      ? 'high'
      : momentumAvailable
        ? 'medium'
        : 'limited'

  const score = availableWeight > 0 ? Math.round(weighted / availableWeight) : 0
  const rationale = [
    components.momentum.rationale,
    components.demand.rationale,
    components.engagement.rationale,
    components.competition.rationale,
    components.freshness.rationale,
    'Indeks relatif saat ini ' + input.sampleVelocityIndex.toFixed(1) + ' dibanding median sampel.',
    'Confidence ' + confidence + '; skor ini untuk prioritas riset, bukan prediksi viralitas atau pendapatan.',
  ]

  return { score, confidence, components, rationale }
}

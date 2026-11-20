export type YppProgressInput = {
  validPublicWatchHours: number | null
  requiredPublicWatchHours: number | null
  validShortsViews: number | null
  requiredShortsViews: number | null
}

function progress(current: number | null, required: number | null): number | null {
  if (current === null || required === null || required <= 0) return null
  return Math.min(100, Math.max(0, current / required * 100))
}

/** Uses thresholds entered from the creator's current YouTube Studio eligibility view. */
export function calculateYppProgress(input: YppProgressInput) {
  const watchHoursProgress = progress(input.validPublicWatchHours, input.requiredPublicWatchHours)
  const shortsViewsProgress = progress(input.validShortsViews, input.requiredShortsViews)
  return {
    watchHoursProgress,
    shortsViewsProgress,
    hasManualThresholds: watchHoursProgress !== null || shortsViewsProgress !== null,
    checked: input.validPublicWatchHours !== null || input.validShortsViews !== null,
  }
}

export type RevenueForecastInput = {
  targetRevenue: number
  rpm: number
  baselineDailyViews: number
  projectionDays: number
}

export function calculateRevenueForecast(input: RevenueForecastInput) {
  const { targetRevenue, rpm, baselineDailyViews, projectionDays } = input
  if (!Number.isFinite(targetRevenue) || targetRevenue <= 0) throw new Error('Target revenue must be positive.')
  if (!Number.isFinite(rpm) || rpm <= 0) throw new Error('RPM assumption must be positive.')
  if (!Number.isFinite(baselineDailyViews) || baselineDailyViews < 0) throw new Error('Daily views must be non-negative.')
  if (!Number.isInteger(projectionDays) || projectionDays < 1 || projectionDays > 365) throw new Error('Projection window must be 1–365 days.')

  const projectedViews = baselineDailyViews * projectionDays
  const projectedRevenue = projectedViews * rpm / 1000
  return {
    currencyCode: 'IDR' as const,
    targetRevenue,
    rpm,
    baselineDailyViews,
    projectionDays,
    projectedViews,
    projectedRevenue,
    lowerForecast: projectedRevenue * 0.8,
    upperForecast: projectedRevenue * 1.2,
    requiredViews: targetRevenue / rpm * 1000,
    requiredDailyViews: targetRevenue / rpm * 1000 / projectionDays,
  }
}

export type RevenueRecommendationInput = {
  revenueAvailable: boolean
  views: number
  averageViewPercentage: number | null
  rpm: number | null
  topCountryName?: string | null
  topCountryRpm?: number | null
}

export function buildRevenueRecommendations(input: RevenueRecommendationInput): string[] {
  const recommendations: string[] = []
  if (!input.revenueAvailable || input.rpm === null) {
    recommendations.push('Pendapatan belum tersedia sebagai metrik aktual. Fokus pada pertumbuhan audiens dan waktu tonton; jangan gunakan proyeksi sebagai pendapatan tercatat.')
  } else {
    recommendations.push('RPM channel aktual saat ini sekitar ' + Math.round(input.rpm).toLocaleString('id-ID') + ' per 1.000 views. Gunakan sebagai baseline historis, bukan jaminan RPM video berikutnya.')
    if (input.topCountryName && input.topCountryRpm !== null && input.topCountryRpm !== undefined) {
      recommendations.push('Bandingkan format, bahasa, dan topik untuk audiens ' + input.topCountryName + '; RPM negara tersebut saat ini sekitar ' + Math.round(input.topCountryRpm).toLocaleString('id-ID') + '.')
    }
  }
  if (input.averageViewPercentage !== null && input.averageViewPercentage < 30) {
    recommendations.push('Rata-rata persentase ditonton di bawah 30%. Uji ulang hook awal, pacing, dan kesesuaian isi dengan judul.')
  } else if (input.averageViewPercentage !== null && input.averageViewPercentage >= 50) {
    recommendations.push('Retensi rata-rata yang tercatat kuat. Uji seri lanjutan dengan topik dan format yang serupa.')
  }
  if (input.views === 0) {
    recommendations.push('Belum ada views pada periode ini. Sinkronkan rentang tanggal yang memiliki data sebelum menilai performa.')
  }
  return recommendations
}

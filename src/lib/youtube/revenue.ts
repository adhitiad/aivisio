export type RevenueMetricRow = {
  views: bigint
  estimatedRevenue: number | null
  estimatedAdRevenue: number | null
}

function sumAvailable(rows: RevenueMetricRow[], key: 'estimatedRevenue' | 'estimatedAdRevenue') {
  const values = rows.flatMap((row) => row[key] === null ? [] : [row[key] as number])
  return values.length ? values.reduce((sum, value) => sum + value, 0) : null
}

export function summarizeRevenue(rows: RevenueMetricRow[]) {
  const views = rows.reduce((sum, row) => sum + row.views, 0n)
  const viewCount = Number(views)
  const estimatedRevenue = sumAvailable(rows, 'estimatedRevenue')
  const estimatedAdRevenue = sumAvailable(rows, 'estimatedAdRevenue')
  return {
    views: views.toString(),
    estimatedRevenue,
    estimatedAdRevenue,
    rpm: estimatedRevenue !== null && viewCount > 0 ? estimatedRevenue / viewCount * 1000 : null,
    adRpm: estimatedAdRevenue !== null && viewCount > 0 ? estimatedAdRevenue / viewCount * 1000 : null,
    daysWithRevenue: rows.filter((row) => row.estimatedRevenue !== null).length,
  }
}

export function percentageChange(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null
  return (current - previous) / Math.abs(previous) * 100
}

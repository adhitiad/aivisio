export function retryDelayMs(attempt: number): number {
  const normalizedAttempt = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1
  return Math.min(30 * 60_000, 60_000 * (2 ** (normalizedAttempt - 1)))
}

export function isLeaseExpired(heartbeatAt: Date | null, now: Date, leaseMs: number): boolean {
  if (!heartbeatAt || !Number.isFinite(heartbeatAt.getTime())) return true
  return now.getTime() - heartbeatAt.getTime() > leaseMs
}

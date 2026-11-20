export function parseYoutubeUploadOffset(range: string | null, total: number): number {
  if (!range) return 0
  const match = range.match(/^bytes=0-(\d+)$/)
  if (!match) throw new Error('Header Range dari YouTube tidak valid.')
  const offset = Number(match[1]) + 1
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > total) throw new Error('Offset resumable upload dari YouTube berada di luar ukuran file.')
  return offset
}

export function calculateYoutubeRetryDelay(attempt: number, random = Math.random()): number {
  const safeAttempt = Number.isFinite(attempt) ? Math.max(1, Math.floor(attempt)) : 1
  const base = Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(20, safeAttempt - 1)))
  const jitter = Number.isFinite(random) ? Math.max(0, Math.min(1, random)) : 0.5
  return Math.round(base * (0.8 + jitter * 0.4))
}

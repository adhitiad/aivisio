import { randomUUID } from 'node:crypto'
import { hostname } from 'node:os'
import { db } from '../src/lib/db'
import { moduleLogger } from '../src/lib/logger'
import { runVideoPipeline } from '../src/lib/video/pipeline'
import { retryDelayMs } from '../src/lib/video/worker-utils'
import { closeRedisClient, dequeueVideoJob, enqueueVideoJob } from '../src/lib/redis/video-queue'

const log = moduleLogger('video-worker')
const workerId = (process.env.HOSTNAME || hostname()) + '-' + process.pid + '-' + randomUUID().slice(0, 8)
const pollMs = Math.max(500, Number.parseInt(process.env.VIDEO_WORKER_POLL_MS || '2500', 10) || 2500)
const leaseMs = Math.max(60_000, Number.parseInt(process.env.VIDEO_WORKER_LEASE_MS || '180000', 10) || 180_000)
const heartbeatMs = Math.max(5_000, Math.min(30_000, Math.floor(leaseMs / 4)))
const maxAttempts = Math.max(1, Math.min(10, Number.parseInt(process.env.VIDEO_WORKER_MAX_ATTEMPTS || '4', 10) || 4))
let stopping = false
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function failExhausted(staleBefore: Date) {
  const expired = await db.videoJob.findMany({
    where: { status: 'processing', heartbeatAt: { lt: staleBefore }, attempts: { gte: maxAttempts } },
    select: { id: true, videoProjectId: true }, take: 100,
  })
  if (!expired.length) return
  await db.videoJob.updateMany({
    where: { id: { in: expired.map((j) => j.id) }, status: 'processing', heartbeatAt: { lt: staleBefore } },
    data: { status: 'failed', lockedAt: null, heartbeatAt: null, lockedBy: null, lastError: 'Worker lease expired after maximum attempts.' },
  })
  await db.videoProject.updateMany({
    where: { id: { in: expired.map((j) => j.videoProjectId) }, status: { not: 'done' } },
    data: { status: 'error', stageDetail: 'Worker kehabisan percobaan.', error: 'Worker berhenti merespons setelah batas retry.' },
  })
}
async function claimNextJob(hintedProjectId?: string | null) {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - leaseMs)
  await failExhausted(staleBefore)
  const hinted = hintedProjectId
    ? await db.videoJob.findUnique({ where: { videoProjectId: hintedProjectId } })
    : null
  const hintedIsClaimable = Boolean(hinted && hinted.attempts < maxAttempts && (
    (hinted.status === 'queued' && hinted.availableAt <= now) ||
    (hinted.status === 'processing' && (!hinted.heartbeatAt || hinted.heartbeatAt < staleBefore))
  ))
  const candidate = hintedIsClaimable ? hinted : await db.videoJob.findFirst({
    where: { attempts: { lt: maxAttempts }, OR: [
      { status: 'queued', availableAt: { lte: now } },
      { status: 'processing', heartbeatAt: { lt: staleBefore } },
    ] },
    orderBy: [{ availableAt: 'asc' }, { createdAt: 'asc' }],
  })
  if (!candidate) return null
  const where = candidate.status === 'queued'
    ? { id: candidate.id, status: 'queued', availableAt: { lte: now } }
    : { id: candidate.id, status: 'processing', heartbeatAt: candidate.heartbeatAt }
  const claimed = await db.videoJob.updateMany({
    where,
    data: { status: 'processing', attempts: { increment: 1 }, lockedAt: now, heartbeatAt: now, lockedBy: workerId, lastError: null },
  })
  if (claimed.count !== 1) return null
  return { id: candidate.id, videoProjectId: candidate.videoProjectId, attempt: candidate.attempts + 1, maxAttempts: Math.min(candidate.maxAttempts, maxAttempts) }
}
async function processJob(job: { id: string; videoProjectId: string; attempt: number; maxAttempts: number }) {
  log.info({ videoProjectId: job.videoProjectId, attempt: job.attempt, workerId }, 'video job claimed')
  await db.videoProject.updateMany({
    where: { id: job.videoProjectId, status: { not: 'done' } },
    data: { status: 'queued', stageDetail: 'Worker mengambil pekerjaan...', error: null },
  })
  const heartbeat = setInterval(() => {
    void db.videoJob.updateMany({
      where: { id: job.id, status: 'processing', lockedBy: workerId },
      data: { heartbeatAt: new Date() },
    }).then((r) => { if (!r.count) log.warn({ jobId: job.id }, 'worker lease is no longer owned') })
      .catch((e) => log.error({ jobId: job.id, err: String(e).slice(0, 180) }, 'heartbeat failed'))
  }, heartbeatMs)
  try {
    await runVideoPipeline(job.videoProjectId)
    const project = await db.videoProject.findUnique({ where: { id: job.videoProjectId }, select: { status: true } })
    if (project?.status !== 'done') throw new Error('Pipeline returned without a completed video project.')
    await db.videoJob.updateMany({
      where: { id: job.id, status: 'processing', lockedBy: workerId },
      data: { status: 'completed', completedAt: new Date(), lockedAt: null, heartbeatAt: null, lockedBy: null, lastError: null },
    })
    log.info({ videoProjectId: job.videoProjectId }, 'video job completed')
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unknown video worker error'
    const retry = job.attempt < job.maxAttempts
    const backoff = retryDelayMs(job.attempt)
    await db.videoJob.updateMany({
      where: { id: job.id, status: 'processing', lockedBy: workerId },
      data: { status: retry ? 'queued' : 'failed', availableAt: new Date(Date.now() + (retry ? backoff : 0)), lockedAt: null, heartbeatAt: null, lockedBy: null, lastError: message },
    })
    await db.videoProject.updateMany({
      where: { id: job.videoProjectId, status: { not: 'done' } },
      data: retry
        ? { status: 'queued', stageDetail: 'Gagal sementara; menunggu retry worker...', error: message }
        : { status: 'error', stageDetail: 'Worker gagal permanen.', error: message },
    })
    if (retry) {
      try { await enqueueVideoJob(job.videoProjectId) }
      catch (queueError) {
        log.warn({ videoProjectId: job.videoProjectId, err: queueError instanceof Error ? queueError.message.slice(0, 160) : 'unknown' }, 'retry hint not queued; PostgreSQL reconciliation will recover')
      }
    }
    log.error({ videoProjectId: job.videoProjectId, attempt: job.attempt, retry, err: message }, 'video job failed')
  } finally { clearInterval(heartbeat) }
}
async function main() {
  log.info({ workerId, pollMs, leaseMs, maxAttempts }, 'durable video worker started')
  let redisUnavailableLoggedAt = 0
  while (!stopping) {
    try {
      const hintedProjectId = await dequeueVideoJob(2)
      const job = await claimNextJob(hintedProjectId)
      if (job) { await processJob(job); continue }
      // Reconcile PostgreSQL even when Redis is healthy: a process may have crashed
      // between committing VideoJob and publishing its Redis wake-up hint.
      if (!hintedProjectId) {
        const recovered = await claimNextJob()
        if (recovered) { await processJob(recovered); continue }
      }
    } catch (error) {
      const now = Date.now()
      if (now - redisUnavailableLoggedAt > 30_000) {
        redisUnavailableLoggedAt = now
        log.warn({ err: error instanceof Error ? error.message.slice(0, 220) : 'unknown' }, 'Redis unavailable; processing durable PostgreSQL queue')
      }
      try {
        const recovered = await claimNextJob()
        if (recovered) { await processJob(recovered); continue }
      } catch (dbError) {
        log.error({ err: dbError instanceof Error ? dbError.message.slice(0, 220) : 'unknown' }, 'PostgreSQL fallback claim failed')
      }
      await sleep(pollMs)
    }
  }
  await closeRedisClient().catch(() => {})
  await db.$disconnect()
  log.info({ workerId }, 'video worker stopped')
}
process.on('SIGINT', () => { stopping = true })
process.on('SIGTERM', () => { stopping = true })
void main().catch(async (error) => {
  log.fatal({ err: error instanceof Error ? error.message : String(error) }, 'worker exited unexpectedly')
  await db.$disconnect().catch(() => {})
  process.exitCode = 1
})

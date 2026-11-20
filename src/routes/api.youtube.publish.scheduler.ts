import { randomUUID, timingSafeEqual } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { runYoutubePublishingBatch } from '@/lib/youtube/publishing-worker'
import { moduleLogger } from '@/lib/logger'
import { getYoutubeWorkerHealthStatus } from '@/lib/youtube/publishing-utils'
import { syncYoutubePublishingAlerts } from '@/lib/youtube/publishing-alerts'

const log = moduleLogger('youtube-publishing-scheduler')
const HEARTBEAT_KEY = 'youtube_publishing_worker_last_run'
const STALE_AFTER_MS = 15 * 60_000

type SchedulerRun = {
  runId: string
  status: 'running' | 'success' | 'error'
  startedAt: string
  completedAt?: string
  durationMs?: number
  eligible?: number
  attempted?: number
  error?: string
}

function authorized(request: Request): boolean {
  const secret = process.env.YOUTUBE_CRON_SECRET ?? process.env.CRON_SECRET
  const value = request.headers.get('authorization') ?? ''
  if (!secret || secret.length < 32 || !value.startsWith('Bearer ')) return false
  const a = Buffer.from(value.slice(7)), b = Buffer.from(secret)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function saveHeartbeat(run: SchedulerRun) {
  await db.setting.upsert({
    where: { key: HEARTBEAT_KEY },
    create: { key: HEARTBEAT_KEY, value: JSON.stringify(run) },
    update: { value: JSON.stringify(run) },
  })
}

async function getObservability() {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS)
  const [groups, staleUploads, overdueJobs, oldestDue, heartbeatSetting] = await Promise.all([
    db.youtubePublication.groupBy({ by: ['status'], _count: { _all: true } }),
    db.youtubePublication.count({
      where: { status: 'uploading', OR: [{ lockedAt: { lt: staleBefore } }, { lockedAt: null }] },
    }),
    db.youtubePublication.count({
      where: { status: 'scheduled', approvedAt: { not: null }, nextAttemptAt: { lt: staleBefore } },
    }),
    db.youtubePublication.findFirst({
      where: { status: 'scheduled', approvedAt: { not: null }, nextAttemptAt: { lt: now } },
      orderBy: { nextAttemptAt: 'asc' },
      select: { id: true, nextAttemptAt: true },
    }),
    db.setting.findUnique({ where: { key: HEARTBEAT_KEY }, select: { value: true } }),
  ])

  let lastRun: SchedulerRun | null = null
  try {
    if (heartbeatSetting?.value) lastRun = JSON.parse(heartbeatSetting.value) as SchedulerRun
  } catch {
    log.warn('Stored YouTube worker heartbeat is not valid JSON')
  }

  const lastHeartbeatAt = lastRun?.completedAt ?? lastRun?.startedAt
  const heartbeatTimestamp = lastHeartbeatAt ? new Date(lastHeartbeatAt).getTime() : null
  const schedulerAgeMs = heartbeatTimestamp === null || !Number.isFinite(heartbeatTimestamp)
    ? null
    : Math.max(0, now.getTime() - heartbeatTimestamp)
  const status = getYoutubeWorkerHealthStatus({
    staleUploads,
    overdueJobs,
    heartbeatAgeMs: schedulerAgeMs,
    lastRunStatus: lastRun?.status ?? null,
  }, STALE_AFTER_MS)

  return {
    status,
    observedAt: now.toISOString(),
    thresholds: { staleAfterSeconds: STALE_AFTER_MS / 1000 },
    queue: Object.fromEntries(groups.map(item => [item.status, item._count._all])),
    worker: {
      status,
      staleUploads,
      overdueJobs,
      oldestDueAt: oldestDue?.nextAttemptAt.toISOString() ?? null,
      oldestDuePublicationId: oldestDue?.id ?? null,
      schedulerAgeSeconds: schedulerAgeMs === null ? null : Math.floor(schedulerAgeMs / 1000),
      lastRun,
    },
  }
}

export const Route = createFileRoute('/api/youtube/publish/scheduler')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        if (!authorized(request)) return Response.json({ error: 'Unauthorized scheduler request.' }, { status: 401 })
        try {
          // External uptime monitors can call this endpoint to persist stale-heartbeat alerts
          // even when the scheduled POST worker has stopped running.
          await syncYoutubePublishingAlerts()
          const metrics = await getObservability()
          return Response.json(metrics, {
            status: metrics.status === 'ok' || metrics.status === 'running' ? 200 : 503,
            headers: { 'Cache-Control': 'no-store' },
          })
        } catch (error) {
          log.error({ err: error instanceof Error ? error.message.slice(0, 250) : 'unknown' }, 'YouTube observability query failed')
          return Response.json({ error: 'Publishing observability tidak tersedia.' }, { status: 503 })
        }
      },
      POST: async ({ request }: { request: Request }) => {
        if (!authorized(request)) return Response.json({ error: 'Unauthorized scheduler request.' }, { status: 401 })

        const runId = randomUUID()
        const startedAt = new Date()
        const base: SchedulerRun = { runId, status: 'running', startedAt: startedAt.toISOString() }
        try {
          await db.youtubeWorkerRun.create({ data: { runId, status: 'running', startedAt } })
          await saveHeartbeat(base)
          log.info({ runId }, 'YouTube scheduler invocation started')
          const batch = await runYoutubePublishingBatch(3)
          const completedAt = new Date()
          const result: SchedulerRun = {
            ...base,
            status: 'success',
            completedAt: completedAt.toISOString(),
            durationMs: completedAt.getTime() - startedAt.getTime(),
            eligible: batch.eligible,
            attempted: batch.attempted,
          }
          await db.youtubeWorkerRun.update({ where: { runId }, data: { status: 'success', completedAt, durationMs: result.durationMs, eligible: result.eligible, attempted: result.attempted } })
          await saveHeartbeat(result)
          const alertSync = await syncYoutubePublishingAlerts(completedAt).catch(error => {
            log.error({ runId, err: error instanceof Error ? error.message.slice(0, 200) : 'unknown' }, 'Persistent alert synchronization failed')
            return { usersChecked: 0, notificationsDelivered: 0 }
          })
          log.info({ ...result, ...alertSync }, 'YouTube scheduler invocation completed')
          return Response.json({ ...batch, runId, durationMs: result.durationMs }, { headers: { 'Cache-Control': 'no-store' } })
        } catch (error) {
          const message = error instanceof Error ? error.message.slice(0, 250) : 'unknown'
          const completedAt = new Date()
          await db.youtubeWorkerRun.update({ where: { runId }, data: { status: 'error', completedAt, durationMs: completedAt.getTime() - startedAt.getTime(), error: message } }).catch(saveError => {
            log.error({ runId, err: saveError instanceof Error ? saveError.message.slice(0, 200) : 'unknown' }, 'Could not persist YouTube worker run failure')
          })
          await saveHeartbeat({
            ...base,
            status: 'error',
            completedAt: completedAt.toISOString(),
            durationMs: completedAt.getTime() - startedAt.getTime(),
            error: message,
          }).catch(saveError => {
            log.error({ runId, err: saveError instanceof Error ? saveError.message.slice(0, 200) : 'unknown' }, 'Could not persist YouTube scheduler failure heartbeat')
          })
          await syncYoutubePublishingAlerts(completedAt).catch(saveError => log.error({ runId, err: saveError instanceof Error ? saveError.message.slice(0, 200) : 'unknown' }, 'Persistent alert synchronization failed after scheduler error'))
          log.error({ runId, durationMs: completedAt.getTime() - startedAt.getTime(), err: message }, 'YouTube publishing scheduler failed')
          return Response.json({ error: 'Publishing worker gagal dijalankan.', runId }, { status: 500 })
        }
      },
    },
  },
})

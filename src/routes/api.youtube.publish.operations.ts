import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { getYoutubeWorkerHealthStatus } from '@/lib/youtube/publishing-utils'

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
}

export const Route = createFileRoute('/api/youtube/publish/operations')({
  server: {
    handlers: {
      GET: async () => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })

        const now = new Date()
        const staleBefore = new Date(now.getTime() - STALE_AFTER_MS)
        const [groups, staleUploads, overdueJobs, recent, heartbeat] = await Promise.all([
          db.youtubePublication.groupBy({
            by: ['status'],
            where: { userId: session.user.id },
            _count: { _all: true },
          }),
          db.youtubePublication.count({
            where: { userId: session.user.id, status: 'uploading', OR: [{ lockedAt: { lt: staleBefore } }, { lockedAt: null }] },
          }),
          db.youtubePublication.count({
            where: { userId: session.user.id, status: 'scheduled', approvedAt: { not: null }, nextAttemptAt: { lt: staleBefore } },
          }),
          db.youtubePublication.findMany({
            where: { userId: session.user.id, OR: [{ status: 'failed' }, { status: 'uploading' }, { status: 'scheduled' }] },
            orderBy: { updatedAt: 'desc' },
            take: 12,
            select: {
              id: true, title: true, status: true, uploadAttempts: true,
              maxUploadAttempts: true, lastError: true, updatedAt: true,
              nextAttemptAt: true, channel: { select: { title: true } },
            },
          }),
          db.setting.findUnique({ where: { key: HEARTBEAT_KEY }, select: { value: true } }),
        ])

        let lastRun: SchedulerRun | null = null
        try {
          if (heartbeat?.value) {
            const parsed = JSON.parse(heartbeat.value) as SchedulerRun
            if (parsed && typeof parsed.runId === 'string' && ['running', 'success', 'error'].includes(parsed.status)) {
              lastRun = {
                runId: parsed.runId,
                status: parsed.status,
                startedAt: parsed.startedAt,
                ...(parsed.completedAt ? { completedAt: parsed.completedAt } : {}),
                ...(typeof parsed.durationMs === 'number' ? { durationMs: parsed.durationMs } : {}),
                ...(typeof parsed.eligible === 'number' ? { eligible: parsed.eligible } : {}),
                ...(typeof parsed.attempted === 'number' ? { attempted: parsed.attempted } : {}),
              }
            }
          }
        } catch {
          lastRun = null
        }

        const heartbeatAt = lastRun?.completedAt ?? lastRun?.startedAt
        const heartbeatTime = heartbeatAt ? new Date(heartbeatAt).getTime() : null
        const heartbeatAgeMs = heartbeatTime === null || !Number.isFinite(heartbeatTime)
          ? null
          : Math.max(0, now.getTime() - heartbeatTime)
        const status = getYoutubeWorkerHealthStatus({
          staleUploads,
          overdueJobs,
          heartbeatAgeMs,
          lastRunStatus: lastRun?.status ?? null,
        }, STALE_AFTER_MS)

        const queue = Object.fromEntries(groups.map(group => [group.status, group._count._all]))
        const alerts: Array<{ id: string; severity: 'critical' | 'warning'; title: string; detail: string }> = []
        if (status === 'unknown') alerts.push({ id: 'worker-unknown', severity: 'warning', title: 'Worker belum memiliki heartbeat', detail: 'Jalankan scheduler dan pastikan job terjadwal aktif.' })
        if (status === 'degraded') alerts.push({ id: 'worker-degraded', severity: 'critical', title: 'Worker membutuhkan pemeriksaan', detail: 'Periksa heartbeat, lease upload, dan antrean yang terlambat.' })
        if (staleUploads > 0) alerts.push({ id: 'stale-uploads', severity: 'critical', title: 'Upload terindikasi macet', detail: staleUploads + ' publikasi memiliki lease lebih tua dari 15 menit.' })
        if (overdueJobs > 0) alerts.push({ id: 'overdue-jobs', severity: 'warning', title: 'Antrean melewati batas waktu', detail: overdueJobs + ' publikasi terjadwal terlambat lebih dari 15 menit.' })
        const exhausted = recent.filter(item => item.status === 'failed' && item.uploadAttempts >= item.maxUploadAttempts).length
        if (exhausted > 0) alerts.push({ id: 'retry-exhausted', severity: 'warning', title: 'Batas retry tercapai', detail: exhausted + ' publikasi gagal telah menghabiskan seluruh percobaan.' })

        return Response.json({
          observedAt: now.toISOString(),
          status,
          queue,
          worker: {
            staleUploads,
            overdueJobs,
            heartbeatAgeSeconds: heartbeatAgeMs === null ? null : Math.floor(heartbeatAgeMs / 1000),
            lastRun,
          },
          alerts,
          recentActivity: recent.map(item => ({
            id: item.id,
            title: item.title,
            channel: item.channel.title,
            status: item.status,
            attempts: item.uploadAttempts,
            maxAttempts: item.maxUploadAttempts,
            lastError: item.lastError,
            updatedAt: item.updatedAt.toISOString(),
            nextAttemptAt: item.nextAttemptAt.toISOString(),
          })),
        }, { headers: { 'Cache-Control': 'private, no-store' } })
      },
    },
  },
})

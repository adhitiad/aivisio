import { db } from '@/lib/db'
import { getYoutubeWorkerHealthStatus } from '@/lib/youtube/publishing-utils'

const STALE_AFTER_MS = 15 * 60_000

type AlertInput = { fingerprint: string; severity: 'critical' | 'warning'; title: string; detail: string }

export async function syncYoutubePublishingAlerts(now = new Date()) {
  const staleBefore = new Date(now.getTime() - STALE_AFTER_MS)
  const [users, heartbeat] = await Promise.all([
    db.user.findMany({
      where: { youtubePublications: { some: {} } },
      select: { id: true },
    }),
    db.setting.findUnique({ where: { key: 'youtube_publishing_worker_last_run' }, select: { value: true } }),
  ])

  let lastRun: { status?: string; startedAt?: string; completedAt?: string } | null = null
  try {
    if (heartbeat?.value) lastRun = JSON.parse(heartbeat.value)
  } catch {
    lastRun = null
  }

  const heartbeatAt = lastRun?.completedAt ?? lastRun?.startedAt
  const heartbeatTime = heartbeatAt ? new Date(heartbeatAt).getTime() : null
  const heartbeatAgeMs = heartbeatTime === null || !Number.isFinite(heartbeatTime)
    ? null
    : Math.max(0, now.getTime() - heartbeatTime)
  const delivered: string[] = []

  for (const user of users) {
    const [staleUploads, overdueJobs, exhausted] = await Promise.all([
      db.youtubePublication.count({
        where: { userId: user.id, status: 'uploading', OR: [{ lockedAt: { lt: staleBefore } }, { lockedAt: null }] },
      }),
      db.youtubePublication.count({
        where: { userId: user.id, status: 'scheduled', approvedAt: { not: null }, nextAttemptAt: { lt: staleBefore } },
      }),
      db.youtubePublication.count({
        where: { userId: user.id, status: 'failed', uploadAttempts: { gte: 1 }, },
      }),
    ])
    const health = getYoutubeWorkerHealthStatus({
      staleUploads,
      overdueJobs,
      heartbeatAgeMs,
      lastRunStatus: lastRun?.status === 'running' || lastRun?.status === 'success' || lastRun?.status === 'error'
        ? lastRun.status
        : null,
    }, STALE_AFTER_MS)

    const desired: AlertInput[] = []
    if (health === 'unknown') desired.push({ fingerprint: 'worker-heartbeat-missing', severity: 'warning', title: 'Worker belum memiliki heartbeat', detail: 'Belum ada eksekusi scheduler yang tercatat. Pastikan job scheduler berjalan.' })
    if (health === 'degraded') desired.push({ fingerprint: 'worker-health-degraded', severity: 'critical', title: 'Worker membutuhkan pemeriksaan', detail: 'Status worker degraded. Periksa heartbeat, lease upload, dan antrean terjadwal.' })
    if (staleUploads > 0) desired.push({ fingerprint: 'stale-upload-leases', severity: 'critical', title: 'Upload terindikasi macet', detail: staleUploads + ' publikasi memiliki lease lebih tua dari 15 menit.' })
    if (overdueJobs > 0) desired.push({ fingerprint: 'overdue-scheduled-publications', severity: 'warning', title: 'Antrean publikasi terlambat', detail: overdueJobs + ' publikasi melewati batas keterlambatan 15 menit.' })
    if (exhausted > 0) desired.push({ fingerprint: 'failed-publications', severity: 'warning', title: 'Publikasi gagal', detail: exhausted + ' publikasi berstatus gagal dan memerlukan pemeriksaan.' })

    const active = await db.youtubePublishingAlert.findMany({
      where: { userId: user.id, status: 'active' },
      select: { id: true, fingerprint: true },
    })
    const desiredKeys = new Set(desired.map(alert => alert.fingerprint))

    for (const alert of desired) {
      await db.$transaction(async tx => {
        const existing = await tx.youtubePublishingAlert.findUnique({
          where: { userId_fingerprint: { userId: user.id, fingerprint: alert.fingerprint } },
        })
        const wasInactive = !existing || existing.status !== 'active'
        const saved = await tx.youtubePublishingAlert.upsert({
          where: { userId_fingerprint: { userId: user.id, fingerprint: alert.fingerprint } },
          create: {
            userId: user.id, ...alert, status: 'active',
            firstSeenAt: now, lastSeenAt: now,
          },
          update: {
            severity: alert.severity, title: alert.title, detail: alert.detail,
            status: 'active', lastSeenAt: now, resolvedAt: null,
          },
        })
        if (wasInactive) {
          const dedupeKey = 'youtube-publishing-alert:' + saved.id + ':' + now.getTime()
          const notification = await tx.notification.upsert({
            where: { dedupeKey },
            create: {
              userId: user.id, dedupeKey,
              title: alert.title, body: alert.detail,
              type: alert.severity === 'critical' ? 'error' : 'warning',
              link: '/dashboard/publishing',
            },
            update: {},
            select: { id: true },
          })
          await tx.youtubePublishingAlert.update({
            where: { id: saved.id },
            data: { notificationId: notification.id },
          })
          delivered.push(saved.id)
        }
      })
    }

    for (const previous of active) {
      if (!desiredKeys.has(previous.fingerprint)) {
        await db.youtubePublishingAlert.updateMany({
          where: { id: previous.id, userId: user.id, status: 'active' },
          data: { status: 'resolved', resolvedAt: now },
        })
      }
    }
  }

  return { usersChecked: users.length, notificationsDelivered: delivered.length }
}

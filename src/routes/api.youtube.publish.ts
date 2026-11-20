import { randomUUID } from 'node:crypto'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'
import { rateLimit } from '@/lib/rate-limit'
import { getYoutubeAccessToken } from '@/lib/youtube/oauth'
import { headObject } from '@/lib/storage/neon-object-storage'
import { isYoutubeChannelOwned, isYoutubeObjectReady, isYoutubeScheduleValid } from '@/lib/youtube/publishing-utils'

const UPLOAD_SCOPE = 'https://www.googleapis.com/auth/youtube.upload'
const preflightSchema = z.object({
  action: z.literal('preflight'),
  channelId: z.string().min(1).max(80),
  videoProjectId: z.string().min(1).max(80),
})
const schema = z.object({
  channelId: z.string().min(1).max(80),
  videoProjectId: z.string().min(1).max(80),
  title: z.string().trim().min(1).max(100),
  description: z.string().max(5000).default(''),
  tags: z.array(z.string().trim().min(1).max(100)).max(30).default([]),
  privacyStatus: z.enum(['private', 'unlisted', 'public']).default('private'),
  scheduledAt: z.string().datetime({ offset: true }).optional(),
})

export const Route = createFileRoute('/api/youtube/publish')({
  server: { handlers: {
    GET: async () => {
      const session = await getApiSession()
      if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })

      const [items, channels, projects] = await Promise.all([
        db.youtubePublication.findMany({
          where: { userId: session.user.id },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: {
            id: true, channelId: true, videoProjectId: true, status: true, title: true,
            privacyStatus: true, scheduledAt: true, approvedAt: true, youtubeVideoId: true,
            publishedAt: true, uploadOffset: true, uploadAttempts: true, maxUploadAttempts: true,
            nextAttemptAt: true, lastError: true, createdAt: true,
            channel: { select: { title: true } },
            videoProject: { select: { topic: true, fileBytes: true } },
          },
        }),
        db.youtubeChannel.findMany({
          where: { userId: session.user.id, connectionStatus: 'connected', oauthConnection: { is: { connectionStatus: 'connected', scopes: { contains: UPLOAD_SCOPE } } } },
          orderBy: { title: 'asc' },
          select: { id: true, title: true, thumbnailUrl: true },
        }),
        db.videoProject.findMany({
          where: { userId: session.user.id, status: 'done', fileObjectKey: { not: null }, fileBytes: { gt: 0 } },
          orderBy: { createdAt: 'desc' },
          take: 50,
          select: { id: true, topic: true, title: true, fileBytes: true, createdAt: true },
        }),
      ])

      return Response.json({
        items: items.map(x => ({ ...x, uploadOffset: x.uploadOffset.toString() })),
        channels,
        projects,
      }, { headers: { 'Cache-Control': 'private, no-store' } })
    },

    POST: async ({ request }: { request: Request }) => {
      const denied = sameOriginGuard(request)
      if (denied) return denied
      const session = await getApiSession()
      if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
      if (!rateLimit('youtube-publish-create:' + session.user.id, 10, 3600000)) {
        return Response.json({ error: 'Batas pembuatan publikasi tercapai.' }, { status: 429 })
      }

      const raw = await request.text()
      if (new TextEncoder().encode(raw).byteLength > 12_000) return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
      let body: unknown
      try { body = JSON.parse(raw) } catch { return Response.json({ error: 'Body JSON tidak valid.' }, { status: 400 }) }
      if (typeof body === 'object' && body !== null && 'action' in body && body.action === 'preflight') {
        const preflight = preflightSchema.safeParse(body)
        if (!preflight.success) return Response.json({ error: 'Parameter preflight tidak valid.' }, { status: 400 })

        const [channel, project] = await Promise.all([
          db.youtubeChannel.findFirst({
            where: { id: preflight.data.channelId, userId: session.user.id, connectionStatus: 'connected' },
            include: { oauthConnection: true },
          }),
          db.videoProject.findFirst({
            where: { id: preflight.data.videoProjectId, userId: session.user.id, status: 'done', fileObjectKey: { not: null }, fileBytes: { gt: 0 } },
            select: { id: true, fileObjectKey: true, fileBytes: true },
          }),
        ])
        if (!channel || !channel.oauthConnection || channel.oauthConnection.connectionStatus !== 'connected') {
          return Response.json({ ready: false, error: 'Channel YouTube tidak terhubung.' }, { status: 404 })
        }
        if (!project?.fileObjectKey || !project.fileBytes) {
          return Response.json({ ready: false, error: 'Video selesai dan file Object Storage tidak ditemukan.' }, { status: 409 })
        }
        if (!channel.oauthConnection.scopes.split(/\s+/).includes(UPLOAD_SCOPE)) {
          return Response.json({ ready: false, error: 'Izin youtube.upload belum diberikan. Hubungkan ulang akun Google.' }, { status: 403 })
        }

        try {
          const accessToken = await getYoutubeAccessToken(channel.oauthConnection)
          const channelIds: string[] = []
          let pageToken: string | undefined
          for (let page = 0; page < 5; page++) {
            const url = new URL('https://www.googleapis.com/youtube/v3/channels')
            url.searchParams.set('part', 'id')
            url.searchParams.set('mine', 'true')
            url.searchParams.set('maxResults', '50')
            if (pageToken) url.searchParams.set('pageToken', pageToken)
            const response = await fetch(url, {
              headers: { Authorization: 'Bearer ' + accessToken, Accept: 'application/json' },
              redirect: 'error',
              cache: 'no-store',
              signal: AbortSignal.timeout(15_000),
            })
            if (!response.ok) {
              return Response.json({ ready: false, error: response.status === 401 ? 'Token Google perlu dihubungkan ulang.' : 'Google YouTube API gagal memverifikasi channel.' }, { status: response.status === 401 ? 401 : 502 })
            }
            const payload = await response.json().catch(() => null) as { items?: Array<{ id?: string }>; nextPageToken?: string } | null
            channelIds.push(...(payload?.items ?? []).map(item => item.id).filter((id): id is string => Boolean(id)))
            pageToken = payload?.nextPageToken
            if (!pageToken) break
          }
          if (!isYoutubeChannelOwned(channelIds, channel.youtubeChannelId)) {
            return Response.json({ ready: false, error: 'Channel yang dipilih tidak ditemukan pada akun Google yang terhubung.' }, { status: 409 })
          }

          const object = await headObject(project.fileObjectKey, 30_000)
          if (!isYoutubeObjectReady(project.fileBytes, object?.size ?? null)) {
            return Response.json({ ready: false, error: 'Ukuran file Object Storage tidak cocok dengan data proyek.' }, { status: 409 })
          }

          return Response.json({
            ready: true,
            checks: { oauthToken: 'ok', uploadScope: 'ok', channelOwnership: 'ok', objectStorage: 'ok' },
            message: 'Prasyarat upload YouTube tervalidasi. Belum ada video yang diunggah.',
          }, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Preflight gagal.'
          return Response.json({ ready: false, error: message.slice(0, 250) }, { status: 502 })
        }
      }

      const parsed = schema.safeParse(body)
      if (!parsed.success) return Response.json({ error: 'Metadata publikasi tidak valid.', issues: parsed.error.flatten() }, { status: 400 })

      const input = parsed.data
      if (input.scheduledAt && (!isYoutubeScheduleValid(new Date(input.scheduledAt)) || input.privacyStatus !== 'private')) {
        return Response.json({ error: 'Jadwal minimal 10 menit ke depan dan hanya mendukung privacy private.' }, { status: 400 })
      }

      const [channel, project] = await Promise.all([
        db.youtubeChannel.findFirst({
          where: { id: input.channelId, userId: session.user.id, connectionStatus: 'connected' },
          select: { id: true, oauthConnection: { select: { connectionStatus: true, scopes: true } } },
        }),
        db.videoProject.findFirst({
          where: { id: input.videoProjectId, userId: session.user.id, status: 'done', fileObjectKey: { not: null }, fileBytes: { gt: 0 } },
          select: { id: true },
        }),
      ])
      if (!channel || channel.oauthConnection?.connectionStatus !== 'connected') {
        return Response.json({ error: 'Channel YouTube tidak terhubung.' }, { status: 404 })
      }
      if (!channel.oauthConnection.scopes.split(/\s+/).includes(UPLOAD_SCOPE)) {
        return Response.json({ error: 'Izin youtube.upload belum diberikan. Hubungkan ulang akun Google.' }, { status: 403 })
      }
      if (!project) return Response.json({ error: 'Video harus selesai diproses dan merupakan milik akun ini.' }, { status: 409 })

      try {
        const result = await db.$transaction(async (tx) => {
          const active = await tx.youtubePublication.findFirst({
            where: { userId: session.user.id, channelId: channel.id, videoProjectId: project.id, status: { in: ['pending_approval', 'scheduled', 'uploading', 'published'] } },
            select: { id: true },
          })
          if (active) return { active, publication: null }
          const publication = await tx.youtubePublication.create({
            data: {
              userId: session.user.id, channelId: channel.id, videoProjectId: project.id,
              idempotencyKey: randomUUID(), title: input.title, description: input.description,
              tags: JSON.stringify(input.tags), privacyStatus: input.privacyStatus,
              scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : null,
            },
            select: { id: true, status: true, title: true, scheduledAt: true, createdAt: true },
          })
          return { active: null, publication }
        }, { isolationLevel: 'Serializable' })

        if (result.active) return Response.json({ error: 'Video ini sudah memiliki publikasi aktif.', publication: result.active }, { status: 409 })
        return Response.json({ publication: result.publication }, { status: 201, headers: { 'Cache-Control': 'no-store' } })
      } catch (error) {
        const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''
        if (code === 'P2034' || code === 'P2002') {
          return Response.json({ error: 'Publikasi duplikat terdeteksi. Muat ulang daftar publikasi.' }, { status: 409 })
        }
        throw error
      }
    },

    PATCH: async ({ request }: { request: Request }) => {
      const denied = sameOriginGuard(request)
      if (denied) return denied
      const session = await getApiSession()
      if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
      if (!rateLimit('youtube-publish-action:' + session.user.id, 30, 60_000)) {
        return Response.json({ error: 'Terlalu banyak aksi publikasi. Coba kembali sebentar lagi.' }, { status: 429 })
      }

      const body = await request.json().catch(() => null) as { id?: string; action?: string } | null
      if (!body?.id || body.id.length > 80 || !['approve', 'cancel', 'retry'].includes(body.action ?? '')) {
        return Response.json({ error: 'Aksi publikasi tidak valid.' }, { status: 400 })
      }

      if (body.action === 'approve') {
        const pending = await db.youtubePublication.findFirst({
          where: { id: body.id, userId: session.user.id, status: 'pending_approval', approvedAt: null },
          select: { scheduledAt: true },
        })
        if (!pending) return Response.json({ error: 'Publikasi tidak ditemukan atau sudah diproses.' }, { status: 409 })
        const approvedAt = new Date()
        if (!isYoutubeScheduleValid(pending.scheduledAt, approvedAt.getTime())) {
          return Response.json({ error: 'Waktu jadwal sudah lewat atau kurang dari 10 menit. Batalkan publikasi ini dan buat jadwal baru.' }, { status: 409 })
        }
        const result = await db.youtubePublication.updateMany({
          where: { id: body.id, userId: session.user.id, status: 'pending_approval', approvedAt: null },
          data: { status: 'scheduled', approvedAt, approvedBy: session.user.id, nextAttemptAt: approvedAt },
        })
        return result.count ? Response.json({ success: true, status: 'scheduled' }) : Response.json({ error: 'Publikasi sudah diproses oleh permintaan lain.' }, { status: 409 })
      }

      if (body.action === 'retry') {
        const result = await db.youtubePublication.updateMany({
          where: { id: body.id, userId: session.user.id, status: 'failed', approvedAt: { not: null }, youtubeVideoId: null },
          data: { status: 'scheduled', nextAttemptAt: new Date(), lastError: null, uploadAttempts: 0, uploadOffset: 0n, uploadSessionUriEncrypted: null, lockedAt: null, lockedBy: null },
        })
        return result.count ? Response.json({ success: true, status: 'scheduled' }) : Response.json({ error: 'Publikasi tidak dapat dicoba ulang.' }, { status: 409 })
      }

      const result = await db.youtubePublication.updateMany({
        where: { id: body.id, userId: session.user.id, status: { in: ['pending_approval', 'scheduled', 'failed'] } },
        data: { status: 'cancelled', lockedAt: null, lockedBy: null },
      })
      return result.count ? Response.json({ success: true, status: 'cancelled' }) : Response.json({ error: 'Publikasi tidak dapat dibatalkan.' }, { status: 409 })
    },
  } },
})

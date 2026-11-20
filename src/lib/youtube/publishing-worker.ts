import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { getYoutubeAccessToken } from '@/lib/youtube/oauth'
import { decryptYoutubeToken, encryptYoutubeToken } from '@/lib/youtube/token-crypto'
import { getObject, headObject } from '@/lib/storage/neon-object-storage'
import { moduleLogger } from '@/lib/logger'
import { parseYoutubeUploadOffset, calculateYoutubeRetryDelay, isYoutubeUploadAttemptExhausted, hasYoutubeUploadAttemptsRemaining, isYoutubeScheduleValid } from '@/lib/youtube/publishing-utils'

const log = moduleLogger('youtube-publisher')
const API = 'https://www.googleapis.com/upload/youtube/v3/videos'
const CHUNK = 8 * 1024 * 1024
const LEASE_STALE_MS = 15 * 60 * 1000
const MAX_BATCH = 10
const workerId = 'youtube-publisher-' + randomUUID()

class YoutubeUploadError extends Error {
  constructor(message: string, readonly retryable: boolean) {
    super(message)
    this.name = 'YoutubeUploadError'
  }
}

type UploadResult = { id?: string }

async function responseError(response: Response): Promise<YoutubeUploadError> {
  const detail = (await response.text().catch(() => '')).slice(0, 350)
  const message = ('YouTube API HTTP ' + response.status + ': ' + detail).slice(0, 500)
  return new YoutubeUploadError(message, response.status === 408 || response.status === 429 || response.status >= 500)
}



async function markPublished(id: string, youtubeVideoId: string, total: number) {
  if (!youtubeVideoId || youtubeVideoId.length > 128) {
    throw new YoutubeUploadError('Respons final YouTube tidak memiliki video ID yang valid.', true)
  }
  const result = await db.youtubePublication.updateMany({
    where: { id, status: 'uploading', lockedBy: workerId, youtubeVideoId: null },
    data: {
      status: 'published',
      youtubeVideoId,
      publishedAt: new Date(),
      uploadOffset: BigInt(total),
      uploadSessionUriEncrypted: null,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
    },
  })
  if (result.count !== 1) throw new Error('Lease publikasi hilang sebelum status tersimpan.')
  log.info({ publicationId: id, youtubeVideoId, totalBytes: total, workerId }, 'YouTube upload completed')
}

async function probeSession(uri: string, token: string, total: number): Promise<{ offset: number; completedId?: string }> {
  let response: Response
  try {
    response = await fetch(uri, {
      method: 'PUT',
      headers: {
        Authorization: 'Bearer ' + token,
        'Content-Length': '0',
        'Content-Range': 'bytes */' + total,
      },
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new YoutubeUploadError('Tidak dapat memeriksa status resumable session YouTube.', true)
  }

  if (response.status === 308) return { offset: parseYoutubeUploadOffset(response.headers.get('range'), total) }
  if (response.status === 200 || response.status === 201) {
    const result = await response.json().catch(() => null) as UploadResult | null
    if (!result?.id) throw new YoutubeUploadError('YouTube menyatakan upload selesai tetapi video ID tidak tersedia.', true)
    return { offset: total, completedId: result.id }
  }
  if (response.status === 404 || response.status === 410) {
    throw new YoutubeUploadError('Resumable session YouTube sudah tidak berlaku. Periksa YouTube Studio sebelum membuat upload baru untuk menghindari duplikasi.', false)
  }
  throw await responseError(response)
}

async function uploadOne(id: string, now = new Date()): Promise<boolean> {
  const staleBefore = new Date(now.getTime() - LEASE_STALE_MS)
  const claim = await db.youtubePublication.updateMany({
    where: {
      id,
      approvedAt: { not: null },
      youtubeVideoId: null,
      OR: [
        { status: 'scheduled', nextAttemptAt: { lte: now },  },
        { status: 'uploading', OR: [{ lockedAt: { lt: staleBefore } }, { lockedAt: null }] },
      ],
    },
    data: {
      status: 'uploading',
      lockedAt: now,
      lockedBy: workerId,
      lastAttemptAt: now,
      uploadAttempts: { increment: 1 },
      lastError: null,
    },
  })
  if (claim.count !== 1) return false
  log.info({ publicationId: id, workerId }, 'YouTube publication lease claimed')

  try {
    const item = await db.youtubePublication.findUnique({ where: { id } })
    if (!item || item.status !== 'uploading' || item.lockedBy !== workerId) return true

    if (!isYoutubeScheduleValid(item.scheduledAt)) {
      throw new YoutubeUploadError('Waktu jadwal sudah lewat atau kurang dari 10 menit. Batalkan dan buat publikasi dengan jadwal baru.', false)
    }

    if (isYoutubeUploadAttemptExhausted(item.uploadAttempts, item.maxUploadAttempts)) {
      await db.youtubePublication.updateMany({
        where: { id, status: 'uploading', lockedBy: workerId },
        data: {
          status: 'failed',
          lastError: 'Batas maksimum percobaan upload telah tercapai.',
          lockedAt: null,
          lockedBy: null,
        },
      })
      return true
    }

    const [connection, project, channel] = await Promise.all([
      db.youtubeOAuthConnection.findFirst({ where: { userId: item.userId, connectionStatus: 'connected' } }),
      db.videoProject.findFirst({
        where: { id: item.videoProjectId, userId: item.userId, status: 'done' },
        select: { fileObjectKey: true, fileBytes: true },
      }),
      db.youtubeChannel.findFirst({
        where: { id: item.channelId, userId: item.userId },
        select: { youtubeChannelId: true },
      }),
    ])
    if (!connection || !project?.fileObjectKey || !project.fileBytes || !channel) {
      throw new YoutubeUploadError('Koneksi YouTube atau file video tidak tersedia.', false)
    }
    if (!connection.scopes.split(/\s+/).includes('https://www.googleapis.com/auth/youtube.upload')) {
      throw new YoutubeUploadError('Izin youtube.upload belum diberikan; hubungkan ulang akun.', false)
    }

    const head = await headObject(project.fileObjectKey, 30_000)
    if (!head || head.size !== project.fileBytes) {
      throw new YoutubeUploadError('Ukuran file tidak cocok dengan Object Storage.', false)
    }

    const token = await getYoutubeAccessToken(connection)
    let uri = item.uploadSessionUriEncrypted
      ? decryptYoutubeToken(item.uploadSessionUriEncrypted)
      : null
    let offset = Number(item.uploadOffset)

    if (!Number.isSafeInteger(offset) || offset < 0 || offset > head.size) {
      throw new YoutubeUploadError('Upload offset tersimpan tidak valid.', false)
    }

    if (!uri) {
      const metadata = {
        snippet: {
          title: item.title,
          description: item.description,
          tags: JSON.parse(item.tags) as string[],
          categoryId: '22',
        },
        status: {
          privacyStatus: item.privacyStatus,
          ...(item.scheduledAt ? { publishAt: item.scheduledAt.toISOString() } : {}),
          selfDeclaredMadeForKids: false,
        },
      }
      const init = await fetch(API + '?uploadType=resumable&part=snippet,status', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + token,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': 'video/mp4',
          'X-Upload-Content-Length': String(head.size),
        },
        body: JSON.stringify(metadata),
        redirect: 'error',
        cache: 'no-store',
        signal: AbortSignal.timeout(30_000),
      })
      if (!init.ok) throw await responseError(init)
      uri = init.headers.get('location')
      if (!uri || !uri.startsWith('https://www.googleapis.com/upload/youtube/')) {
        throw new YoutubeUploadError('Resumable upload URI Google tidak valid.', false)
      }
      const savedSession = await db.youtubePublication.updateMany({
        where: { id, status: 'uploading', lockedBy: workerId },
        data: { uploadSessionUriEncrypted: encryptYoutubeToken(uri), uploadOffset: 0n, lockedAt: new Date() },
      })
      if (savedSession.count !== 1) throw new Error('Lease publikasi hilang sebelum sesi upload tersimpan.')
      offset = 0
    } else {
      // Google is the source of truth after a crash or a lost chunk response.
      const probe = await probeSession(uri, token, head.size)
      offset = probe.offset
      const reconciled = await db.youtubePublication.updateMany({
        where: { id, status: 'uploading', lockedBy: workerId },
        data: { uploadOffset: BigInt(offset), lockedAt: new Date() },
      })
      if (reconciled.count !== 1) throw new Error('Lease publikasi hilang saat rekonsiliasi offset.')
      if (probe.completedId) {
        await markPublished(id, probe.completedId, head.size)
        return true
      }
    }

    while (offset < head.size) {
      const end = Math.min(offset + CHUNK, head.size) - 1
      const object = await getObject(project.fileObjectKey, 'bytes=' + offset + '-' + end, 180_000)
      if (!object || object.status !== 206) {
        throw new YoutubeUploadError('Gagal membaca chunk dari Object Storage.', true)
      }
      const bytes = new Uint8Array(await object.arrayBuffer())
      if (bytes.byteLength !== end - offset + 1) {
        throw new YoutubeUploadError('Ukuran chunk Object Storage tidak sesuai.', false)
      }

      let response: Response
      try {
        response = await fetch(uri, {
          method: 'PUT',
          headers: {
            Authorization: 'Bearer ' + token,
            'Content-Type': 'video/mp4',
            'Content-Length': String(bytes.byteLength),
            'Content-Range': 'bytes ' + offset + '-' + end + '/' + head.size,
          },
          body: bytes,
          redirect: 'error',
          cache: 'no-store',
          signal: AbortSignal.timeout(180_000),
        })
      } catch {
        // The next attempt probes Google's acknowledged Range before sending bytes again.
        throw new YoutubeUploadError('Koneksi terputus saat mengirim chunk. Offset akan direkonsiliasi pada retry.', true)
      }

      if (response.status === 308) {
        const acknowledged = parseYoutubeUploadOffset(response.headers.get('range'), head.size)
        if (acknowledged <= offset) {
          throw new YoutubeUploadError('YouTube belum mengakui progres chunk. Upload dijadwalkan ulang.', true)
        }
        offset = acknowledged
        const heartbeat = await db.youtubePublication.updateMany({
          where: { id, status: 'uploading', lockedBy: workerId, youtubeVideoId: null },
          data: { uploadOffset: BigInt(offset), lockedAt: new Date() },
        })
        if (heartbeat.count !== 1) throw new Error('Lease publikasi hilang saat upload berlangsung.')
        continue
      }

      if (!response.ok) throw await responseError(response)
      const result = await response.json().catch(() => null) as UploadResult | null
      if (!result?.id) throw new YoutubeUploadError('Respons final YouTube tidak memiliki video ID.', true)
      await markPublished(id, result.id, head.size)
      return true
    }

    // A status probe is required before treating a full offset as completed.
    const finalProbe = await probeSession(uri, token, head.size)
    if (finalProbe.completedId) {
      await markPublished(id, finalProbe.completedId, head.size)
      return true
    }
    throw new YoutubeUploadError('Seluruh byte telah dikirim tetapi YouTube belum mengonfirmasi video final.', true)
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 450) : 'Unknown YouTube upload error'
    const retryable = error instanceof YoutubeUploadError ? error.retryable : true
    const current = await db.youtubePublication.findUnique({
      where: { id },
      select: { uploadAttempts: true, maxUploadAttempts: true },
    }).catch(() => null)
    const attemptsLeft = current ? current.uploadAttempts < current.maxUploadAttempts : false
    const shouldRetry = retryable && attemptsLeft
    const retryAt = new Date(Date.now() + calculateYoutubeRetryDelay(current?.uploadAttempts ?? 1))

    await db.youtubePublication.updateMany({
      where: { id, status: 'uploading', lockedBy: workerId },
      data: {
        status: shouldRetry ? 'scheduled' : 'failed',
        nextAttemptAt: shouldRetry ? retryAt : new Date(),
        lastError: message,
        lockedAt: null,
        lockedBy: null,
      },
    })
    log.error({ publicationId: id, workerId, retryable, attempt: current?.uploadAttempts ?? null, maxAttempts: current?.maxUploadAttempts ?? null, retryAt: shouldRetry ? retryAt.toISOString() : null, err: message }, 'YouTube upload attempt failed')
  }
  return true
}

export async function runYoutubePublishingBatch(limit = 3) {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - LEASE_STALE_MS)
  const rows = await db.youtubePublication.findMany({
    where: {
      approvedAt: { not: null },
      youtubeVideoId: null,
      OR: [
        { status: 'scheduled', nextAttemptAt: { lte: now } },
        { status: 'uploading', OR: [{ lockedAt: { lt: staleBefore } }, { lockedAt: null }] },
      ],
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    take: MAX_BATCH * 10,
    select: { id: true, status: true, uploadAttempts: true, maxUploadAttempts: true },
  })

  let attempted = 0
  const batchLimit = Math.max(1, Math.min(MAX_BATCH, limit))
  log.info({ workerId, eligible: rows.length, batchLimit, staleLeaseCandidates: rows.filter(row => row.status === 'uploading').length }, 'YouTube publishing batch started')
  for (const row of rows) {
    if (attempted >= batchLimit) break
    if (!hasYoutubeUploadAttemptsRemaining(row.uploadAttempts, row.maxUploadAttempts)) {
      await db.youtubePublication.updateMany({
        where: { id: row.id, status: row.status, uploadAttempts: row.uploadAttempts, youtubeVideoId: null },
        data: {
          status: 'failed',
          lastError: 'Batas maksimum percobaan upload telah tercapai.',
          lockedAt: null,
          lockedBy: null,
        },
      })
      continue
    }
    if (await uploadOne(row.id, now)) attempted++
  }
  const result = { eligible: rows.length, attempted, completedAt: new Date().toISOString(), workerId }
  log.info({ ...result, durationMs: Date.now() - now.getTime() }, 'YouTube publishing batch completed')
  return result
}

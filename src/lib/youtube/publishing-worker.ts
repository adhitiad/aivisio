import { randomUUID } from 'node:crypto'
import { db } from '@/lib/db'
import { getYoutubeAccessToken } from '@/lib/youtube/oauth'
import { decryptYoutubeToken, encryptYoutubeToken } from '@/lib/youtube/token-crypto'
import { getObject, headObject } from '@/lib/storage/neon-object-storage'
import { moduleLogger } from '@/lib/logger'
const log = moduleLogger('youtube-publisher')
const API = 'https://www.googleapis.com/upload/youtube/v3/videos'
const CHUNK = 8 * 1024 * 1024
const workerId = 'youtube-publisher-' + randomUUID()
async function errorText(response: Response) { return ('YouTube API HTTP ' + response.status + ': ' + (await response.text().catch(() => '')).slice(0, 350)).slice(0, 500) }
async function uploadOne(id: string) {
  const item = await db.youtubePublication.findFirst({ where: { id, status: 'scheduled', approvedAt: { not: null }, youtubeVideoId: null } })
  if (!item) return
  const claim = await db.youtubePublication.updateMany({ where: { id, status: 'scheduled', approvedAt: { not: null }, youtubeVideoId: null }, data: { status: 'uploading', lockedAt: new Date(), lockedBy: workerId, uploadAttempts: { increment: 1 }, lastError: null } })
  if (claim.count !== 1) return
  try {
    const [connection, project, channel] = await Promise.all([
      db.youtubeOAuthConnection.findFirst({ where: { userId: item.userId, connectionStatus: 'connected' } }),
      db.videoProject.findFirst({ where: { id: item.videoProjectId, userId: item.userId, status: 'done' }, select: { fileObjectKey: true, fileBytes: true } }),
      db.youtubeChannel.findFirst({ where: { id: item.channelId, userId: item.userId }, select: { youtubeChannelId: true } }),
    ])
    if (!connection || !project?.fileObjectKey || !project.fileBytes || !channel) throw new Error('Koneksi YouTube atau file video tidak tersedia.')
    if (!connection.scopes.split(/\s+/).includes('https://www.googleapis.com/auth/youtube.upload')) throw new Error('Izin youtube.upload belum diberikan; hubungkan ulang akun.')
    const head = await headObject(project.fileObjectKey)
    if (!head || head.size !== project.fileBytes) throw new Error('Ukuran file tidak cocok dengan Object Storage.')
    const token = await getYoutubeAccessToken(connection)
    let uri = item.uploadSessionUriEncrypted ? decryptYoutubeToken(item.uploadSessionUriEncrypted) : null
    if (!uri) {
      const metadata = { snippet: { title: item.title, description: item.description, tags: JSON.parse(item.tags) as string[], categoryId: '22' }, status: { privacyStatus: item.privacyStatus, ...(item.scheduledAt ? { publishAt: item.scheduledAt.toISOString() } : {}), selfDeclaredMadeForKids: false } }
      const init = await fetch(API + '?uploadType=resumable&part=snippet,status', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': 'video/mp4', 'X-Upload-Content-Length': String(head.size) }, body: JSON.stringify(metadata), redirect: 'error', signal: AbortSignal.timeout(30000) })
      if (!init.ok) throw new Error(await errorText(init))
      uri = init.headers.get('location')
      if (!uri || !uri.startsWith('https://www.googleapis.com/upload/youtube/')) throw new Error('Resumable upload URI Google tidak valid.')
      await db.youtubePublication.update({ where: { id }, data: { uploadSessionUriEncrypted: encryptYoutubeToken(uri), uploadOffset: 0n } })
    }
    let offset = Number(item.uploadOffset)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > head.size) throw new Error('Upload offset tidak valid.')
    while (offset < head.size) {
      const end = Math.min(offset + CHUNK, head.size) - 1
      const object = await getObject(project.fileObjectKey, 'bytes=' + offset + '-' + end)
      if (!object || object.status !== 206) throw new Error('Gagal membaca chunk dari Object Storage.')
      const bytes = new Uint8Array(await object.arrayBuffer())
      if (bytes.byteLength !== end - offset + 1) throw new Error('Ukuran chunk tidak sesuai.')
      const response = await fetch(uri, { method: 'PUT', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'video/mp4', 'Content-Length': String(bytes.byteLength), 'Content-Range': 'bytes ' + offset + '-' + end + '/' + head.size }, body: bytes, redirect: 'error', signal: AbortSignal.timeout(180000) })
      if (response.status === 308) {
        const match = response.headers.get('range')?.match(/bytes=0-(\d+)/)
        offset = match ? Number(match[1]) + 1 : end + 1
        await db.youtubePublication.update({ where: { id }, data: { uploadOffset: BigInt(offset) } })
        continue
      }
      if (!response.ok) throw new Error(await errorText(response))
      const result = await response.json().catch(() => null) as { id?: string } | null
      if (!result?.id) throw new Error('Respons final YouTube tidak memiliki video ID.')
      const done = await db.youtubePublication.updateMany({ where: { id, status: 'uploading', lockedBy: workerId, youtubeVideoId: null }, data: { status: 'published', youtubeVideoId: result.id, publishedAt: new Date(), uploadOffset: BigInt(head.size), uploadSessionUriEncrypted: null, lockedAt: null, lockedBy: null, lastError: null } })
      if (done.count !== 1) throw new Error('Lease publikasi hilang sebelum status tersimpan.')
      return
    }
    throw new Error('Upload sudah mencapai ukuran penuh tanpa respons final. Periksa YouTube Studio sebelum mencoba ulang.')
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 450) : 'Unknown YouTube upload error'
    await db.youtubePublication.updateMany({ where: { id, status: 'uploading', lockedBy: workerId }, data: { status: 'failed', lastError: message, lockedAt: null, lockedBy: null } })
    log.error({ publicationId: id, err: message }, 'YouTube upload failed')
  }
}
export async function runYoutubePublishingBatch(limit = 3) {
  const rows = await db.youtubePublication.findMany({ where: { status: 'scheduled', approvedAt: { not: null }, youtubeVideoId: null }, orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }], take: Math.max(1, Math.min(10, limit)), select: { id: true } })
  for (const row of rows) await uploadOne(row.id)
  return { eligible: rows.length, processed: rows.length, completedAt: new Date().toISOString() }
}

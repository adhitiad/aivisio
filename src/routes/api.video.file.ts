import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { Readable } from 'node:stream'
import { db } from '@/lib/db'
import { projectDir } from '@/lib/video/config'
import { getApiSession } from '@/lib/session'
import { getObject, headObject } from '@/lib/storage/neon-object-storage'

function slugify(text: string): string {
  const value = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return value || 'aiviso-video'
}

function parseRange(value: string | null, size: number): { start: number; end: number } | null | false {
  if (!value) return null
  if (value.includes(',')) return false
  const match = value.match(/^bytes=(\d*)-(\d*)$/)
  if (!match || (!match[1] && !match[2])) return false
  let start = match[1] ? Number(match[1]) : 0
  let end = match[2] ? Number(match[2]) : size - 1
  if (!match[1] && match[2]) {
    const suffix = Number(match[2])
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return false
    start = Math.max(0, size - suffix)
    end = size - 1
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return false
  return { start, end: Math.min(end, size - 1) }
}

export const Route = createFileRoute('/api/video/file')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await getApiSession()
        if (!session) return new Response('Masuk terlebih dahulu.', { status: 401 })

        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id || id.length > 80) return new Response('Parameter id tidak valid.', { status: 400 })

        const sceneParam = searchParams.get('scene')
        const download = searchParams.get('download') === '1'
        const project = await db.videoProject.findFirst({ where: { id, userId: session.user.id } })
        if (!project) return new Response('Project tidak ditemukan.', { status: 404 })

        if (sceneParam !== null) {
          const idx = Number.parseInt(sceneParam, 10)
          if (!Number.isInteger(idx) || idx < 1 || idx > project.scenesTotal) {
            return new Response('Scene tidak valid.', { status: 400 })
          }
          const asset = await db.mediaAsset.findFirst({
            where: { videoProjectId: id, kind: 'scene_thumbnail', originalName: 'scene-' + idx + '.jpg' },
            select: { objectKey: true },
          })
          if (asset?.objectKey) {
            const object = await getObject(asset.objectKey)
            if (!object) return new Response('Thumbnail belum tersedia.', { status: 404 })
            return new Response(object.body, {
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
              },
            })
          }
          // Legacy fallback is retained only for projects not yet migrated.
          try {
            const buffer = await fsp.readFile(projectDir(id) + '/scene-' + idx + '.jpg')
            return new Response(new Uint8Array(buffer), {
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
              },
            })
          } catch {
            return new Response('Thumbnail belum tersedia. Jalankan media:migrate untuk memindahkan aset lama.', { status: 404 })
          }
        }

        const filename = 'aiviso-' + slugify(project.title || project.topic) + '.mp4'
        const headers: Record<string, string> = {
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        }
        if (download) headers['Content-Disposition'] = 'attachment; filename="' + filename + '"'

        if (project.fileObjectKey) {
          const head = await headObject(project.fileObjectKey)
          if (!head || head.size <= 0) return new Response('Video belum tersedia di Object Storage.', { status: 404 })
          const range = parseRange(request.headers.get('range'), head.size)
          if (range === false) {
            return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + head.size, 'Cache-Control': 'private, no-store' } })
          }
          const object = await getObject(project.fileObjectKey, range ? 'bytes=' + range.start + '-' + range.end : undefined)
          if (!object) return new Response('File video tidak ditemukan.', { status: 404 })
          const contentLength = range ? range.end - range.start + 1 : head.size
          const responseHeaders: Record<string, string> = { ...headers, 'Content-Length': String(contentLength) }
          if (range) responseHeaders['Content-Range'] = 'bytes ' + range.start + '-' + range.end + '/' + head.size
          return new Response(object.body, { status: range ? 206 : 200, headers: responseHeaders })
        }

        // Compatibility path for objects awaiting the one-time migration script.
        const filePath = project.filePath
        if (!filePath) return new Response('Video belum tersedia.', { status: 404 })
        let fileStat: fs.Stats
        try { fileStat = await fsp.stat(filePath) }
        catch { return new Response('File video hilang. Jalankan media:migrate untuk memindahkannya.', { status: 404 }) }
        if (!fileStat.isFile()) return new Response('File video tidak valid.', { status: 404 })
        const range = parseRange(request.headers.get('range'), fileStat.size)
        if (range === false) {
          return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + fileStat.size, 'Cache-Control': 'private, no-store' } })
        }
        if (range) {
          const stream = fs.createReadStream(filePath, { start: range.start, end: range.end })
          return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
            status: 206,
            headers: {
              ...headers,
              'Content-Range': 'bytes ' + range.start + '-' + range.end + '/' + fileStat.size,
              'Content-Length': String(range.end - range.start + 1),
            },
          })
        }
        const stream = fs.createReadStream(filePath)
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          status: 200,
          headers: { ...headers, 'Content-Length': String(fileStat.size) },
        })
      },
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { Readable } from 'node:stream'
import { db } from '@/lib/db'
import { projectDir } from '@/lib/video/config'
import { getApiSession } from '@/lib/session'

function slugify(text: string): string {
  const value = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return value || 'aiviso-video'
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
        const project = await db.videoProject.findFirst({
          where: { id, userId: session.user.id },
        })
        if (!project) return new Response('Project tidak ditemukan.', { status: 404 })

        if (sceneParam !== null) {
          const idx = Number.parseInt(sceneParam, 10)
          if (!Number.isInteger(idx) || idx < 1 || idx > project.scenesTotal) {
            return new Response('Scene tidak valid.', { status: 400 })
          }
          const file = projectDir(id) + '/scene-' + idx + '.jpg'
          try {
            const buffer = await fsp.readFile(file)
            return new Response(new Uint8Array(buffer), {
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'private, no-store',
                'X-Content-Type-Options': 'nosniff',
              },
            })
          } catch {
            return new Response('Thumbnail belum tersedia.', { status: 404 })
          }
        }

        const filePath = project.filePath
        if (!filePath) return new Response('Video belum tersedia.', { status: 404 })

        let stat: fs.Stats
        try {
          stat = await fsp.stat(filePath)
        } catch {
          return new Response('File video hilang.', { status: 404 })
        }
        if (!stat.isFile()) return new Response('File video tidak valid.', { status: 404 })

        const filename = 'aiviso-' + slugify(project.title || project.topic) + '.mp4'
        const headers: Record<string, string> = {
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        }
        if (download) {
          headers['Content-Disposition'] = 'attachment; filename="' + filename + '"'
        }

        const range = request.headers.get('range')
        const match = range?.match(/bytes=(\d*)-(\d*)/)
        if (match) {
          const start = match[1] ? Number.parseInt(match[1], 10) : 0
          const end = match[2] ? Math.min(Number.parseInt(match[2], 10), stat.size - 1) : stat.size - 1
          if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start > end || start >= stat.size) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': 'bytes */' + stat.size, 'Cache-Control': 'private, no-store' },
            })
          }
          const stream = fs.createReadStream(filePath, { start, end })
          return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
            status: 206,
            headers: {
              ...headers,
              'Content-Range': 'bytes ' + start + '-' + end + '/' + stat.size,
              'Content-Length': String(end - start + 1),
            },
          })
        }

        const stream = fs.createReadStream(filePath)
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          status: 200,
          headers: { ...headers, 'Content-Length': String(stat.size) },
        })
      },
    },
  },
})

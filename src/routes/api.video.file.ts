import { createFileRoute } from '@tanstack/react-router'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import { Readable } from 'node:stream'
import { db } from '@/lib/db'
import { projectDir } from '@/lib/video/config'
import { getApiSession } from '@/lib/session'

function slugify(text: string): string {
  const s = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
  return s || 'aiviso-video'
}

export const Route = createFileRoute('/api/video/file')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const session = await getApiSession()
        if (!session) return new Response('Masuk terlebih dahulu.', { status: 401 })
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')
        if (!id) return new Response('Parameter id wajib.', { status: 400 })
        const sceneParam = searchParams.get('scene')
        const download = searchParams.get('download') === '1'

        const project = await db.videoProject.findFirst({
          where: { id, userId: session.user.id },
        })
        if (!project) return new Response('Project tidak ditemukan.', { status: 404 })

        if (sceneParam !== null) {
          const idx = parseInt(sceneParam, 10)
          if (!Number.isFinite(idx) || idx < 1) {
            return new Response('Scene tidak valid.', { status: 400 })
          }
          const file = `${projectDir(id)}/scene-${idx}.jpg`
          try {
            const buf = await fsp.readFile(file)
            return new Response(new Uint8Array(buf), {
              headers: {
                'Content-Type': 'image/jpeg',
                'Cache-Control': 'public, max-age=3600',
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

        const filename = `aiviso-${slugify(project.title || project.topic)}.mp4`
        const baseHeaders: Record<string, string> = {
          'Content-Type': 'video/mp4',
          'Accept-Ranges': 'bytes',
        }
        if (download) {
          baseHeaders['Content-Disposition'] = `attachment; filename="${filename}"`
        }

        const range = request.headers.get('range')
        const rangeMatch = range?.match(/bytes=(\d*)-(\d*)/)
        if (rangeMatch) {
          const start = rangeMatch[1] ? parseInt(rangeMatch[1], 10) : 0
          const end = rangeMatch[2]
            ? Math.min(parseInt(rangeMatch[2], 10), stat.size - 1)
            : stat.size - 1
          if (Number.isNaN(start) || start > end || start >= stat.size) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${stat.size}` },
            })
          }
          const stream = fs.createReadStream(filePath, { start, end })
          return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
            status: 206,
            headers: {
              ...baseHeaders,
              'Content-Range': `bytes ${start}-${end}/${stat.size}`,
              'Content-Length': String(end - start + 1),
            },
          })
        }

        const stream = fs.createReadStream(filePath)
        return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
          status: 200,
          headers: { ...baseHeaders, 'Content-Length': String(stat.size) },
        })
      },
    },
  },
})

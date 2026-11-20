import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'

export const Route = createFileRoute('/api/history')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const session = await getApiSession()
          if (!session) {
            return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
          }
          const { searchParams } = new URL(request.url)
          const id = searchParams.get('id')

          if (id) {
            const item = await db.generation.findFirst({
              where: { id, userId: session.user.id },
            })
            if (!item) {
              return Response.json({ error: 'Data tidak ditemukan.' }, { status: 404 })
            }
            return Response.json(item)
          }

          const toolId = searchParams.get('toolId')
          const items = await db.generation.findMany({
            where: { userId: session.user.id, ...(toolId ? { toolId } : {}) },
            orderBy: { createdAt: 'desc' },
            take: 24,
            select: {
              id: true,
              toolId: true,
              title: true,
              inputs: true,
              createdAt: true,
            },
          })
          return Response.json({ items })
        } catch (err) {
          console.error('history GET error:', err)
          return Response.json({ error: 'Gagal memuat riwayat.' }, { status: 500 })
        }
      },

      DELETE: async ({ request }: { request: Request }) => {
        try {
          const session = await getApiSession()
          if (!session) {
            return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })
          }
          const id = new URL(request.url).searchParams.get('id')
          if (!id) {
            return Response.json({ error: 'Parameter id wajib.' }, { status: 400 })
          }
          await db.generation.deleteMany({ where: { id, userId: session.user.id } })
          return Response.json({ ok: true })
        } catch (err) {
          console.error('history DELETE error:', err)
          return Response.json({ error: 'Gagal menghapus riwayat.' }, { status: 500 })
        }
      },
    },
  },
})

import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'

export const Route = createFileRoute('/api/messages')({
  server: {
    handlers: {
      GET: async () => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Belum masuk.' }, { status: 401 })
        const items = await db.contactMessage.findMany({
          orderBy: { createdAt: 'desc' },
        })
        return Response.json({ items })
      },

      PATCH: async ({ request }: { request: Request }) => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Belum masuk.' }, { status: 401 })
        let body: { id?: string; status?: string }
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }
        if (!body.id || !['new', 'read', 'archived'].includes(body.status ?? '')) {
          return Response.json({ error: 'Parameter tidak valid.' }, { status: 400 })
        }
        await db.contactMessage.updateMany({
          where: { id: body.id },
          data: { status: body.status },
        })
        return Response.json({ ok: true })
      },

      DELETE: async ({ request }: { request: Request }) => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Belum masuk.' }, { status: 401 })
        const id = new URL(request.url).searchParams.get('id')
        if (!id) return Response.json({ error: 'Parameter id wajib.' }, { status: 400 })
        await db.contactMessage.deleteMany({ where: { id } })
        return Response.json({ ok: true })
      },
    },
  },
})

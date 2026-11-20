import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'

export const Route = createFileRoute('/api/notifications')({
  server: {
    handlers: {
      GET: async () => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Belum masuk.' }, { status: 401 })

        const where = {
          OR: [{ userId: session.user.id }, { userId: null }],
        }
        const [items, unread] = await Promise.all([
          db.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 20,
          }),
          db.notification.count({ where: { ...where, read: false } }),
        ])
        return Response.json({ items, unread })
      },

      PATCH: async ({ request }: { request: Request }) => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Belum masuk.' }, { status: 401 })

        let body: { all?: boolean; ids?: string[] }
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }
        const ownScope = {
          OR: [{ userId: session.user.id }, { userId: null }],
        }
        if (body.all === true) {
          await db.notification.updateMany({
            where: { ...ownScope, read: false },
            data: { read: true },
          })
          return Response.json({ ok: true })
        }
        if (Array.isArray(body.ids) && body.ids.length > 0) {
          await db.notification.updateMany({
            where: { ...ownScope, id: { in: body.ids.slice(0, 100) } },
            data: { read: true },
          })
          return Response.json({ ok: true })
        }
        return Response.json({ error: 'Parameter tidak valid.' }, { status: 400 })
      },
    },
  },
})

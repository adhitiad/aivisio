import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'

export const Route = createFileRoute('/api/notifications/$id')({
  server: {
    handlers: {
      DELETE: async ({ params }: { params: { id: string } }) => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Belum masuk.' }, { status: 401 })
        const { id } = params
        if (!id) return Response.json({ error: 'Parameter id wajib.' }, { status: 400 })
        await db.notification.deleteMany({ where: { id, userId: session.user.id } })
        return Response.json({ ok: true })
      },
    },
  },
})

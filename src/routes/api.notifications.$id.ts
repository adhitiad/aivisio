import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'

export const Route = createFileRoute('/api/notifications/$id')({
  server: {
    handlers: {
      DELETE: async ({ request, params }: { request: Request; params: { id: string } }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Belum masuk.' }, { status: 401 })

        const id = params.id
        if (!id || id.length > 80) {
          return Response.json({ error: 'Parameter id tidak valid.' }, { status: 400 })
        }

        const owned = await db.notification.deleteMany({
          where: { id, userId: session.user.id },
        })
        if (owned.count > 0) return Response.json({ ok: true })

        const broadcast = await db.notification.findFirst({
          where: { id, userId: null },
          select: { id: true },
        })
        if (!broadcast) return Response.json({ error: 'Notifikasi tidak ditemukan.' }, { status: 404 })

        await db.notificationReadReceipt.upsert({
          where: {
            notificationId_userId: {
              notificationId: id,
              userId: session.user.id,
            },
          },
          create: {
            notificationId: id,
            userId: session.user.id,
            read: true,
            dismissed: true,
          },
          update: { dismissed: true },
        })
        return Response.json({ ok: true })
      },
    },
  },
})

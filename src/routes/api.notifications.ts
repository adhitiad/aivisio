import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'

const patchSchema = z.object({
  all: z.boolean().optional(),
  ids: z.array(z.string().min(1).max(80)).max(100).optional(),
}).strict().refine((value) => value.all === true || Boolean(value.ids?.length), {
  message: 'Specify all=true or at least one notification id.',
})

export const Route = createFileRoute('/api/notifications')({
  server: {
    handlers: {
      GET: async () => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Belum masuk.' }, { status: 401 })

        const items = await db.notification.findMany({
          where: { OR: [{ userId: session.user.id }, { userId: null }] },
          orderBy: { createdAt: 'desc' },
          take: 50,
        })
        const broadcastIds = items.filter((item) => item.userId === null).map((item) => item.id)
        const receipts = broadcastIds.length
          ? await db.notificationReadReceipt.findMany({
              where: { userId: session.user.id, notificationId: { in: broadcastIds } },
              select: { notificationId: true, read: true, dismissed: true },
            })
          : []
        const receiptByNotification = new Map(receipts.map((receipt) => [receipt.notificationId, receipt]))

        const visibleItems = items
          .filter((item) => item.userId !== null || !receiptByNotification.get(item.id)?.dismissed)
          .map((item) => ({
            ...item,
            read: item.userId === null
              ? (receiptByNotification.get(item.id)?.read ?? false)
              : item.read,
          }))

        return Response.json(
          {
            items: visibleItems,
            unread: visibleItems.filter((item) => !item.read).length,
          },
          { headers: { 'Cache-Control': 'private, no-store' } },
        )
      },

      PATCH: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Belum masuk.' }, { status: 401 })

        let body: unknown
        try {
          const raw = await request.text()
          if (new TextEncoder().encode(raw).byteLength > 16_000) {
            return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
          }
          body = JSON.parse(raw)
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }

        const parsed = patchSchema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'Parameter tidak valid.' }, { status: 400 })
        }

        const ids = parsed.data.all
          ? (await db.notification.findMany({
              where: { OR: [{ userId: session.user.id }, { userId: null }] },
              select: { id: true },
            })).map((item) => item.id)
          : parsed.data.ids ?? []

        if (ids.length === 0) return Response.json({ ok: true })

        const accessible = await db.notification.findMany({
          where: {
            id: { in: ids },
            OR: [{ userId: session.user.id }, { userId: null }],
          },
          select: { id: true, userId: true },
        })
        const ownIds = accessible.filter((item) => item.userId === session.user.id).map((item) => item.id)
        const broadcastIds = accessible.filter((item) => item.userId === null).map((item) => item.id)

        await db.$transaction(async (tx) => {
          if (ownIds.length) {
            await tx.notification.updateMany({
              where: { id: { in: ownIds }, userId: session.user.id },
              data: { read: true },
            })
          }
          if (broadcastIds.length) {
            await tx.notificationReadReceipt.updateMany({
              where: { userId: session.user.id, notificationId: { in: broadcastIds } },
              data: { read: true },
            })
            await tx.notificationReadReceipt.createMany({
              data: broadcastIds.map((notificationId) => ({
                notificationId,
                userId: session.user.id,
                read: true,
              })),
              skipDuplicates: true,
            })
          }
        })

        return Response.json({ ok: true })
      },
    },
  },
})

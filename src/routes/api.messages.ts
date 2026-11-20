import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { adminGate } from '@/lib/admin-gate'
import { sameOriginGuard } from '@/lib/security/http'

export const Route = createFileRoute('/api/messages')({
  server: {
    handlers: {
      GET: async () => {
        const denied = await adminGate()
        if (denied) return denied

        const items = await db.contactMessage.findMany({
          orderBy: { createdAt: 'desc' },
        })
        return Response.json({ items }, { headers: { 'Cache-Control': 'no-store' } })
      },

      PATCH: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        const denied = await adminGate()
        if (denied) return denied

        let body: { id?: string; status?: string }
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }
        const status = body.status
        if (
          !body.id ||
          body.id.length > 80 ||
          typeof status !== 'string' ||
          (status !== 'new' && status !== 'read' && status !== 'archived')
        ) {
          return Response.json({ error: 'Parameter tidak valid.' }, { status: 400 })
        }
        const result = await db.contactMessage.updateMany({
          where: { id: body.id },
          data: { status },
        })
        if (result.count === 0) {
          return Response.json({ error: 'Pesan tidak ditemukan.' }, { status: 404 })
        }
        return Response.json({ ok: true })
      },

      DELETE: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        const denied = await adminGate()
        if (denied) return denied

        const id = new URL(request.url).searchParams.get('id')
        if (!id || id.length > 80) {
          return Response.json({ error: 'Parameter id tidak valid.' }, { status: 400 })
        }
        const result = await db.contactMessage.deleteMany({ where: { id } })
        if (result.count === 0) {
          return Response.json({ error: 'Pesan tidak ditemukan.' }, { status: 404 })
        }
        return Response.json({ ok: true })
      },
    },
  },
})

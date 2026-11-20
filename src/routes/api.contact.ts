import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { clientIp, rateLimit } from '@/lib/rate-limit'
import { moduleLogger } from '@/lib/logger'
import { sameOriginGuard } from '@/lib/security/http'

const log = moduleLogger('contact')

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(200),
  subject: z.string().trim().max(200).optional().default(''),
  message: z.string().trim().min(10).max(5000),
  website: z.string().max(0).optional().default(''),
})

export const Route = createFileRoute('/api/contact')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        if (!rateLimit(`contact:${clientIp(request)}`, 5, 10 * 60 * 1000)) {
          return Response.json(
            { error: 'Terlalu banyak permintaan. Coba lagi nanti.' },
            { status: 429 },
          )
        }

        let body: unknown
        try {
          const raw = await request.text()
          if (new TextEncoder().encode(raw).byteLength > 8_000) {
            return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
          }
          body = JSON.parse(raw)
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }

        const parsed = schema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'Data tidak valid.' }, { status: 400 })
        }
        if (parsed.data.website) return Response.json({ ok: true })

        try {
          await db.contactMessage.create({
            data: {
              name: parsed.data.name,
              email: parsed.data.email,
              subject: parsed.data.subject || null,
              message: parsed.data.message,
            },
          })
          return Response.json({ ok: true })
        } catch (err) {
          log.error({ err: String(err).slice(0, 200) }, 'gagal menyimpan pesan kontak')
          return Response.json({ error: 'Gagal mengirim pesan.' }, { status: 500 })
        }
      },
    },
  },
})

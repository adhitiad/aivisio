import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { SETTING_KEYS, type SettingKey } from '@/lib/settings'
import { getApiSession } from '@/lib/session'

const schema = z.object({
  values: z.record(z.string(), z.string().max(20000)),
})

export const Route = createFileRoute('/api/settings')({
  server: {
    handlers: {
      GET: async () => {
        const rows = await db.setting.findMany({
          where: { key: { in: [...SETTING_KEYS] } },
        })
        const values: Record<string, string> = {}
        for (const r of rows) values[r.key] = r.value
        return Response.json({ values })
      },

      PUT: async ({ request }: { request: Request }) => {
        const session = await getApiSession()
        if (!session) {
          return Response.json({ error: 'Belum masuk.' }, { status: 401 })
        }

        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }
        const parsed = schema.safeParse(body)
        if (!parsed.success) {
          return Response.json({ error: 'Data tidak valid.' }, { status: 400 })
        }

        const entries = Object.entries(parsed.data.values).filter(([key]) =>
          (SETTING_KEYS as readonly string[]).includes(key),
        )

        for (const [key, value] of entries) {
          if (key === 'siteLogo' && value && !/^(https?:\/\/|\/|data:image\/)/.test(value)) {
            return Response.json(
              { error: 'URL logo tidak valid (harus http(s)://, path relatif /, atau data:image/).' },
              { status: 400 },
            )
          }
          if (key === 'contactEmail' && value && !z.string().email().safeParse(value).success) {
            return Response.json({ error: 'Email kontak tidak valid.' }, { status: 400 })
          }
        }

        await db.$transaction(
          entries.map(([key, value]) =>
            db.setting.upsert({
              where: { key: key as SettingKey },
              update: { value },
              create: { key: key as SettingKey, value },
            }),
          ),
        )

        return Response.json({ ok: true })
      },
    },
  },
})

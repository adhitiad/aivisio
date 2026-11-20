import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { db } from '@/lib/db'
import { PROVIDER_PRESETS } from '@/lib/ai/providers'
import { moduleLogger } from '@/lib/logger'
import { adminGate } from '@/lib/admin-gate'
import { sameOriginGuard } from '@/lib/security/http'
import { assertSafeProviderBaseUrl } from '@/lib/provider-security'
import { encryptProviderApiKey, maskProviderApiKey } from '@/lib/provider-secrets'

const log = moduleLogger('ai-providers')

const updateSchema = z.object({
  key: z.string().min(1).max(80),
  baseUrl: z.string().max(500).optional(),
  model: z.string().max(200).optional(),
  enabled: z.boolean().optional(),
  active: z.boolean().optional(),
  apiKey: z.string().max(4096).optional(),
}).strict()

async function ensureSeeded() {
  const existing = await db.aiProvider.findMany({ select: { key: true } })
  const have = new Set(existing.map((row) => row.key))
  const missing = PROVIDER_PRESETS.filter((preset) => !have.has(preset.key))
  if (missing.length === 0) return

  const anyActive = await db.aiProvider.findFirst({ where: { active: true } })
  await db.aiProvider.createMany({
    data: missing.map((preset) => ({
      key: preset.key,
      label: preset.label,
      baseUrl: preset.baseUrl,
      model: preset.model,
      note: preset.note ?? null,
      sortOrder: preset.sortOrder,
      enabled: preset.key === 'zai-bawaan',
      active: preset.key === 'zai-bawaan' && !anyActive,
    })),
    skipDuplicates: true,
  })
  log.info({ seeded: missing.length }, 'preset provider ditambahkan')
}

export const Route = createFileRoute('/api/ai-providers')({
  server: {
    handlers: {
      GET: async () => {
        const denied = await adminGate()
        if (denied) return denied
        try {
          await ensureSeeded()
          const rows = await db.aiProvider.findMany({ orderBy: { sortOrder: 'asc' } })
          return Response.json(
            {
              list: rows.map((row) => ({
                key: row.key,
                label: row.label,
                baseUrl: row.baseUrl,
                model: row.model,
                enabled: row.enabled,
                active: row.active,
                status: row.status,
                statusMessage: row.statusMessage,
                lastCheckedAt: row.lastCheckedAt,
                note: row.note,
                hasKey: Boolean(row.apiKey),
                keyMask: maskProviderApiKey(row.apiKey),
              })),
            },
            { headers: { 'Cache-Control': 'no-store' } },
          )
        } catch (err) {
          log.error({ err: String(err).slice(0, 200) }, 'GET provider gagal')
          return Response.json({ error: 'Gagal memuat provider.' }, { status: 500 })
        }
      },

      PUT: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        const denied = await adminGate()
        if (denied) return denied

        try {
          const raw = await request.text()
          if (new TextEncoder().encode(raw).byteLength > 16_000) {
            return Response.json({ error: 'Payload terlalu besar.' }, { status: 413 })
          }
          const parsed = updateSchema.safeParse(JSON.parse(raw))
          if (!parsed.success) {
            return Response.json({ error: 'Data provider tidak valid.' }, { status: 400 })
          }

          const input = parsed.data
          const preset = PROVIDER_PRESETS.find((item) => item.key === input.key)
          if (!preset) {
            return Response.json({ error: 'Provider tidak dikenali.' }, { status: 400 })
          }

          const baseUrl = input.baseUrl === undefined ? preset.baseUrl : input.baseUrl.trim()
          if (baseUrl) await assertSafeProviderBaseUrl(baseUrl, input.key)

          const updateData = {
            ...(input.baseUrl !== undefined ? { baseUrl } : {}),
            ...(input.model !== undefined ? { model: input.model.trim() } : {}),
            ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
            ...(input.apiKey !== undefined ? { apiKey: encryptProviderApiKey(input.apiKey) } : {}),
          }

          await db.$transaction(async (tx) => {
            await tx.aiProvider.upsert({
              where: { key: input.key },
              create: {
                key: preset.key,
                label: preset.label,
                baseUrl,
                model: input.model?.trim() || preset.model,
                note: preset.note ?? null,
                sortOrder: preset.sortOrder,
                enabled: input.enabled ?? false,
                active: false,
                apiKey: input.apiKey === undefined ? '' : encryptProviderApiKey(input.apiKey),
              },
              update: updateData,
            })

            if (input.active === true) {
              await tx.aiProvider.updateMany({
                where: { key: { not: input.key } },
                data: { active: false },
              })
              await tx.aiProvider.update({
                where: { key: input.key },
                data: { active: true, enabled: true },
              })
            } else if (input.active === false) {
              await tx.aiProvider.update({
                where: { key: input.key },
                data: { active: false },
              })
            }
          })

          const updated = await db.aiProvider.findUnique({ where: { key: input.key } })
          return Response.json({
            ok: true,
            provider: updated
              ? {
                  key: updated.key,
                  label: updated.label,
                  baseUrl: updated.baseUrl,
                  model: updated.model,
                  enabled: updated.enabled,
                  active: updated.active,
                  status: updated.status,
                  hasKey: Boolean(updated.apiKey),
                  keyMask: maskProviderApiKey(updated.apiKey),
                  note: updated.note,
                }
              : null,
          })
        } catch (err) {
          log.error({ err: String(err).slice(0, 200) }, 'PUT provider gagal')
          const message = err instanceof Error ? err.message : ''
          const invalidInput = /Provider base URL|External AI providers|Private and local|Private or reserved|Provider hostname|credentials, query parameters/i.test(message)
          return Response.json(
            { error: invalidInput ? message.slice(0, 240) : 'Gagal menyimpan provider.' },
            { status: invalidInput ? 400 : 500 },
          )
        }
      },
    },
  },
})

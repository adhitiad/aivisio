import { createFileRoute } from '@tanstack/react-router'
import { db } from '@/lib/db'
import { PROVIDER_PRESETS } from '@/lib/ai/providers'
import { moduleLogger } from '@/lib/logger'
import { adminGate } from '@/lib/admin-gate'

const log = moduleLogger('ai-providers')

async function ensureSeeded() {
  const existing = await db.aiProvider.findMany({ select: { key: true } })
  const have = new Set(existing.map((r) => r.key))
  const missing = PROVIDER_PRESETS.filter((p) => !have.has(p.key))
  if (missing.length > 0) {
    const anyActive = await db.aiProvider.findFirst({ where: { active: true } })
    await db.aiProvider.createMany({
      data: missing.map((p) => ({
        key: p.key,
        label: p.label,
        baseUrl: p.baseUrl,
        model: p.model,
        note: p.note ?? null,
        sortOrder: p.sortOrder,
        enabled: p.key === 'zai-bawaan',
        active: p.key === 'zai-bawaan' && !anyActive,
      })),
    })
    log.info({ seeded: missing.length }, 'preset provider ditambahkan')
  }
}

function maskKey(key: string): string | null {
  if (!key) return null
  if (key.length <= 8) return '****'
  return `****${key.slice(-4)}`
}

export const Route = createFileRoute('/api/ai-providers')({
  server: {
    handlers: {
      GET: async () => {
        try {
          await ensureSeeded()
          const rows = await db.aiProvider.findMany({ orderBy: { sortOrder: 'asc' } })
          return Response.json({
            list: rows.map((r) => ({
              key: r.key,
              label: r.label,
              baseUrl: r.baseUrl,
              model: r.model,
              enabled: r.enabled,
              active: r.active,
              status: r.status,
              statusMessage: r.statusMessage,
              lastCheckedAt: r.lastCheckedAt,
              note: r.note,
              hasKey: Boolean(r.apiKey),
              keyMask: maskKey(r.apiKey),
            })),
          })
        } catch (err) {
          log.error({ err: String(err).slice(0, 200) }, 'GET provider gagal')
          return Response.json({ error: 'Gagal memuat provider.' }, { status: 500 })
        }
      },

      PUT: async ({ request }: { request: Request }) => {
        const gated = await adminGate()
        if (gated) return gated
        try {
          const body = await request.json().catch(() => null)
          const key = String(body?.key ?? '')
          const preset = PROVIDER_PRESETS.find((p) => p.key === key)
          if (!preset) {
            return Response.json({ error: 'Provider tidak dikenali.' }, { status: 400 })
          }

          const current = await db.aiProvider.findUnique({ where: { key } })
          const data: Record<string, unknown> = {}
          if (typeof body.baseUrl === 'string') data.baseUrl = body.baseUrl.trim()
          if (typeof body.model === 'string') data.model = body.model.trim()
          if (typeof body.enabled === 'boolean') data.enabled = body.enabled
          if (body.apiKey !== undefined) data.apiKey = String(body.apiKey)

          if (!current) {
            await db.aiProvider.create({
              data: {
                key: preset.key,
                label: preset.label,
                baseUrl: preset.baseUrl,
                model: preset.model,
                note: preset.note ?? null,
                sortOrder: preset.sortOrder,
                ...data,
              },
            })
          } else {
            await db.aiProvider.update({ where: { key }, data })
          }

          if (body.active === true) {
            await db.aiProvider.updateMany({ where: { key: { not: key } }, data: { active: false } })
            await db.aiProvider.update({ where: { key }, data: { active: true, enabled: true } })
          } else if (body.active === false) {
            await db.aiProvider.update({ where: { key }, data: { active: false } })
          }

          const updated = await db.aiProvider.findUnique({ where: { key } })
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
                  statusMessage: updated.statusMessage,
                  hasKey: Boolean(updated.apiKey),
                  keyMask: maskKey(updated.apiKey),
                  note: updated.note,
                }
              : null,
          })
        } catch (err) {
          log.error({ err: String(err).slice(0, 200) }, 'PUT provider gagal')
          return Response.json({ error: 'Gagal menyimpan provider.' }, { status: 500 })
        }
      },
    },
  },
})

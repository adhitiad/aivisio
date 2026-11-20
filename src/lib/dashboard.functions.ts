import { createServerFn } from '@tanstack/react-start'
import { db } from './db'
import { getSettings } from './settings'
import { getSessionFn } from './auth.functions'

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return `****${key.slice(-4)}`
}

async function requireUserId(): Promise<string> {
  const session = await getSessionFn()
  if (!session) throw new Error('Masuk terlebih dahulu.')
  return session.user.id
}

export const getDashboardStatsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const userId = await requireUserId()
    const [generations, videos, activeProviders, newMessages, recent] =
      await Promise.all([
        db.generation.count({ where: { userId } }),
        db.videoProject.count({ where: { userId } }),
        db.aiProvider.count({ where: { active: true } }),
        db.contactMessage.count({ where: { status: 'new' } }),
        db.generation.findMany({
          where: { userId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { id: true, toolId: true, title: true, createdAt: true },
        }),
      ])
    return { generations, videos, activeProviders, newMessages, recent }
  },
)

export const getHistoryRowsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const userId = await requireUserId()
    const items = await db.generation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        toolId: true,
        title: true,
        inputs: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }))
  },
)

export const getVideoRowsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const userId = await requireUserId()
    const items = await db.videoProject.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        topic: true,
        title: true,
        format: true,
        status: true,
        progress: true,
        durationSec: true,
        fileBytes: true,
        createdAt: true,
        updatedAt: true,
      },
    })
    return items.map((i) => ({
      ...i,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }))
  },
)

export const getProviderRowsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const rows = await db.aiProvider.findMany({ orderBy: { sortOrder: 'asc' } })
    return rows.map((r) => ({
      id: r.id,
      key: r.key,
      label: r.label,
      model: r.model,
      enabled: r.enabled,
      active: r.active,
      status: r.status,
      statusMessage: r.statusMessage,
      keyMask: maskKey(r.apiKey),
      updatedAt: r.updatedAt.toISOString(),
    }))
  },
)

export const getMessageRowsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    const items = await db.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return items.map((i) => ({
      ...i,
      subject: i.subject ?? null,
      createdAt: i.createdAt.toISOString(),
      updatedAt: i.updatedAt.toISOString(),
    }))
  },
)

export const getSettingsPageFn = createServerFn({ method: 'GET' }).handler(
  async () => getSettings(),
)

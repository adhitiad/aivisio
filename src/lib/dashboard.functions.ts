import { createServerFn } from '@tanstack/react-start'
import { db } from './db'
import { getSettings } from './settings'
import { requirePrincipal } from './authorization'
import { maskProviderApiKey } from './provider-secrets'

async function requireUserId(): Promise<string> {
  const principal = await requirePrincipal()
  return principal.userId
}

async function requireAdmin(): Promise<void> {
  await requirePrincipal(['OWNER', 'ADMIN'])
}

export const getDashboardStatsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAdmin()
    const [generations, videos, activeProviders, newMessages, recent] =
      await Promise.all([
        db.generation.count(),
        db.videoProject.count(),
        db.aiProvider.count({ where: { active: true } }),
        db.contactMessage.count({ where: { status: 'new' } }),
        db.generation.findMany({
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
    return items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
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
    return items.map((item) => ({
      ...item,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  },
)

export const getProviderRowsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAdmin()
    const rows = await db.aiProvider.findMany({ orderBy: { sortOrder: 'asc' } })
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      model: row.model,
      enabled: row.enabled,
      active: row.active,
      status: row.status,
      statusMessage: row.statusMessage,
      keyMask: maskProviderApiKey(row.apiKey) ?? '',
      updatedAt: row.updatedAt.toISOString(),
    }))
  },
)

export const getMessageRowsFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAdmin()
    const items = await db.contactMessage.findMany({
      orderBy: { createdAt: 'desc' },
    })
    return items.map((item) => ({
      ...item,
      subject: item.subject ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }))
  },
)

export const getSettingsPageFn = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireAdmin()
    return getSettings()
  },
)

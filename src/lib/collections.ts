import { z } from 'zod'
import type { QueryClient } from '@tanstack/react-query'
import { queryCollectionOptions } from '@tanstack/query-db-collection'
import { collectionOptions } from '@tanstack/react-db'

export const notificationSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string().nullable(),
  type: z.string(),
  read: z.boolean(),
  link: z.string().nullable(),
  createdAt: z.string(),
})

export type NotificationRow = z.infer<typeof notificationSchema>

/**
 * Koleksi TanStack DB untuk notifikasi. Data diambil lewat /api/notifications
 * memakai TanStack Query; update optimistik ditulis balik ke endpoint PATCH.
 */
export const notificationCollection = collectionOptions(
  'notifications',
  (client) =>
    queryCollectionOptions({
      id: 'notifications',
      schema: notificationSchema,
      getKey: (item: NotificationRow) => item.id,
      queryClient: client.requireDependency<QueryClient>('queryClient'),
      queryKey: ['notifications'],
      queryFn: async () => {
        const res = await fetch('/api/notifications', { cache: 'no-store' })
        if (!res.ok) return [] as NotificationRow[]
        const data = (await res.json()) as { items?: NotificationRow[] }
        return data.items ?? []
      },
      onUpdate: async ({ transaction, collection }) => {
        const ids = transaction.mutations.map((m) => m.original.id)
        await fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        })
        await collection.utils.refetch()
      },
      onDelete: async ({ transaction, collection }) => {
        await Promise.all(
          transaction.mutations.map((m) =>
            fetch(`/api/notifications/${encodeURIComponent(m.original.id)}`, {
              method: 'DELETE',
            }),
          ),
        )
        await collection.utils.refetch()
      },
    }),
)

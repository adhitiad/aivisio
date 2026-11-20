import { createFileRoute } from '@tanstack/react-router'
import { getApiSession } from '@/lib/session'
import { db } from '@/lib/db'
import { hasYoutubeMonetaryScope } from '@/lib/youtube/oauth'

export const Route = createFileRoute('/api/youtube/channels')({
  server: {
    handlers: {
      GET: async () => {
        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })

        const connection = await db.youtubeOAuthConnection.findUnique({
          where: { userId: session.user.id },
          include: {
            channels: {
              orderBy: { title: 'asc' },
              select: {
                id: true,
                youtubeChannelId: true,
                title: true,
                handle: true,
                thumbnailUrl: true,
                country: true,
                connectionStatus: true,
                lastSyncedAt: true,
              },
            },
          },
        })

        return Response.json({
          connected: Boolean(connection && connection.connectionStatus === 'connected'),
          connectionStatus: connection?.connectionStatus ?? 'disconnected',
          googleEmail: connection?.googleEmail ?? null,
          hasAnalyticsAccess: Boolean(connection?.scopes.includes('https://www.googleapis.com/auth/yt-analytics.readonly')),
          hasMonetaryAccess: connection ? hasYoutubeMonetaryScope(connection.scopes) : false,
          channels: connection?.channels ?? [],
        }, {
          headers: { 'Cache-Control': 'private, no-store' },
        })
      },
    },
  },
})

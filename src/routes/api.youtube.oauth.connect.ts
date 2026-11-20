import { createFileRoute } from '@tanstack/react-router'
import { getApiSession } from '@/lib/session'
import { rateLimit } from '@/lib/rate-limit'
import { sameOriginGuard } from '@/lib/security/http'
import {
  createYoutubeAuthorizationUrl,
  YoutubeIntegrationError,
} from '@/lib/youtube/oauth'

export const Route = createFileRoute('/api/youtube/oauth/connect')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied
        const session = await getApiSession()
        if (!session) {
          return Response.redirect(new URL('/login', process.env.SITE_URL ?? 'http://localhost:3000'), 302)
        }

        if (!rateLimit('youtube-oauth-connect:' + session.user.id, 3, 60 * 60 * 1000)) {
          return Response.json({ error: 'Batas percobaan koneksi YouTube tercapai. Coba lagi nanti.' }, { status: 429 })
        }

        try {
          const authorizationUrl = await createYoutubeAuthorizationUrl(session.user.id)
          return Response.redirect(authorizationUrl, 302)
        } catch (error) {
          if (error instanceof YoutubeIntegrationError) {
            return Response.json({ error: error.message, code: error.code }, { status: error.status })
          }
          return Response.json({ error: 'Tidak dapat memulai koneksi YouTube.' }, { status: 500 })
        }
      },
    },
  },
})

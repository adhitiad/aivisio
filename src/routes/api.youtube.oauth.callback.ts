import { createFileRoute } from '@tanstack/react-router'
import { getApiSession } from '@/lib/session'
import { moduleLogger } from '@/lib/logger'
import {
  completeYoutubeOAuth,
  consumeYoutubeOAuthState,
  YoutubeIntegrationError,
} from '@/lib/youtube/oauth'

const log = moduleLogger('youtube-oauth-callback')

function dashboardUrl(status: string): string {
  const base = process.env.SITE_URL ?? process.env.BETTER_AUTH_URL ?? 'http://localhost:3000'
  const url = new URL('/dashboard/analytics', base)
  url.searchParams.set('youtube', status)
  return url.toString()
}

export const Route = createFileRoute('/api/youtube/oauth/callback')({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const url = new URL(request.url)
        const state = url.searchParams.get('state') ?? ''
        const code = url.searchParams.get('code') ?? ''
        const oauthError = url.searchParams.get('error')
        const session = await getApiSession()

        if (!session) return Response.redirect(dashboardUrl('session-expired'), 302)

        try {
          const verifier = await consumeYoutubeOAuthState(state, session.user.id)
          if (oauthError) return Response.redirect(dashboardUrl('denied'), 302)

          const result = await completeYoutubeOAuth(session.user.id, code, verifier)
          const redirect = new URL(dashboardUrl('connected'))
          redirect.searchParams.set('channels', String(result.channelCount))
          return Response.redirect(redirect.toString(), 302)
        } catch (error) {
          if (error instanceof YoutubeIntegrationError) {
            log.warn({ code: error.code, status: error.status }, 'YouTube OAuth callback rejected')
            const status = error.code === 'YOUTUBE_OAUTH_NOT_CONFIGURED'
              ? 'not-configured'
              : error.code === 'YOUTUBE_CHANNEL_ALREADY_LINKED'
                ? 'channel-conflict'
                : 'failed'
            return Response.redirect(dashboardUrl(status), 302)
          }

          log.error({ err: error instanceof Error ? error.message.slice(0, 180) : 'unknown' }, 'YouTube OAuth callback failed')
          return Response.redirect(dashboardUrl('failed'), 302)
        }
      },
    },
  },
})

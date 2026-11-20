import { createFileRoute } from '@tanstack/react-router'
import { getApiSession } from '@/lib/session'
import { sameOriginGuard } from '@/lib/security/http'
import { disconnectYoutubeAccount } from '@/lib/youtube/oauth'

export const Route = createFileRoute('/api/youtube/disconnect')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const originDenied = sameOriginGuard(request)
        if (originDenied) return originDenied

        const session = await getApiSession()
        if (!session) return Response.json({ error: 'Masuk terlebih dahulu.' }, { status: 401 })

        try {
          await disconnectYoutubeAccount(session.user.id)
          return Response.json({ success: true }, { headers: { 'Cache-Control': 'private, no-store' } })
        } catch {
          return Response.json({ error: 'Koneksi YouTube lokal tidak dapat dihapus.' }, { status: 500 })
        }
      },
    },
  },
})

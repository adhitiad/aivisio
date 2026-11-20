import { createFileRoute } from '@tanstack/react-router'
import { setCookie } from '@tanstack/react-start/server'
import { LOCALE_COOKIE, isLocale } from '@/lib/i18n'

export const Route = createFileRoute('/api/locale')({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        let body: unknown
        try {
          body = await request.json()
        } catch {
          return Response.json({ error: 'Body tidak valid.' }, { status: 400 })
        }
        const locale = (body as { locale?: string })?.locale
        if (!isLocale(locale)) {
          return Response.json({ error: 'Locale tidak didukung.' }, { status: 400 })
        }
        setCookie(LOCALE_COOKIE, locale, {
          path: '/',
          maxAge: 60 * 60 * 24 * 365,
          sameSite: 'lax',
        })
        return Response.json({ ok: true, locale })
      },
    },
  },
})

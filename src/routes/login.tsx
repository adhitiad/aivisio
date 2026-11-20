import { createFileRoute, redirect } from '@tanstack/react-router'
import { ShieldCheck } from 'lucide-react'
import { getSessionFn } from '@/lib/auth.functions'
import { getOAuthConfigFn, getSettingsFn } from '@/lib/server-data'
import { useT } from '@/lib/i18n'
import { SiteLogo } from '@/components/brand/site-logo'
import { LoginButtons } from '@/components/auth/login-buttons'

export const Route = createFileRoute('/login')({
  validateSearch: (search: Record<string, unknown>) => ({
    error: typeof search.error === 'string' ? search.error : undefined,
  }),
  loader: async () => {
    const session = await getSessionFn()
    if (session) throw redirect({ to: '/dashboard' })
    const [settings, oauth] = await Promise.all([
      getSettingsFn(),
      getOAuthConfigFn(),
    ])
    return { settings, oauth }
  },
  head: () => ({
    meta: [
      { title: 'Masuk · AIVISO' },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
  component: LoginPage,
})

function LoginPage() {
  const t = useT('auth')
  const { settings, oauth } = Route.useLoaderData()
  const { error } = Route.useSearch()
  const anyConfigured = oauth.google || oauth.facebook

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl sm:p-8">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <SiteLogo logoUrl={settings.siteLogo} size={52} className="text-foreground" />
          <h1 className="text-2xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('subtitle')}</p>
        </div>

        {anyConfigured ? (
          <LoginButtons
            googleEnabled={oauth.google}
            facebookEnabled={oauth.facebook}
            hasError={Boolean(error)}
          />
        ) : (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-center text-xs leading-relaxed text-amber-700 dark:text-amber-300">
            OAuth belum dikonfigurasi. Isi <code>GOOGLE_CLIENT_ID</code> /{" "}
            <code>GOOGLE_CLIENT_SECRET</code> dan <code>FACEBOOK_CLIENT_ID</code> /{" "}
            <code>FACEBOOK_CLIENT_SECRET</code> di file <code>.env</code>, lalu
            muat ulang halaman ini.
          </div>
        )}

        <p className="mt-6 flex items-start gap-2 text-[11px] leading-relaxed text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t('noPassword')}
        </p>
      </div>
    </main>
  )
}

import { useMemo, type ReactNode } from 'react'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { DbClient, DbProvider } from '@tanstack/react-db'
import { I18nextProvider } from 'react-i18next'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/toaster'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { RootNotFound } from '@/components/layout/root-not-found'
import { RootError } from '@/components/layout/root-error'
import { createI18n } from '@/lib/i18n'
import { getSessionFn } from '@/lib/auth.functions'
import { getLocaleFn, getSettingsFn } from '@/lib/server-data'
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '../styles.css'
import './fonts.css'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => {
    const [locale, settings, session] = await Promise.all([
      getLocaleFn(),
      getSettingsFn(),
      getSessionFn(),
    ])
    return { locale, settings, session }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'AIVISO — Studio Pertumbuhan YouTube Bertenaga AI' },
      {
        name: 'description',
        content:
          'Lima asisten AI untuk kreator YouTube: rencana channel, riset niche, skrip viral & hook, strategi algoritma, dan workflow produksi 3x lebih cepat. 100% Bahasa Indonesia.',
      },
      { property: 'og:site_name', content: 'AIVISO' },
      { property: 'og:type', content: 'website' },
      { name: 'robots', content: 'index, follow' },
    ],
    links: [{ rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' }],
  }),
  component: RootComponent,
  notFoundComponent: RootNotFound,
  errorComponent: RootError,
})

function RootComponent() {
  const { queryClient } = Route.useRouteContext()
  const { locale, settings, session } = Route.useLoaderData()
  const i18n = useMemo(() => createI18n(locale), [locale])
  const dbClient = useMemo(() => new DbClient({ queryClient }), [queryClient])

  return (
    <RootDocument locale={locale}>
      <I18nextProvider i18n={i18n}>
        <QueryClientProvider client={queryClient}>
          <DbProvider client={dbClient}>
            <ThemeProvider
              attribute="class"
              defaultTheme="dark"
              enableSystem={false}
              disableTransitionOnChange
            >
              <div className="relative flex min-h-screen flex-col overflow-x-clip">
                <Navbar
                  siteName={settings.siteName || 'AIVISO'}
                  logoUrl={settings.siteLogo}
                  user={
                    session?.user
                      ? {
                          name: session.user.name ?? null,
                          email: session.user.email ?? null,
                          image: session.user.image ?? null,
                        }
                      : null
                  }
                />
                <div className="flex flex-1 flex-col">
                  <Outlet />
                </div>
                <Footer
                  siteName={settings.siteName || 'AIVISO'}
                  logoUrl={settings.siteLogo}
                />
              </div>
              <Toaster />
            </ThemeProvider>
          </DbProvider>
        </QueryClientProvider>
      </I18nextProvider>
    </RootDocument>
  )
}

function RootDocument({
  children,
  locale,
}: Readonly<{ children: ReactNode; locale: string }>) {
  return (
    <html lang={locale} suppressHydrationWarning data-scroll-behavior="smooth">
      <head>
        <HeadContent />
      </head>
      <body className="antialiased bg-background text-foreground">
        {children}
        <Scripts />
      </body>
    </html>
  )
}

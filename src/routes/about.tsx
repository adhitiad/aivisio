import { createFileRoute } from '@tanstack/react-router'
import { Mail, MapPin, Phone } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { getSettingsFn } from '@/lib/server-data'
import { MarkdownView } from '@/components/aiviso/markdown-view'
import { SiteLogo } from '@/components/brand/site-logo'

export const Route = createFileRoute('/about')({
  loader: () => getSettingsFn(),
  head: () => ({ meta: [{ title: 'Tentang · AIVISO' }] }),
  component: AboutPage,
})

function AboutPage() {
  const t = useT()
  const settings = Route.useLoaderData()

  const title = settings.aboutTitle.trim() || t('pages.about.title')
  const body = settings.aboutBody.trim() || t('pages.about.body')

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <div className="flex items-center gap-3">
        <SiteLogo logoUrl={settings.siteLogo} size={44} className="text-foreground" />
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
      </div>

      <div className="mt-6">
        <MarkdownView content={body} />
      </div>

      {(settings.contactEmail || settings.contactPhone || settings.contactAddress) && (
        <ul className="mt-8 flex flex-col gap-2 border-t border-border pt-6 text-sm text-muted-foreground">
          {settings.contactEmail && (
            <li className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
              <a href={`mailto:${settings.contactEmail}`} className="hover:text-foreground">
                {settings.contactEmail}
              </a>
            </li>
          )}
          {settings.contactPhone && (
            <li className="flex items-center gap-2">
              <Phone className="h-4 w-4 shrink-0" aria-hidden="true" />
              {settings.contactPhone}
            </li>
          )}
          {settings.contactAddress && (
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
              {settings.contactAddress}
            </li>
          )}
        </ul>
      )}
    </main>
  )
}

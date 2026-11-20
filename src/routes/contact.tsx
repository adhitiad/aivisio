import { createFileRoute } from '@tanstack/react-router'
import { Mail, MapPin, Phone } from 'lucide-react'
import { useT } from '@/lib/i18n'
import { getSettingsFn } from '@/lib/server-data'
import { ContactForm } from '@/components/contact/contact-form'

export const Route = createFileRoute('/contact')({
  loader: () => getSettingsFn(),
  head: () => ({ meta: [{ title: 'Kontak · AIVISO' }] }),
  component: ContactPage,
})

function ContactPage() {
  const t = useT()
  const settings = Route.useLoaderData()

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.2fr]">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          {t('pages.contact.title')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t('pages.contact.subtitle')}
        </p>
        <ul className="mt-6 flex flex-col gap-3 text-sm text-muted-foreground">
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
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {settings.contactAddress}
            </li>
          )}
        </ul>
      </div>
      <ContactForm />
    </main>
  )
}

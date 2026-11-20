import { createFileRoute } from '@tanstack/react-router'
import { getSettingsPageFn } from '@/lib/dashboard.functions'
import { SettingsForm } from '@/components/dashboard/settings-form'

export const Route = createFileRoute('/_protected/dashboard/settings')({
  loader: () => getSettingsPageFn(),
  head: () => ({ meta: [{ title: 'Pengaturan · AIVISO' }] }),
  component: () => <SettingsForm initial={Route.useLoaderData()} />,
})

import { createFileRoute } from '@tanstack/react-router'
import { getProviderRowsFn } from '@/lib/dashboard.functions'
import { ProvidersTable } from '@/components/dashboard/providers-table'

export const Route = createFileRoute('/_protected/dashboard/providers')({
  loader: () => getProviderRowsFn(),
  head: () => ({ meta: [{ title: 'AI Provider · AIVISO' }] }),
  component: () => <ProvidersTable items={Route.useLoaderData()} />,
})

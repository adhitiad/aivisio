import { createFileRoute } from '@tanstack/react-router'
import { getMessageRowsFn } from '@/lib/dashboard.functions'
import { MessagesTable } from '@/components/dashboard/messages-table'

export const Route = createFileRoute('/_protected/dashboard/messages')({
  loader: () => getMessageRowsFn(),
  head: () => ({ meta: [{ title: 'Pesan Kontak · AIVISO' }] }),
  component: () => <MessagesTable items={Route.useLoaderData()} />,
})

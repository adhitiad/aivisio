import { createFileRoute } from '@tanstack/react-router'
import { getHistoryRowsFn } from '@/lib/dashboard.functions'
import { HistoryTable } from '@/components/dashboard/history-table'

export const Route = createFileRoute('/_protected/dashboard/history')({
  loader: () => getHistoryRowsFn(),
  head: () => ({ meta: [{ title: 'Riwayat Generasi · AIVISO' }] }),
  component: () => <HistoryTable items={Route.useLoaderData()} />,
})

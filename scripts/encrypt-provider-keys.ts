import { db } from '../src/lib/db'
import {
  encryptProviderApiKey,
  isEncryptedProviderApiKey,
} from '../src/lib/provider-secrets'

async function main() {
  const rows = await db.aiProvider.findMany({
    where: { apiKey: { not: '' } },
    select: { id: true, apiKey: true },
  })
  const legacy = rows.filter((row) => !isEncryptedProviderApiKey(row.apiKey))

  if (legacy.length === 0) {
    console.info('No legacy provider credentials require encryption.')
    return
  }

  await db.$transaction(
    legacy.map((row) =>
      db.aiProvider.update({
        where: { id: row.id },
        data: { apiKey: encryptProviderApiKey(row.apiKey) },
      }),
    ),
  )

  console.info('Encrypted ' + legacy.length + ' provider credential record(s).')
}

main()
  .catch((error: unknown) => {
    console.error('Provider credential migration failed:', error instanceof Error ? error.message : 'unknown error')
    process.exitCode = 1
  })
  .finally(async () => {
    await db.$disconnect()
  })

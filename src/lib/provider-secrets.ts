import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const PREFIX = 'enc:v1:'

function encryptionKey(): Buffer {
  const masterKey = process.env.PROVIDER_ENCRYPTION_KEY || process.env.BETTER_AUTH_SECRET
  if (!masterKey || masterKey.length < 32) {
    throw new Error('Set PROVIDER_ENCRYPTION_KEY or a strong BETTER_AUTH_SECRET before storing provider credentials.')
  }
  return createHash('sha256').update(masterKey, 'utf8').digest()
}

export function isEncryptedProviderApiKey(value: string): boolean {
  return value.startsWith(PREFIX)
}

export function encryptProviderApiKey(plaintext: string): string {
  if (!plaintext) return ''
  if (isEncryptedProviderApiKey(plaintext)) return plaintext

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return PREFIX + [
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

/**
 * Legacy plaintext values are returned temporarily for backward compatibility.
 * Run the security:encrypt-provider-keys script to encrypt existing rows.
 */
export function decryptProviderApiKey(value: string): string {
  if (!value) return ''
  if (!isEncryptedProviderApiKey(value)) return value

  const parts = value.split(':')
  if (parts.length !== 5 || parts[0] !== 'enc' || parts[1] !== 'v1') {
    throw new Error('Unsupported provider credential encryption format.')
  }

  const iv = Buffer.from(parts[2], 'base64url')
  const tag = Buffer.from(parts[3], 'base64url')
  const ciphertext = Buffer.from(parts[4], 'base64url')
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

export function maskProviderApiKey(value: string): string | null {
  if (!value) return null
  const plaintext = decryptProviderApiKey(value)
  if (plaintext.length <= 8) return '****'
  return '****' + plaintext.slice(-4)
}

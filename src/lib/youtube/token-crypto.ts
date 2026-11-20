import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const PREFIX = 'ytenc:v1:'

function encryptionKey(): Buffer {
  const secret =
    process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY ||
    process.env.PROVIDER_ENCRYPTION_KEY ||
    process.env.BETTER_AUTH_SECRET

  if (!secret || secret.length < 32) {
    throw new Error(
      'Set YOUTUBE_TOKEN_ENCRYPTION_KEY (32+ characters), PROVIDER_ENCRYPTION_KEY, or a strong BETTER_AUTH_SECRET.',
    )
  }

  return createHash('sha256').update(secret, 'utf8').digest()
}

export function encryptYoutubeToken(plaintext: string): string {
  if (!plaintext) throw new Error('Cannot encrypt an empty YouTube token.')
  if (plaintext.startsWith(PREFIX)) return plaintext

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])

  return PREFIX + [
    iv.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

export function decryptYoutubeToken(value: string): string {
  if (!value.startsWith(PREFIX)) {
    throw new Error('YouTube token is not encrypted. Reconnect the YouTube account.')
  }

  const parts = value.slice(PREFIX.length).split(':')
  if (parts.length !== 3) throw new Error('Stored YouTube token has an invalid format.')

  const [iv, tag, ciphertext] = parts
  const decipher = createDecipheriv(
    'aes-256-gcm',
    encryptionKey(),
    Buffer.from(iv, 'base64url'),
  )
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))

  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function isEncryptedYoutubeToken(value: string): boolean {
  return value.startsWith(PREFIX)
}

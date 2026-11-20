import { describe, expect, test } from 'bun:test'
import {
  decryptYoutubeToken,
  encryptYoutubeToken,
  isEncryptedYoutubeToken,
} from './token-crypto'

function withEncryptionKey(key: string, run: () => void): void {
  const originalKey = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY
  process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = key
  try {
    run()
  } finally {
    if (originalKey === undefined) delete process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY
    else process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = originalKey
  }
}

describe('YouTube OAuth token encryption', () => {
  test('encrypts and decrypts tokens with authenticated encryption', () => {
    withEncryptionKey('test-secret-key-that-is-long-enough-32', () => {
      const token = 'refresh-token-never-return-this-to-the-browser'
      const encrypted = encryptYoutubeToken(token)

      expect(encrypted).not.toContain(token)
      expect(isEncryptedYoutubeToken(encrypted)).toBe(true)
      expect(decryptYoutubeToken(encrypted)).toBe(token)
    })
  })

  test('rejects tokens encrypted with a different key', () => {
    withEncryptionKey('test-secret-key-that-is-long-enough-32', () => {
      const encrypted = encryptYoutubeToken('access-token')
      let rejected = false
      try {
        withEncryptionKey('different-secret-key-that-is-long-32', () => {
          decryptYoutubeToken(encrypted)
        })
      } catch {
        rejected = true
      }
      expect(rejected).toBe(true)
    })
  })

  test('rejects unencrypted legacy values', () => {
    withEncryptionKey('test-secret-key-that-is-long-enough-32', () => {
      let rejected = false
      try {
        decryptYoutubeToken('plain-token')
      } catch {
        rejected = true
      }
      expect(rejected).toBe(true)
    })
  })
})

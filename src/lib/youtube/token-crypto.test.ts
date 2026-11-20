import { afterEach, describe, expect, it } from 'bun:test'
import {
  decryptYoutubeToken,
  encryptYoutubeToken,
  isEncryptedYoutubeToken,
} from './token-crypto'

const originalKey = process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY

afterEach(() => {
  if (originalKey === undefined) delete process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY
  else process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = originalKey
})

describe('YouTube OAuth token encryption', () => {
  it('encrypts and decrypts tokens with authenticated encryption', () => {
    process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = 'test-secret-key-that-is-long-enough-32'
    const token = 'refresh-token-never-return-this-to-the-browser'
    const encrypted = encryptYoutubeToken(token)

    expect(encrypted).not.toContain(token)
    expect(isEncryptedYoutubeToken(encrypted)).toBe(true)
    expect(decryptYoutubeToken(encrypted)).toBe(token)
  })

  it('rejects tokens encrypted with a different key', () => {
    process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = 'test-secret-key-that-is-long-enough-32'
    const encrypted = encryptYoutubeToken('access-token')
    process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = 'different-secret-key-that-is-long-32'
    expect(() => decryptYoutubeToken(encrypted)).toThrow()
  })

  it('rejects unencrypted legacy values', () => {
    process.env.YOUTUBE_TOKEN_ENCRYPTION_KEY = 'test-secret-key-that-is-long-enough-32'
    expect(() => decryptYoutubeToken('plain-token')).toThrow()
  })
})

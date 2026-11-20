import { describe, expect, test } from 'bun:test'
import {
  decryptProviderApiKey,
  encryptProviderApiKey,
  isEncryptedProviderApiKey,
  maskProviderApiKey,
} from './provider-secrets'

describe('provider API key encryption', () => {
  test('encrypts and decrypts a credential without returning plaintext at rest', () => {
    const previous = process.env.PROVIDER_ENCRYPTION_KEY
    process.env.PROVIDER_ENCRYPTION_KEY = 'test-only-key-material-that-is-at-least-32-characters'
    try {
      const encrypted = encryptProviderApiKey('provider-secret-value')
      expect(isEncryptedProviderApiKey(encrypted)).toBe(true)
      expect(encrypted).not.toContain('provider-secret-value')
      expect(decryptProviderApiKey(encrypted)).toBe('provider-secret-value')
      expect(maskProviderApiKey(encrypted)).toBe('****alue')
    } finally {
      if (previous === undefined) delete process.env.PROVIDER_ENCRYPTION_KEY
      else process.env.PROVIDER_ENCRYPTION_KEY = previous
    }
  })

  test('keeps legacy plaintext readable during the migration window', () => {
    expect(decryptProviderApiKey('legacy-key')).toBe('legacy-key')
  })
})

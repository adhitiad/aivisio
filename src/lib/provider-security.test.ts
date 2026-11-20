import { describe, expect, test } from 'bun:test'
import { isPrivateOrReservedAddress } from './provider-security'

describe('provider address classification', () => {
  test('blocks private, loopback, link-local and reserved IPv4 ranges', () => {
    for (const address of ['127.0.0.1', '10.0.0.4', '172.16.0.1', '192.168.1.2', '169.254.169.254']) {
      expect(isPrivateOrReservedAddress(address)).toBe(true)
    }
  })

  test('blocks local IPv6 ranges and accepts a public address', () => {
    expect(isPrivateOrReservedAddress('::1')).toBe(true)
    expect(isPrivateOrReservedAddress('fd00::1')).toBe(true)
    expect(isPrivateOrReservedAddress('fe80::1')).toBe(true)
    expect(isPrivateOrReservedAddress('2606:4700:4700::1111')).toBe(false)
    expect(isPrivateOrReservedAddress('8.8.8.8')).toBe(false)
  })
})

import { describe, expect, test } from 'bun:test'
import { sameOriginGuard } from './http'

describe('same-origin mutation guard', () => {
  test('allows same-origin requests', () => {
    const origin = process.env.SITE_URL || 'https://studio.example'
    const request = new Request(origin + '/api/settings', {
      method: 'PUT',
      headers: {
        Origin: origin,
        'Sec-Fetch-Site': 'same-origin',
      },
    })
    expect(sameOriginGuard(request)).toBe(null)
  })

  test('rejects cross-site browser mutations', () => {
    const origin = process.env.SITE_URL || 'https://studio.example'
    const request = new Request(origin + '/api/settings', {
      method: 'PUT',
      headers: {
        Origin: 'https://attacker.example',
        'Sec-Fetch-Site': 'cross-site',
      },
    })
    expect(sameOriginGuard(request) instanceof Response).toBe(true)
  })

  test('allows safe GET requests without origin validation', () => {
    const request = new Request('https://studio.example/api/settings')
    expect(sameOriginGuard(request)).toBe(null)
  })
})

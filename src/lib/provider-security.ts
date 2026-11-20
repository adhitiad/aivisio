import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

function isPrivateIPv4(address: string): boolean {
  const octets = address.split('.').map(Number)
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const [a, b] = octets
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 100 && b >= 64 && b <= 127) ||
    a >= 224
  )
}

function isPrivateIPv6(address: string): boolean {
  const value = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (value === '::' || value === '::1') return true
  if (value.startsWith('::ffff:')) {
    const mapped = value.slice('::ffff:'.length)
    if (isIP(mapped) === 4) return isPrivateIPv4(mapped)
    return true
  }
  return (
    value.startsWith('fc') ||
    value.startsWith('fd') ||
    /^fe[89ab]/.test(value) ||
    value.startsWith('ff')
  )
}

export function isPrivateOrReservedAddress(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return isPrivateIPv4(address)
  if (version === 6) return isPrivateIPv6(address)
  return true
}

/**
 * Validates provider URLs before server-side requests to prevent SSRF.
 * Local Ollama is allowed only in non-production development environments.
 */
export async function assertSafeProviderBaseUrl(baseUrl: string, providerKey: string): Promise<string> {
  let url: URL
  try {
    url = new URL(baseUrl)
  } catch {
    throw new Error('Provider base URL is invalid.')
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new Error('Provider base URL must not contain credentials, query parameters, or fragments.')
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
  const localOllama =
    providerKey === 'ollama' &&
    process.env.NODE_ENV !== 'production' &&
    ['localhost', '127.0.0.1', '::1'].includes(hostname)

  if (localOllama && url.protocol === 'http:') return url.toString()

  if (url.protocol !== 'https:') {
    throw new Error('External AI providers must use HTTPS.')
  }

  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.test')
  ) {
    throw new Error('Private and local provider hosts are not allowed.')
  }

  if (isIP(hostname) !== 0) {
    if (isPrivateOrReservedAddress(hostname)) {
      throw new Error('Private or reserved IP addresses are not allowed for AI providers.')
    }
    return url.toString()
  }

  let addresses: Array<{ address: string; family: number }>
  try {
    addresses = await lookup(hostname, { all: true, verbatim: true })
  } catch {
    throw new Error('Provider hostname could not be resolved.')
  }

  if (addresses.length === 0 || addresses.some((entry) => isPrivateOrReservedAddress(entry.address))) {
    throw new Error('Provider hostname resolves to a private or reserved address.')
  }

  return url.toString()
}

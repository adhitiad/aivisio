import { describe, expect, test } from 'bun:test'
import { parseRespFrame } from './resp-client'

describe('RESP2 parser', () => {
  test('parses simple strings and integers', () => {
    const pong = parseRespFrame(Buffer.from('+PONG\r\n'))
    const integer = parseRespFrame(Buffer.from(':42\r\n'))
    expect(pong?.value).toBe('PONG')
    expect(pong?.next).toBe(7)
    expect(integer?.value).toBe(42)
    expect(integer?.next).toBe(5)
  })

  test('parses bulk strings and null bulk values', () => {
    const bulk = parseRespFrame(Buffer.from('$5\r\nhello\r\n'))
    const missing = parseRespFrame(Buffer.from('$-1\r\n'))
    expect(bulk?.value).toBe('hello')
    expect(bulk?.next).toBe(11)
    expect(missing?.value).toBe(null)
    expect(missing?.next).toBe(5)
  })

  test('parses nested arrays and waits for incomplete frames', () => {
    const frame = Buffer.from('*2\r\n$3\r\nkey\r\n$5\r\nvalue\r\n')
    const parsed = parseRespFrame(frame)
    expect(Array.isArray(parsed?.value)).toBe(true)
    if (Array.isArray(parsed?.value)) {
      expect(parsed.value[0]).toBe('key')
      expect(parsed.value[1]).toBe('value')
    }
    expect(parsed?.next).toBe(frame.length)
    expect(parseRespFrame(Buffer.from('$8\r\nshort'))).toBe(null)
  })

  test('surfaces Redis error replies as errors', () => {
    const value = parseRespFrame(Buffer.from('-ERR bad command\r\n'))?.value
    expect(value instanceof Error).toBe(true)
  })
})

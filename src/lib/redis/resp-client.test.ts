import { describe, expect, test } from 'bun:test'
import { parseRespFrame } from './resp-client'

describe('RESP2 parser', () => {
  test('parses simple strings and integers', () => {
    expect(parseRespFrame(Buffer.from('+PONG\r\n'))).toEqual({ value: 'PONG', next: 7 })
    expect(parseRespFrame(Buffer.from(':42\r\n'))).toEqual({ value: 42, next: 5 })
  })

  test('parses bulk strings and null bulk values', () => {
    expect(parseRespFrame(Buffer.from('$5\r\nhello\r\n'))).toEqual({ value: 'hello', next: 11 })
    expect(parseRespFrame(Buffer.from('$-1\r\n'))).toEqual({ value: null, next: 5 })
  })

  test('parses nested arrays and waits for incomplete frames', () => {
    const frame = Buffer.from('*2\r\n$3\r\nkey\r\n$5\r\nvalue\r\n')
    expect(parseRespFrame(frame)).toEqual({ value: ['key', 'value'], next: frame.length })
    expect(parseRespFrame(Buffer.from('$8\r\nshort'))).toBeNull()
  })

  test('surfaces Redis error replies as errors', () => {
    expect(parseRespFrame(Buffer.from('-ERR bad command\r\n'))?.value).toBeInstanceOf(Error)
  })
})

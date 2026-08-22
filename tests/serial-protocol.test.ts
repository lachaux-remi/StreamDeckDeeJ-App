import { expect, test } from 'vitest'
import {
  BoundedSerialFrameDecoder,
  ExpectedIrEchoTracker,
  MAX_SERIAL_FRAME_BYTES,
  parseSerialFrame
} from '@main/services/serial-protocol'

const frame = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value)}\r\n`)

test('decodes official firmware frames split across CRLF chunks', () => {
  const decoder = new BoundedSerialFrameDecoder()
  const deej = frame({ type: 'deej', value: { 0: 0, 1: 256, 2: 512, 3: 768, 4: 1023 } })
  const deck = frame({ type: 'deck', state: 'hold', value: 15 })

  const first = decoder.write(deej.subarray(0, 12), 100)
  const second = decoder.write(Buffer.concat([deej.subarray(12), deck]), 100)

  expect(first).toEqual({ frames: [], rejections: [] })
  expect(second.frames).toHaveLength(2)
  expect(parseSerialFrame(second.frames[0])).toEqual({
    message: { type: 'deej', value: { 0: 0, 1: 256, 2: 512, 3: 768, 4: 1023 } }
  })
  expect(parseSerialFrame(second.frames[1])).toEqual({
    message: { type: 'deck', state: 'hold', value: 15 }
  })
})

test('accepts the application contract for extensible compatible controllers', () => {
  expect(parseSerialFrame(Buffer.from('{"type":"deck","state":"released","value":63}'))).toEqual({
    message: { type: 'deck', state: 'released', value: 63 }
  })
  expect(parseSerialFrame(Buffer.from('{"type":"deej","value":{"15":1023}}'))).toEqual({
    message: { type: 'deej', value: { 15: 1023 } }
  })
})

test('rejects the official firmware IR echo because it is not JSON', () => {
  expect(parseSerialFrame(Buffer.from('9000,4500,560,560'))).toEqual({
    rejection: 'invalid JSON'
  })
})

test('consumes only an exact recent echo for an IR command sent by the app', () => {
  const echoes = new ExpectedIrEchoTracker()
  echoes.recordCommand('ir:9000,4500,560,560', 1_000)

  expect(echoes.consume(Buffer.from('1,2,3'), 1_001)).toBe(false)
  expect(echoes.consume(Buffer.from('9000,4500,560,560'), 1_002)).toBe(true)
  expect(echoes.consume(Buffer.from('9000,4500,560,560'), 1_003)).toBe(false)
})

test('does not hide unsolicited CSV or expired IR echoes from the strict parser', () => {
  const echoes = new ExpectedIrEchoTracker()
  const firmwareEcho = Buffer.from('9000,4500,560,560')
  echoes.recordCommand('ir:9000,4500,560,560\r\n', 1_000)

  expect(echoes.consume(firmwareEcho, 7_000)).toBe(false)
  expect(parseSerialFrame(firmwareEcho)).toEqual({ rejection: 'invalid JSON' })
})

test('does not hide a non-CSV echo even after an IR-prefixed command', () => {
  const echoes = new ExpectedIrEchoTracker()
  const invalidEcho = Buffer.from('not,csv')
  echoes.recordCommand('ir:not,csv', 1_000)

  expect(echoes.consume(invalidEcho, 1_001)).toBe(false)
  expect(parseSerialFrame(invalidEcho)).toEqual({ rejection: 'invalid JSON' })
})

test('clears pending IR echoes when the serial connection changes', () => {
  const echoes = new ExpectedIrEchoTracker()
  echoes.recordCommand('ir:9000,4500,560,560', 1_000)

  echoes.clear()

  expect(echoes.consume(Buffer.from('9000,4500,560,560'), 1_001)).toBe(false)
})

test('keeps IR echo tracking bounded and ignores other command types', () => {
  const echoes = new ExpectedIrEchoTracker()
  echoes.recordCommand('macro:9000,4500', 1_000)
  for (let value = 0; value <= 16; value += 1) {
    echoes.recordCommand(`ir:${value}`, 1_000)
  }

  expect(echoes.consume(Buffer.from('9000,4500'), 1_001)).toBe(false)
  expect(echoes.consume(Buffer.from('0'), 1_001)).toBe(false)
  expect(echoes.consume(Buffer.from('16'), 1_001)).toBe(true)
})

test('rejects malformed, unknown, and non-strict messages', () => {
  const invalidFrames = [
    Buffer.from('{'),
    Buffer.from('{}'),
    Buffer.from('{"type":"other","value":0}'),
    Buffer.from('{"type":"deck","state":"clicked","value":0}'),
    Buffer.from('{"type":"deck","state":"pressed","value":"0"}'),
    Buffer.from('{"type":"deck","state":"pressed","value":64}'),
    Buffer.from('{"type":"deck","state":"pressed","value":0,"extra":true}'),
    Buffer.from('{"type":"deej","value":{"01":1}}'),
    Buffer.from('{"type":"deej","value":{"0":1.5}}'),
    Buffer.from('{"type":"deej","value":{"0":1024}}'),
    Buffer.from('{"type":"deej","value":[]}')
  ]

  for (const invalidFrame of invalidFrames) {
    expect(parseSerialFrame(invalidFrame)).toHaveProperty('rejection')
  }
})

test('bounds an unterminated frame and recovers at the next delimiter', () => {
  const decoder = new BoundedSerialFrameDecoder()
  const oversized = decoder.write(Buffer.alloc(MAX_SERIAL_FRAME_BYTES * 4, 0x61), 100)

  expect(oversized.rejections).toEqual(['frame too large'])
  expect(decoder.bufferedByteLength).toBeLessThanOrEqual(MAX_SERIAL_FRAME_BYTES)

  const recovery = decoder.write(
    Buffer.concat([
      Buffer.from('\r\n'),
      frame({
        type: 'deck',
        state: 'pressed',
        value: 0
      })
    ]),
    100
  )
  expect(recovery.frames).toHaveLength(1)
  expect(parseSerialFrame(recovery.frames[0])).toEqual({
    message: { type: 'deck', state: 'pressed', value: 0 }
  })
})

test('preserves a carriage return that is not followed by a line feed', () => {
  const decoder = new BoundedSerialFrameDecoder()
  const decoded = decoder.write(Buffer.from('part 1\rpart 2\r\n'), 100)

  expect(decoded.frames).toEqual([Buffer.from('part 1\rpart 2')])
})

test('limits complete frame processing frequency', () => {
  const decoder = new BoundedSerialFrameDecoder(512, 2)
  const threeFrames = Buffer.concat([
    frame({ type: 'deck', state: 'pressed', value: 0 }),
    frame({ type: 'deck', state: 'released', value: 0 }),
    frame({ type: 'deej', value: { 0: 100 } })
  ])

  const limited = decoder.write(threeFrames, 100)
  expect(limited.frames).toHaveLength(2)
  expect(limited.rejections).toEqual(['frame rate exceeded'])

  const nextWindow = decoder.write(frame({ type: 'deej', value: { 0: 100 } }), 1_100)
  expect(nextWindow.frames).toHaveLength(1)
  expect(nextWindow.rejections).toEqual([])
})

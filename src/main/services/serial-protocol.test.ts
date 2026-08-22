import { expect, test } from 'vitest'
import {
  BoundedSerialFrameDecoder,
  MAX_SERIAL_FRAME_BYTES,
  parseSerialFrame
} from './serial-protocol'

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

test('rejects malformed, unknown, and non-strict messages', () => {
  const invalidFrames = [
    Buffer.from('{'),
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

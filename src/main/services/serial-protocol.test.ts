import assert from 'node:assert/strict'
import test from 'node:test'
import {
  BoundedSerialFrameDecoder,
  MAX_SERIAL_FRAME_BYTES,
  parseSerialFrame
} from './serial-protocol.ts'

const frame = (value: unknown): Buffer => Buffer.from(`${JSON.stringify(value)}\r\n`)

test('decodes official firmware frames split across CRLF chunks', () => {
  const decoder = new BoundedSerialFrameDecoder()
  const deej = frame({ type: 'deej', value: { 0: 0, 1: 256, 2: 512, 3: 768, 4: 1023 } })
  const deck = frame({ type: 'deck', state: 'hold', value: 15 })

  const first = decoder.write(deej.subarray(0, 12), 100)
  const second = decoder.write(Buffer.concat([deej.subarray(12), deck]), 100)

  assert.deepEqual(first, { frames: [], rejections: [] })
  assert.equal(second.frames.length, 2)
  assert.deepEqual(parseSerialFrame(second.frames[0]), {
    message: { type: 'deej', value: { 0: 0, 1: 256, 2: 512, 3: 768, 4: 1023 } }
  })
  assert.deepEqual(parseSerialFrame(second.frames[1]), {
    message: { type: 'deck', state: 'hold', value: 15 }
  })
})

test('accepts the application contract for extensible compatible controllers', () => {
  assert.deepEqual(parseSerialFrame(Buffer.from('{"type":"deck","state":"released","value":63}')), {
    message: { type: 'deck', state: 'released', value: 63 }
  })
  assert.deepEqual(parseSerialFrame(Buffer.from('{"type":"deej","value":{"15":1023}}')), {
    message: { type: 'deej', value: { 15: 1023 } }
  })
})

test('rejects the official firmware IR echo because it is not JSON', () => {
  assert.deepEqual(parseSerialFrame(Buffer.from('9000,4500,560,560')), {
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
    assert.ok('rejection' in parseSerialFrame(invalidFrame))
  }
})

test('bounds an unterminated frame and recovers at the next delimiter', () => {
  const decoder = new BoundedSerialFrameDecoder()
  const oversized = decoder.write(Buffer.alloc(MAX_SERIAL_FRAME_BYTES * 4, 0x61), 100)

  assert.deepEqual(oversized.rejections, ['frame too large'])
  assert.ok(decoder.bufferedByteLength <= MAX_SERIAL_FRAME_BYTES)

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
  assert.equal(recovery.frames.length, 1)
  assert.deepEqual(parseSerialFrame(recovery.frames[0]), {
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
  assert.equal(limited.frames.length, 2)
  assert.deepEqual(limited.rejections, ['frame rate exceeded'])

  const nextWindow = decoder.write(frame({ type: 'deej', value: { 0: 100 } }), 1_100)
  assert.equal(nextWindow.frames.length, 1)
  assert.deepEqual(nextWindow.rejections, [])
})

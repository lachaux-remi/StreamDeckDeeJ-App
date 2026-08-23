import { expect, test, vi } from 'vitest'
import {
  MAX_DISCORD_RPC_BUFFER_BYTES,
  MAX_DISCORD_RPC_FRAME_BYTES,
  DiscordRpcFrameReader
} from '@main/services/discord-rpc-codec'

function frame(op: number, payload: string): Buffer {
  const encoded = Buffer.from(payload)
  const result = Buffer.alloc(8 + encoded.length)
  result.writeUInt32LE(op, 0)
  result.writeUInt32LE(encoded.length, 4)
  encoded.copy(result, 8)
  return result
}

test('decodes normal Discord RPC frames split or combined across socket chunks', () => {
  const destroy = vi.fn()
  const reader = new DiscordRpcFrameReader(destroy)
  const first = frame(1, '{"evt":"READY"}')
  const second = frame(1, '{"evt":"VOICE_SETTINGS_UPDATE"}')

  expect(reader.push(first.subarray(0, 5))).toEqual([])
  expect(reader.push(Buffer.concat([first.subarray(5), second]))).toEqual([
    { op: 1, payload: '{"evt":"READY"}' },
    { op: 1, payload: '{"evt":"VOICE_SETTINGS_UPDATE"}' }
  ])
  expect(destroy).not.toHaveBeenCalled()
})

test('destroys the connection before buffering a declared oversized frame', () => {
  const destroy = vi.fn()
  const reader = new DiscordRpcFrameReader(destroy)
  const header = Buffer.alloc(8)
  header.writeUInt32LE(1, 0)
  header.writeUInt32LE(MAX_DISCORD_RPC_FRAME_BYTES + 1, 4)

  expect(reader.push(header)).toEqual([])
  expect(destroy).toHaveBeenCalledOnce()
  expect(reader.bufferedBytes).toBe(0)

  expect(reader.push(frame(1, '{}'))).toEqual([])
  reader.reset()
  expect(reader.push(frame(1, '{}'))).toEqual([{ op: 1, payload: '{}' }])
})

test('keeps its buffer bounded while decoding multiple valid frames from one large chunk', () => {
  const destroy = vi.fn()
  const reader = new DiscordRpcFrameReader(destroy)
  const payload = 'x'.repeat(Math.floor(MAX_DISCORD_RPC_FRAME_BYTES * 0.6))
  const combined = Buffer.concat([frame(1, payload), frame(1, payload)])

  expect(combined.length).toBeGreaterThan(MAX_DISCORD_RPC_BUFFER_BYTES)
  expect(reader.push(combined)).toEqual([
    { op: 1, payload },
    { op: 1, payload }
  ])
  expect(destroy).not.toHaveBeenCalled()
  expect(reader.bufferedBytes).toBe(0)
})

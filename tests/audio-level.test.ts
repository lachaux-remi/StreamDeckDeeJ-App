import { expect, test } from 'vitest'
import { LEVEL_FLOOR_DB, peakToLevel, S16PeakReader } from '@main/services/audio-level'

function samples(...values: number[]): Buffer {
  const buffer = Buffer.alloc(values.length * 2)
  values.forEach((value, index) => buffer.writeInt16LE(value, index * 2))
  return buffer
}

test('maps peaks onto a -60 dBFS…0 dBFS meter scale', () => {
  expect(LEVEL_FLOOR_DB).toBe(-60)
  expect(peakToLevel(0)).toBe(0)
  expect(peakToLevel(Number.NaN)).toBe(0)
  expect(peakToLevel(0.001)).toBeCloseTo(0, 5)
  expect(peakToLevel(0.0316)).toBeCloseTo(0.5, 2)
  expect(peakToLevel(1)).toBe(1)
  expect(peakToLevel(2)).toBe(1)
})

test('reads the absolute peak of signed 16-bit little-endian samples', () => {
  const reader = new S16PeakReader()
  expect(reader.push(samples(0, 1000, -16384, 200))).toBeCloseTo(0.5, 5)
  expect(reader.push(samples(-32768))).toBe(1)
  expect(reader.push(Buffer.alloc(0))).toBe(0)
})

test('keeps a sample split across chunks instead of misreading it', () => {
  const reader = new S16PeakReader()
  const data = samples(100, -16384)
  expect(reader.push(data.subarray(0, 3))).toBeCloseTo(100 / 32768, 6)
  expect(reader.push(data.subarray(3))).toBeCloseTo(0.5, 5)
})

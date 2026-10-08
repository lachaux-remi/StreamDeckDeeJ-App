import { expect, test } from 'vitest'
import { isAudioLevels } from '@renderer/types/audio-levels.types'

test('accepts per-slider levels between 0 and 1 only', () => {
  expect(isAudioLevels({})).toBe(true)
  expect(isAudioLevels({ '0': 0, '1': 0.5, '15': 1 })).toBe(true)
  for (const invalid of [
    null,
    [],
    'levels',
    { '0': 1.5 },
    { '0': -0.1 },
    { '0': Number.NaN },
    { '0': '0.5' },
    { slider: 0.5 },
    { '100': 0.5 },
    Object.fromEntries(Array.from({ length: 17 }, (_, i) => [String(i), 0]))
  ]) {
    expect(isAudioLevels(invalid)).toBe(false)
  }
})

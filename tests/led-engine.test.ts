import { expect, test } from 'vitest'
import type { LedMode, LedProfile } from '@main/types/settings.types'
import {
  LedEngine,
  applyPressEffect,
  conditionIntensity,
  interpolateColor,
  pressEffectDuration
} from '@main/services/led-engine'

const red = { r: 255, g: 0, b: 0 }
const blue = { r: 0, g: 0, b: 255 }
const black = { r: 0, g: 0, b: 0 }
const white = { r: 255, g: 255, b: 255 }

function profile(mode: LedMode, overrides: Partial<LedProfile> = {}): LedProfile {
  return {
    mode,
    speed: 50,
    brightness: 100,
    startColor: red,
    endColor: blue,
    direction: 'horizontal',
    ...overrides
  }
}

const engine = new LedEngine()

test('keeps every mode within 16 valid colors over time', () => {
  const modes: LedMode[] = [
    'static',
    'rainbow',
    'wave',
    'pulse',
    'colorshift',
    'visor',
    'sequential',
    'spinner',
    'twinkle',
    'fire',
    'gradient',
    'rainbow-wave'
  ]
  for (const mode of modes) {
    for (const direction of ['horizontal', 'vertical', 'diagonal'] as const) {
      for (const t of [0, 123, 4_567, 98_765]) {
        const colors = engine.compute(profile(mode, { direction }), 16, 4, t)
        expect(colors).toHaveLength(16)
        for (const color of colors) {
          for (const channel of [color.r, color.g, color.b]) {
            expect(Number.isInteger(channel) && channel >= 0 && channel <= 255).toBe(true)
          }
        }
      }
    }
  }
  expect(engine.compute(profile('unknown' as LedMode), 2, 4, 0)).toEqual([black, black])
})

test('draws a fixed gradient from the start to the end color along the direction', () => {
  const horizontal = engine.compute(profile('gradient'), 16, 4, 0)
  expect(horizontal[0]).toEqual(red)
  expect(horizontal[3]).toEqual(blue)
  expect(horizontal[12]).toEqual(red)
  expect(engine.compute(profile('gradient'), 16, 4, 5_000)).toEqual(horizontal)

  const vertical = engine.compute(profile('gradient', { direction: 'vertical' }), 16, 4, 0)
  expect(vertical[3]).toEqual(red)
  expect(vertical[12]).toEqual(blue)
})

test('scrolls the rainbow wave along the direction', () => {
  const start = engine.compute(profile('rainbow-wave'), 16, 4, 0)
  expect(start[0]).toEqual(red)
  expect(start[4]).toEqual(start[0])
  expect(start[1]).not.toEqual(start[0])
  expect(engine.compute(profile('rainbow-wave'), 16, 4, 700)).not.toEqual(start)
})

test('lights only some keys when twinkling and repeats the same frame for the same time', () => {
  const frame = engine.compute(profile('twinkle'), 16, 4, 1_234)
  expect(engine.compute(profile('twinkle'), 16, 4, 1_234)).toEqual(frame)
  const lit = Array.from(
    { length: 50 },
    (_, step) =>
      engine.compute(profile('twinkle'), 16, 4, step * 97).filter((c) => c.r + c.g + c.b > 0).length
  )
  expect(Math.max(...lit)).toBeGreaterThan(0)
  expect(Math.min(...lit)).toBeLessThan(16)
})

test('keeps the fire hotter at the bottom of the grid', () => {
  const heat = (row: number): number => {
    let total = 0
    for (let t = 0; t < 20_000; t += 250) {
      const colors = engine.compute(profile('fire', { endColor: white }), 16, 4, t)
      for (let col = 0; col < 4; col++) {
        const c = colors[row * 4 + col]
        total += c.r + c.g + c.b
      }
    }
    return total
  }
  expect(heat(3)).toBeGreaterThan(heat(0))
  expect(engine.compute(profile('fire'), 4, 4, 0)).toHaveLength(4)
})

test('fades a flash on the pressed key only', () => {
  const effect = { type: 'flash' as const, color: white }
  const base = Array.from({ length: 4 }, () => ({ ...black }))
  const presses = [{ index: 1, at: 1_000 }]

  expect(applyPressEffect(base, effect, presses, 2, 100, 1_000)).toEqual([
    black,
    white,
    black,
    black
  ])
  expect(applyPressEffect(base, effect, presses, 2, 100, 1_200)[1].r).toBeLessThan(255)
  expect(applyPressEffect(base, effect, presses, 2, 100, 1_400)).toEqual(base)
  expect(applyPressEffect(base, effect, presses, 2, 100, 999)).toEqual(base)
  expect(applyPressEffect(base, effect, presses, 2, 50, 1_000)[1]).toEqual({
    r: 128,
    g: 128,
    b: 128
  })
  expect(pressEffectDuration(effect, 16, 4)).toBe(400)
})

test('spreads a ripple outward from the pressed key', () => {
  const effect = { type: 'ripple' as const, color: white }
  const base = Array.from({ length: 16 }, () => ({ ...black }))
  const presses = [{ index: 0, at: 0 }]
  const brightness = (t: number, index: number): number =>
    applyPressEffect(base, effect, presses, 4, 100, t)[index].r

  expect(brightness(0, 0)).toBeGreaterThan(brightness(0, 3))
  expect(brightness(270, 3)).toBeGreaterThan(brightness(270, 0))
  const duration = pressEffectDuration(effect, 16, 4)
  expect(duration).toBeGreaterThan(270)
  expect(applyPressEffect(base, effect, presses, 4, 100, duration)).toEqual(base)
})

test('blinks or pulses an active condition color over the normal color', () => {
  expect(conditionIntensity(undefined, 250)).toBe(1)
  expect(conditionIntensity('blink', 250)).toBe(1)
  expect(conditionIntensity('blink', 750)).toBe(0)
  expect(conditionIntensity('pulse', 0)).toBeCloseTo(1)
  expect(conditionIntensity('pulse', 750)).toBeCloseTo(0)
  expect(conditionIntensity('pulse', 375)).toBeCloseTo(0.5)
  // Faster conditions shorten both periods; 75 halves them, 25 doubles them.
  expect(conditionIntensity('blink', 250, 75)).toBe(0)
  expect(conditionIntensity('blink', 750, 25)).toBe(1)
  expect(conditionIntensity('pulse', 375, 75)).toBeCloseTo(0)
  expect(conditionIntensity('blink', 10_000, 0)).toBe(conditionIntensity('blink', 10_000, 1))
  const normal = { r: 0, g: 100, b: 200 }
  const condition = { r: 200, g: 0, b: 0 }
  expect(interpolateColor(normal, condition, 1)).toEqual(condition)
  expect(interpolateColor(normal, condition, 0)).toEqual(normal)
  expect(interpolateColor(normal, condition, 0.5)).toEqual({ r: 100, g: 50, b: 100 })
})

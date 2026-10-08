import { expect, test } from 'vitest'
import { compareHomeAssistantAttribute, conditionService } from '@main/services/condition.service'
import type { LedCondition } from '@main/types/settings.types'

test('compares numeric attributes numerically, including numeric strings', () => {
  expect(compareHomeAssistantAttribute(120, 'gt', '100')).toBe(true)
  expect(compareHomeAssistantAttribute('21.5', 'lte', '21.5')).toBe(true)
  expect(compareHomeAssistantAttribute(19, 'gte', '20')).toBe(false)
  expect(compareHomeAssistantAttribute(19, 'lt', ' 20 ')).toBe(true)
  expect(compareHomeAssistantAttribute(255, 'eq', '255.0')).toBe(true)
  expect(compareHomeAssistantAttribute(0, 'neq', '0')).toBe(false)
  expect(compareHomeAssistantAttribute(1e3, 'eq', '1000')).toBe(true)
})

test('compares other values as case-insensitive text and never orders text', () => {
  expect(compareHomeAssistantAttribute('Heat', 'eq', 'heat')).toBe(true)
  expect(compareHomeAssistantAttribute('heat', 'neq', 'cool')).toBe(true)
  expect(compareHomeAssistantAttribute(true, 'eq', 'true')).toBe(true)
  // "12abc" is not the number 12.
  expect(compareHomeAssistantAttribute('12abc', 'eq', '12')).toBe(false)
  expect(compareHomeAssistantAttribute('12abc', 'gt', '1')).toBe(false)
  expect(compareHomeAssistantAttribute('b', 'gt', 'a')).toBe(false)
  expect(compareHomeAssistantAttribute({ a: 1 }, 'eq', '{"a":1}')).toBe(true)
})

test('matches text fragments and list elements with contains', () => {
  expect(compareHomeAssistantAttribute('Living Room Lamp', 'contains', 'room')).toBe(true)
  expect(compareHomeAssistantAttribute(['hs', 'color_temp'], 'contains', 'HS')).toBe(true)
  expect(compareHomeAssistantAttribute(['hs', 'color_temp'], 'contains', 'color')).toBe(false)
  expect(compareHomeAssistantAttribute(42, 'contains', '4')).toBe(true)
})

test('treats a missing attribute as not matching', () => {
  for (const operator of ['eq', 'neq', 'gt', 'contains'] as const) {
    expect(compareHomeAssistantAttribute(undefined, operator, '')).toBe(false)
    expect(compareHomeAssistantAttribute(null, operator, '1')).toBe(false)
  }
})

test('evaluates attribute conditions against the button entity attributes', () => {
  const color = { r: 255, g: 0, b: 0 }
  const bright: LedCondition = {
    type: 'ha-attr',
    color,
    haAttribute: 'brightness',
    haOperator: 'gte',
    haValue: '128'
  }
  expect(conditionService.evaluate(bright, 'on', { brightness: 200 })).toBe(true)
  expect(conditionService.evaluate(bright, 'on', { brightness: 64 })).toBe(false)
  expect(conditionService.evaluate(bright, 'on')).toBe(false)
  expect(conditionService.evaluate({ type: 'ha-attr', color }, 'on', { brightness: 1 })).toBe(false)
  expect(
    conditionService.evaluate(
      { type: 'ha-attr', color, haAttribute: 'effect', haOperator: 'eq' },
      'on',
      { effect: '' }
    )
  ).toBe(true)
  expect(
    conditionService.resolveColor(
      [{ type: 'ha-off', color: { r: 0, g: 0, b: 255 } }, bright],
      'on',
      { brightness: 255 }
    )
  ).toEqual(color)
})

test('evaluates microphone, Discord and Home Assistant state conditions', () => {
  const color = { r: 0, g: 0, b: 255 }
  // Before initialization nothing is muted, deafened or streaming.
  for (const type of ['mic-mute', 'discord-mute', 'discord-deafen', 'discord-stream'] as const) {
    expect(conditionService.evaluate({ type, color })).toBe(false)
  }
  conditionService.init(
    { isMuted: () => true },
    { isMuted: () => false, isDeafened: () => true, isStreaming: () => true }
  )
  expect(conditionService.evaluate({ type: 'mic-mute', color })).toBe(true)
  expect(conditionService.evaluate({ type: 'discord-mute', color })).toBe(false)
  expect(conditionService.evaluate({ type: 'discord-deafen', color })).toBe(true)
  expect(conditionService.evaluate({ type: 'discord-stream', color })).toBe(true)
  expect(conditionService.evaluate({ type: 'ha-on', color }, 'on')).toBe(true)
  expect(conditionService.evaluate({ type: 'ha-off', color }, 'on')).toBe(false)
  expect(conditionService.resolveColor([{ type: 'ha-off', color }], 'on')).toBeUndefined()
})

test('does not treat non-finite numbers as numeric', () => {
  expect(compareHomeAssistantAttribute(Number.NaN, 'eq', 'nan')).toBe(true)
  expect(compareHomeAssistantAttribute(Number.POSITIVE_INFINITY, 'gt', '1')).toBe(false)
})

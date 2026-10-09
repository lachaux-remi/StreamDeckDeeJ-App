import { expect, test } from 'vitest'
import {
  audioSessionTargets,
  deejTargetLabel,
  homeAssistantSliderEntity,
  homeAssistantTarget,
  isHomeAssistantTarget
} from '../src/shared/deej-targets'

test('recognizes Home Assistant slider targets and their supported domains', () => {
  expect(homeAssistantTarget('light.desk')).toBe('ha:light.desk')
  expect(isHomeAssistantTarget('ha:light.desk')).toBe(true)
  expect(isHomeAssistantTarget('firefox')).toBe(false)
  expect(homeAssistantSliderEntity('ha:light.desk')).toBe('light.desk')
  expect(homeAssistantSliderEntity('ha:media_player.salon')).toBe('media_player.salon')
  expect(homeAssistantSliderEntity('ha:switch.desk')).toBeUndefined()
  expect(homeAssistantSliderEntity('ha:light')).toBeUndefined()
  expect(homeAssistantSliderEntity('ha:light.Desk lamp')).toBeUndefined()
  expect(homeAssistantSliderEntity('light.desk')).toBeUndefined()
})

test('labels targets and keeps Home Assistant entries away from audio services', () => {
  expect(deejTargetLabel('ha:light.desk')).toBe('HA · light.desk')
  expect(deejTargetLabel('spotify')).toBe('spotify')
  expect(audioSessionTargets({ '0': ['master', 'ha:light.desk'], '1': ['ha:fan.room'] })).toEqual({
    '0': ['master'],
    '1': []
  })
})

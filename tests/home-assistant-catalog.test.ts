import { expect, test } from 'vitest'
import {
  MAX_ENTITY_SUGGESTIONS,
  MAX_SERVICE_SUGGESTIONS,
  toEntitySuggestions,
  toServiceNames
} from '@main/services/home-assistant-catalog'

test('keeps only the id, friendly name and state of well-formed entities', () => {
  expect(
    toEntitySuggestions([
      {
        entity_id: 'switch.fan',
        state: 'off',
        attributes: { friendly_name: 'Ventilateur', access_token: 'secret', entity_picture: '/x' }
      },
      { entity_id: 'light.desk', state: 'on', attributes: {} },
      { entity_id: 'sensor.empty', state: '', attributes: { friendly_name: '' } },
      { entity_id: 'Bad Id', state: 'on' },
      { entity_id: 'light.long', state: 'x'.repeat(300) },
      'not an entity',
      null
    ])
  ).toEqual([
    { entityId: 'light.desk', state: 'on' },
    { entityId: 'light.long', state: 'unknown' },
    { entityId: 'sensor.empty', state: 'unknown' },
    { entityId: 'switch.fan', name: 'Ventilateur', state: 'off' }
  ])
  expect(toEntitySuggestions({ entity_id: 'light.desk' })).toEqual([])
})

test('flattens services by domain into sorted, valid names', () => {
  expect(
    toServiceNames([
      { domain: 'light', services: { turn_on: {}, toggle: {} } },
      { domain: 'homeassistant', services: { toggle: {} } },
      { domain: 'Bad Domain', services: { x: {} } },
      { domain: 'script', services: [] },
      { services: { orphan: {} } },
      'nope'
    ])
  ).toEqual(['homeassistant.toggle', 'light.toggle', 'light.turn_on'])
  expect(toServiceNames(null)).toEqual([])
})

test('bounds the amount of data sent to the renderer', () => {
  const states = Array.from({ length: MAX_ENTITY_SUGGESTIONS + 10 }, (_, index) => ({
    entity_id: `sensor.s${String(index).padStart(5, '0')}`,
    state: '1'
  }))
  expect(toEntitySuggestions(states)).toHaveLength(MAX_ENTITY_SUGGESTIONS)

  const services = Object.fromEntries(
    Array.from({ length: MAX_SERVICE_SUGGESTIONS + 10 }, (_, index) => [`s${index}`, {}])
  )
  expect(toServiceNames([{ domain: 'script', services }])).toHaveLength(MAX_SERVICE_SUGGESTIONS)
})

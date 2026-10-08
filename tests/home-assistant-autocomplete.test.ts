import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { filterSuggestions } from '@renderer/lib/autocomplete'
import {
  isAttributeSuggestions,
  isEntitySuggestions,
  isServiceNames
} from '@renderer/types/home-assistant.types'

const api = { getEntities: vi.fn(), getServices: vi.fn(), getAttributes: vi.fn() }

beforeEach(() => {
  vi.resetModules()
  vi.useFakeTimers()
  api.getEntities.mockReset()
  api.getServices.mockReset()
  api.getAttributes.mockReset()
  vi.stubGlobal('window', { api: { homeAssistant: api } })
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

test('validates the entity and service payloads from the main process', () => {
  expect(isEntitySuggestions([{ entityId: 'light.desk', name: 'Bureau', state: 'on' }])).toBe(true)
  expect(isEntitySuggestions([{ entityId: 'light.desk', state: 'on', token: 'x' }])).toBe(false)
  expect(isEntitySuggestions([{ entityId: '', state: 'on' }])).toBe(false)
  expect(isEntitySuggestions({})).toBe(false)
  expect(isServiceNames(['light.toggle'])).toBe(true)
  expect(isServiceNames(['light.toggle', 3])).toBe(false)
})

test('ranks suggestions by priority, prefix match and name, and limits results', () => {
  const suggestions = [
    { value: 'switch.light_strip', priority: 1 },
    { value: 'light.desk', label: 'Bureau', priority: 0 },
    { value: 'light.bed', priority: 0 },
    { value: 'sensor.temp', label: 'Light level' }
  ]
  expect(filterSuggestions(suggestions, 'light', 10).map((s) => s.value)).toEqual([
    'light.bed',
    'light.desk',
    'sensor.temp',
    'switch.light_strip'
  ])
  expect(filterSuggestions(suggestions, 'bureau', 10).map((s) => s.value)).toEqual(['light.desk'])
  expect(filterSuggestions(suggestions, '', 2)).toHaveLength(2)
})

test('caches loaded catalogs for a minute and retries after an empty answer', async () => {
  const { loadHomeAssistantEntities, loadHomeAssistantServices, domainOf } =
    await import('@renderer/lib/home-assistant-catalog')
  api.getServices.mockResolvedValueOnce([]).mockResolvedValue(['light.toggle'])
  await expect(loadHomeAssistantServices()).resolves.toEqual([])
  await expect(loadHomeAssistantServices()).resolves.toEqual(['light.toggle'])
  await expect(loadHomeAssistantServices()).resolves.toEqual(['light.toggle'])
  expect(api.getServices).toHaveBeenCalledTimes(2)

  api.getEntities.mockResolvedValue([{ entityId: 'light.desk', state: 'on' }])
  await loadHomeAssistantEntities()
  await loadHomeAssistantEntities()
  vi.advanceTimersByTime(60_001)
  await loadHomeAssistantEntities()
  expect(api.getEntities).toHaveBeenCalledTimes(2)

  api.getEntities.mockResolvedValue([{ entityId: 'light.desk', state: 'on', secret: 'x' }])
  vi.advanceTimersByTime(60_001)
  await expect(loadHomeAssistantEntities()).resolves.toEqual([])

  api.getEntities.mockRejectedValue(new Error('IPC failed'))
  vi.advanceTimersByTime(60_001)
  await expect(loadHomeAssistantEntities()).resolves.toEqual([])

  expect(domainOf('light.toggle')).toBe('light')
  expect(domainOf('nodot')).toBeUndefined()
  expect(domainOf(undefined)).toBeUndefined()
})

test('loads attributes of one entity on demand and validates them', async () => {
  const { loadHomeAssistantAttributes } = await import('@renderer/lib/home-assistant-catalog')
  expect(isAttributeSuggestions([{ name: 'brightness', preview: '120' }])).toBe(true)
  expect(isAttributeSuggestions([{ name: 'brightness', preview: '1', value: 1 }])).toBe(false)
  expect(isAttributeSuggestions([{ name: '', preview: '' }])).toBe(false)

  await expect(loadHomeAssistantAttributes(undefined)).resolves.toEqual([])
  expect(api.getAttributes).not.toHaveBeenCalled()
  api.getAttributes.mockResolvedValueOnce([{ name: 'brightness', preview: '120' }])
  await expect(loadHomeAssistantAttributes('light.desk')).resolves.toEqual([
    { name: 'brightness', preview: '120' }
  ])
  expect(api.getAttributes).toHaveBeenCalledWith('light.desk')
  api.getAttributes.mockResolvedValueOnce([{ secret: 'x' }])
  await expect(loadHomeAssistantAttributes('light.desk')).resolves.toEqual([])
  api.getAttributes.mockRejectedValueOnce(new Error('IPC failed'))
  await expect(loadHomeAssistantAttributes('light.desk')).resolves.toEqual([])
})

import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { defaultSettings } from '@renderer/stores/settings.defaults'

const update = vi.fn()

beforeEach(() => {
  vi.stubGlobal('window', { api: { settings: { update } } })
  useSettingsStore.setState({ settings: defaultSettings })
})

afterEach(() => {
  update.mockReset()
  vi.unstubAllGlobals()
})

test('updateConfig keeps the previous settings when the main process rejects them', async () => {
  update.mockRejectedValue(new Error('invalid settings'))

  await expect(useSettingsStore.getState().updateConfig({ gridCols: 8 })).rejects.toThrow()

  expect(useSettingsStore.getState().settings).toEqual(defaultSettings)
})

test('updateConfig applies the settings once the main process saved them', async () => {
  update.mockResolvedValue(undefined)

  await useSettingsStore.getState().updateConfig({ gridCols: 8 })

  expect(update).toHaveBeenCalledWith(
    expect.objectContaining({ settings: expect.objectContaining({ gridCols: 8 }) })
  )
  expect(useSettingsStore.getState().settings.gridCols).toBe(8)
})

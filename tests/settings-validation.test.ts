import { expect, test } from 'vitest'
import { defaultSettings } from '@main/services/settings-defaults'
import {
  MAX_ICON_DATA_URL_LENGTH,
  MAX_SETTINGS_BYTES,
  isAppSettings,
  isRendererSettingsUpdate,
  type RendererSettingsUpdate
} from '@main/types/settings.types'
import { ModuleEnum } from '@main/types/enums'
import { isRendererSettings } from '@renderer/types/settings.types'

function rendererUpdate(): RendererSettingsUpdate {
  return {
    settings: {
      ...structuredClone(defaultSettings),
      homeAssistant: { url: '', tokenConfigured: false },
      discord: { clientId: '', clientSecretConfigured: false, authenticated: false }
    },
    secrets: {
      homeAssistantToken: { action: 'unchanged' },
      discordClientSecret: { action: 'unchanged' },
      discordTokens: 'unchanged'
    }
  }
}

test('accepts a reasonably sized existing controller configuration', () => {
  const settings = structuredClone(defaultSettings)
  settings.comPort = '/dev/ttyUSB7'
  settings.baudRate = 9600
  settings.streamdeck['63'] = {
    icon: 'data:image/png;base64,AA==',
    pressed: { module: ModuleEnum.Macro, params: ['open_browser'] }
  }
  settings.deej['15'] = ['Firefox', 'System']

  expect(isAppSettings(settings)).toBe(true)
})

test('rejects oversized icon data URLs, collections, strings, and complete settings', () => {
  const mutations = [
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.streamdeck['0'] = {
        icon: `data:image/png;base64,${'A'.repeat(MAX_ICON_DATA_URL_LENGTH)}`
      }
    },
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.streamdeck = Object.fromEntries(
        Array.from({ length: 65 }, (_, index) => [String(index), {}])
      )
    },
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.deej['0'] = Array.from({ length: 129 }, () => 'session')
    },
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.comPort = 'x'.repeat(1025)
    },
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.homeAssistant.url = 'x'.repeat(MAX_SETTINGS_BYTES)
    }
  ]

  for (const mutate of mutations) {
    const update = rendererUpdate()
    mutate(update)
    expect(isRendererSettingsUpdate(update)).toBe(false)
  }
})

test('rejects malformed dictionary indices, data URLs, module vocabulary, and secret payloads', () => {
  const mutations = [
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.streamdeck['-1'] = {}
    },
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.streamdeck['0'] = { icon: 'https://example.invalid/icon.png' }
    },
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.streamdeck['0'] = { icon: 'data:image/png;base64,' }
    },
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.streamdeck['0'] = {
        pressed: { module: 'shell' as never, params: ['rm', '-rf'] }
      }
    },
    (update: ReturnType<typeof rendererUpdate>) => {
      update.settings.ledProfile.startColor.r = 256
    },
    (update: ReturnType<typeof rendererUpdate>) => {
      update.secrets.homeAssistantToken = {
        action: 'set',
        value: 'x'.repeat(16_385)
      }
    }
  ]

  for (const mutate of mutations) {
    const update = rendererUpdate()
    mutate(update)
    expect(isRendererSettingsUpdate(update)).toBe(false)
  }

  expect(isAppSettings({ ...structuredClone(defaultSettings), unexpected: true })).toBe(false)
})

test('renderer hydration enforces the same redacted settings bounds', () => {
  const invalidIcon = rendererUpdate().settings
  invalidIcon.streamdeck['0'] = { icon: 'file:///tmp/icon.png' }
  const invalidIndex = rendererUpdate().settings
  invalidIndex.deej['16'] = ['Firefox']
  const oversizedName = rendererUpdate().settings
  oversizedName.deejNames['0'] = 'x'.repeat(257)

  expect(isRendererSettings(rendererUpdate().settings)).toBe(true)
  expect(isRendererSettings(invalidIcon)).toBe(false)
  expect(isRendererSettings(invalidIndex)).toBe(false)
  expect(isRendererSettings(oversizedName)).toBe(false)
})

test('rejects malformed settings envelopes and integration objects', () => {
  expect(isRendererSettingsUpdate(null)).toBe(false)

  const extraSetting = rendererUpdate()
  Object.assign(extraSetting.settings, { unexpected: true })
  expect(isRendererSettingsUpdate(extraSetting)).toBe(false)

  const invalidHomeAssistant = rendererUpdate()
  invalidHomeAssistant.settings.homeAssistant = null as never
  expect(isRendererSettingsUpdate(invalidHomeAssistant)).toBe(false)

  const invalidDiscord = rendererUpdate()
  invalidDiscord.settings.discord = null as never
  expect(isRendererSettingsUpdate(invalidDiscord)).toBe(false)

  expect(isRendererSettings(null)).toBe(false)
  expect(isRendererSettings({ ...rendererUpdate().settings, unexpected: true })).toBe(false)

  const rendererHomeAssistant = rendererUpdate().settings
  rendererHomeAssistant.homeAssistant = null as never
  expect(isRendererSettings(rendererHomeAssistant)).toBe(false)
})

test('validates attribute LED conditions and the automation module in both schemas', () => {
  const color = { r: 0, g: 255, b: 0 }
  const withButton = (button: unknown): RendererSettingsUpdate => {
    const update = rendererUpdate()
    update.settings.streamdeck = { '0': button } as never
    return update
  }
  const valid = {
    pressed: { module: ModuleEnum.Automation, params: ['automation.good_night'] },
    ledConditions: [
      { type: 'ha-attr', color, haAttribute: 'brightness', haOperator: 'gte', haValue: '128' },
      { type: 'ha-on', color }
    ]
  }
  expect(isRendererSettingsUpdate(withButton(valid))).toBe(true)
  expect(isRendererSettings(withButton(valid).settings)).toBe(true)

  for (const condition of [
    { type: 'ha-attr', color, haOperator: 'eq', haValue: '1' },
    { type: 'ha-attr', color, haAttribute: '', haOperator: 'eq', haValue: '1' },
    { type: 'ha-attr', color, haAttribute: 'bad name', haOperator: 'eq', haValue: '1' },
    { type: 'ha-attr', color, haAttribute: 'brightness', haOperator: 'like', haValue: '1' },
    {
      type: 'ha-attr',
      color,
      haAttribute: 'brightness',
      haOperator: 'eq',
      haValue: 'x'.repeat(300)
    },
    { type: 'ha-attr', color, haAttribute: 'brightness', haOperator: 'eq', haValue: '1', extra: 1 },
    { type: 'ha-on', color, haAttribute: 'brightness' }
  ]) {
    const button = { ...valid, ledConditions: [condition] }
    expect(isRendererSettingsUpdate(withButton(button))).toBe(false)
    expect(isRendererSettings(withButton(button).settings)).toBe(false)
  }
})

test('drops only the values a newer version added and reports them', async () => {
  const { dropUnsupportedEntries } = await import('@main/types/settings.types')
  const original = {
    ledProfile: { mode: 'rainbow' },
    streamdeck: {
      '1': {
        pressed: { module: '', params: [''] },
        hold: { module: 'home-assistant', params: [] },
        ledConditions: [{ type: 'ha-on' }, 'not-a-condition']
      },
      '2': 'not-a-button',
      '3': { pressed: { module: 'teleport', params: [] }, ledConditions: [{ type: 'eclipse' }] }
    }
  }

  const { settings, dropped } = dropUnsupportedEntries(original)

  expect(dropped).toEqual([
    'key 3 pressed action (module "teleport")',
    'key 3 LED condition "eclipse"'
  ])
  expect(settings.streamdeck).toEqual({
    ...original.streamdeck,
    '3': { ledConditions: [] }
  })
  expect(original.streamdeck['3'].pressed).toBeDefined()
  expect(dropUnsupportedEntries({ streamdeck: [] }).dropped).toEqual([])
})

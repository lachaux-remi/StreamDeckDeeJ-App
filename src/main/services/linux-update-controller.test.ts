import { expect, test } from 'vitest'
import { LinuxUpdateController, detectLinuxUpdateMode } from './linux-update-controller'

const update = {
  version: '4.1.0',
  releaseName: 'Version 4.1.0',
  releaseNotes: 'Security and reliability fixes.'
}

function createUpdater(): {
  calls: string[]
  updater: {
    configure: () => void
    on: (event: string, listener: (value?: unknown) => void) => void
    check: () => Promise<void>
    download: () => Promise<void>
    install: () => void
  }
  emit: (event: string, value?: unknown) => void
} {
  const calls: string[] = []
  const listeners = new Map<string, (value?: unknown) => void>()
  return {
    calls,
    updater: {
      configure: () => calls.push('configure'),
      on: (event, listener) => listeners.set(event, listener),
      check: async () => {
        calls.push('check')
      },
      download: async () => {
        calls.push('download')
      },
      install: () => calls.push('install')
    },
    emit: (event, value) => listeners.get(event)?.(value)
  }
}

test('detects AppImage, package-manager, and disabled modes without trusting renderer input', () => {
  expect(detectLinuxUpdateMode({ packaged: false, platform: 'linux' })).toBe('disabled')
  expect(detectLinuxUpdateMode({ packaged: true, platform: 'win32' })).toBe('disabled')
  expect(
    detectLinuxUpdateMode({ packaged: true, platform: 'linux', appImage: '/opt/app.AppImage' })
  ).toBe('appimage')
  expect(
    detectLinuxUpdateMode({ packaged: true, platform: 'linux', appImage: './app.AppImage' })
  ).toBe('disabled')
  expect(detectLinuxUpdateMode({ packaged: true, platform: 'linux', packageType: 'pacman' })).toBe(
    'package-manager'
  )
  expect(
    detectLinuxUpdateMode({
      packaged: true,
      platform: 'linux',
      packageType: 'pacman',
      unpacked: true
    })
  ).toBe('disabled')
  expect(detectLinuxUpdateMode({ packaged: true, platform: 'linux' })).toBe('disabled')
})

test('AppImage never downloads or installs before separate explicit commands', async () => {
  const fake = createUpdater()
  const controller = new LinuxUpdateController({
    mode: 'appimage',
    currentVersion: '4.0.6',
    updater: fake.updater
  })

  await controller.check()
  fake.emit('available', update)
  expect(fake.calls).toEqual(['configure', 'check'])
  expect(controller.getState().status).toBe('available')
  await expect(controller.check()).rejects.toThrow(/not allowed/)

  await controller.download()
  expect(fake.calls).toEqual(['configure', 'check', 'download'])
  fake.emit('downloaded', update)
  expect(controller.getState().status).toBe('downloaded')

  controller.install()
  expect(fake.calls).toEqual(['configure', 'check', 'download', 'install'])
})

test('rejects downgrade metadata and invalid transitions', async () => {
  const fake = createUpdater()
  const controller = new LinuxUpdateController({
    mode: 'appimage',
    currentVersion: '4.0.6',
    updater: fake.updater
  })

  await expect(controller.download()).rejects.toThrow(/not available/)
  await controller.check()
  fake.emit('available', { ...update, version: '4.0.5' })
  expect(controller.getState().status).toBe('error')
  expect(() => controller.install()).toThrow(/not downloaded/)
})

test('package-manager mode only checks and opens the fixed official release page', async () => {
  const calls: string[] = []
  const controller = new LinuxUpdateController({
    mode: 'package-manager',
    currentVersion: '4.0.6',
    releaseChecker: async () => update,
    openOfficialRelease: async () => {
      calls.push('open')
    }
  })

  await controller.check()
  expect(controller.getState().status).toBe('available')
  await expect(controller.download()).rejects.toThrow(/AppImage/)
  expect(() => controller.install()).toThrow(/AppImage/)
  await controller.openRelease()
  expect(calls).toEqual(['open'])
})

test('disabled mode performs no network or updater operation', async () => {
  const controller = new LinuxUpdateController({ mode: 'disabled', currentVersion: '4.0.6' })
  await controller.check()
  expect(controller.getState()).toEqual({ mode: 'disabled', status: 'disabled' })
})

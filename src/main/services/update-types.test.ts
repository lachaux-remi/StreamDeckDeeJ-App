import { expect, test } from 'vitest'
import { isLinuxUpdateCommand, isLinuxUpdateState } from '../types/update.types'

test('accepts only the fixed updater command vocabulary', () => {
  for (const command of ['check', 'download', 'install', 'open-release']) {
    expect(isLinuxUpdateCommand(command)).toBe(true)
  }
  for (const command of ['', 'https://evil.example', { command: 'install' }, 'downgrade']) {
    expect(isLinuxUpdateCommand(command)).toBe(false)
  }
})

test('validates states crossing IPC and rejects extra or malformed fields', () => {
  expect(
    isLinuxUpdateState({
      mode: 'appimage',
      status: 'available',
      currentVersion: '4.0.6',
      version: '4.1.0',
      releaseName: 'Version 4.1.0',
      releaseNotes: 'Notes'
    })
  ).toBe(true)
  expect(
    isLinuxUpdateState({
      mode: 'appimage',
      status: 'downloaded',
      version: '4.1.0',
      path: '/tmp/x'
    })
  ).toBe(false)
  expect(isLinuxUpdateState({ mode: 'disabled', status: 'disabled', token: 'secret' })).toBe(false)
})

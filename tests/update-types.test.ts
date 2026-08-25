import { expect, test } from 'vitest'
import { isUpdateCommand, isUpdateState } from '@main/types/update.types'

test('accepts only the fixed updater command vocabulary', () => {
  for (const command of ['check', 'download', 'install', 'open-release']) {
    expect(isUpdateCommand(command)).toBe(true)
  }
  for (const command of ['', 'https://evil.example', { command: 'install' }, 'downgrade']) {
    expect(isUpdateCommand(command)).toBe(false)
  }
})

test('validates states crossing IPC and rejects extra or malformed fields', () => {
  expect(
    isUpdateState({
      mode: 'appimage',
      status: 'available',
      currentVersion: '4.0.6',
      version: '4.1.0',
      releaseName: 'Version 4.1.0',
      releaseNotes: 'Notes'
    })
  ).toBe(true)
  expect(
    isUpdateState({
      mode: 'appimage',
      status: 'downloaded',
      version: '4.1.0',
      path: '/tmp/x'
    })
  ).toBe(false)
  expect(isUpdateState({ mode: 'disabled', status: 'disabled', token: 'secret' })).toBe(false)
})

test('validates every cross-platform updater state shape and its guards', () => {
  expect(isUpdateState(null)).toBe(false)
  expect(isUpdateState({ mode: 'other', status: 'idle', currentVersion: '1' })).toBe(false)
  expect(isUpdateState({ mode: 'appimage', status: 'idle' })).toBe(false)
  for (const status of ['idle', 'checking', 'up-to-date']) {
    expect(isUpdateState({ mode: 'package-manager', status, currentVersion: '1.0.0' })).toBe(true)
    expect(isUpdateState({ mode: 'nsis', status, currentVersion: '1.0.0' })).toBe(true)
  }
  expect(
    isUpdateState({
      mode: 'nsis',
      status: 'error',
      currentVersion: '1.0.0',
      message: 'failed'
    })
  ).toBe(true)
  expect(isUpdateState({ mode: 'appimage', status: 'unknown', currentVersion: '1' })).toBe(false)
})

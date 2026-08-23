import { expect, test } from 'vitest'
import { isLinuxUpdateCommand, isLinuxUpdateState } from '@main/types/update.types'

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

test('validates every updater state shape and its guards', () => {
  expect(isLinuxUpdateState(null)).toBe(false)
  expect(isLinuxUpdateState({ mode: 'other', status: 'idle', currentVersion: '1' })).toBe(false)
  expect(isLinuxUpdateState({ mode: 'appimage', status: 'idle' })).toBe(false)
  for (const status of ['idle', 'checking', 'up-to-date']) {
    expect(isLinuxUpdateState({ mode: 'package-manager', status, currentVersion: '1.0.0' })).toBe(
      true
    )
  }
  expect(
    isLinuxUpdateState({
      mode: 'appimage',
      status: 'error',
      currentVersion: '1.0.0',
      message: 'failed'
    })
  ).toBe(true)
  expect(isLinuxUpdateState({ mode: 'appimage', status: 'unknown', currentVersion: '1' })).toBe(
    false
  )
})

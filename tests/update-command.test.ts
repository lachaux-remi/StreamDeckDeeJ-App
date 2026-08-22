import { expect, test } from 'vitest'
import {
  createSerialCommandExecutor,
  executeLinuxUpdateCommand,
  type LinuxUpdateActions
} from '@main/services/update-command'

function actions(calls: string[]): LinuxUpdateActions {
  return {
    check: async () => void calls.push('check'),
    download: async () => void calls.push('download'),
    install: async () => void calls.push('install'),
    openRelease: async () => void calls.push('open-release')
  }
}

test('requires main-process consent before AppImage download and installation', async () => {
  const calls: string[] = []
  const fakeActions = actions(calls)
  await executeLinuxUpdateCommand('download', fakeActions, async () => false)
  await executeLinuxUpdateCommand('install', fakeActions, async () => false)
  expect(calls).toEqual([])

  await executeLinuxUpdateCommand(
    'download',
    fakeActions,
    async (consent) => consent === 'download'
  )
  await executeLinuxUpdateCommand('install', fakeActions, async (consent) => consent === 'install')
  expect(calls).toEqual(['download', 'install'])
})

test('checks and opens the fixed release without a destructive-action prompt', async () => {
  const calls: string[] = []
  const confirm = async (): Promise<boolean> => {
    calls.push('unexpected-confirmation')
    return false
  }
  await executeLinuxUpdateCommand('check', actions(calls), confirm)
  await executeLinuxUpdateCommand('open-release', actions(calls), confirm)
  expect(calls).toEqual(['check', 'open-release'])
})

test('serializes concurrent IPC commands and continues after a rejected command', async () => {
  const run = createSerialCommandExecutor()
  const calls: string[] = []
  const first = run(async () => {
    calls.push('first-start')
    await Promise.resolve()
    calls.push('first-end')
    throw new Error('expected')
  })
  const second = run(async () => {
    calls.push('second')
  })

  await expect(first).rejects.toThrow(/expected/)
  await second
  expect(calls).toEqual(['first-start', 'first-end', 'second'])
})

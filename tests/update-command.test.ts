import { expect, test } from 'vitest'
import {
  createSerialCommandExecutor,
  executeUpdateCommand,
  type UpdateActions
} from '@main/services/update-command'

function actions(calls: string[]): UpdateActions {
  return {
    check: async () => void calls.push('check'),
    download: async () => void calls.push('download'),
    install: async () => void calls.push('install'),
    openRelease: async () => void calls.push('open-release')
  }
}

test('requires main-process consent before update download and installation', async () => {
  const calls: string[] = []
  const fakeActions = actions(calls)
  await executeUpdateCommand('download', fakeActions, async () => false)
  await executeUpdateCommand('install', fakeActions, async () => false)
  expect(calls).toEqual([])

  await executeUpdateCommand('download', fakeActions, async (consent) => consent === 'download')
  await executeUpdateCommand('install', fakeActions, async (consent) => consent === 'install')
  expect(calls).toEqual(['download', 'install'])
})

test('checks and opens the fixed release without a destructive-action prompt', async () => {
  const calls: string[] = []
  const confirm = async (): Promise<boolean> => {
    calls.push('unexpected-confirmation')
    return false
  }
  await executeUpdateCommand('check', actions(calls), confirm)
  await executeUpdateCommand('open-release', actions(calls), confirm)
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

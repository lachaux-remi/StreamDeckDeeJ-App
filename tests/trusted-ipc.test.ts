import { beforeEach, expect, test, vi } from 'vitest'

const electron = vi.hoisted(() => ({
  invokes: new Map<string, (event: unknown, ...args: unknown[]) => unknown>(),
  events: new Map<string, (event: unknown, ...args: unknown[]) => unknown>()
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) =>
      electron.invokes.set(channel, listener),
    on: (channel: string, listener: (event: unknown, ...args: unknown[]) => unknown) =>
      electron.events.set(channel, listener)
  }
}))

import { handleIpc, onIpc } from '@main/handlers/trusted-ipc'

beforeEach(() => {
  electron.invokes.clear()
  electron.events.clear()
})

test('requires both the trusted WebContents and its current main frame for invocations', () => {
  const trusted = { mainFrame: {} }
  const listener = vi.fn((value: string) => `accepted:${value}`)
  handleIpc(trusted as never, 'test:invoke', listener)
  const invoke = electron.invokes.get('test:invoke')
  if (!invoke) throw new Error('handler not registered')

  expect(invoke({ sender: trusted, senderFrame: trusted.mainFrame }, 'safe')).toBe('accepted:safe')
  expect(() => invoke({ sender: {}, senderFrame: trusted.mainFrame }, 'blocked')).toThrow(
    'Blocked IPC message from an untrusted sender'
  )
  expect(() => invoke({ sender: trusted, senderFrame: {} }, 'blocked')).toThrow(
    'Blocked IPC message from an untrusted sender'
  )
  expect(listener).toHaveBeenCalledOnce()
})

test('silently drops untrusted one-way messages', () => {
  const trusted = { mainFrame: {} }
  const listener = vi.fn()
  onIpc(trusted as never, 'test:event', listener)
  const receive = electron.events.get('test:event')
  if (!receive) throw new Error('listener not registered')

  receive({ sender: {}, senderFrame: trusted.mainFrame }, 'secret-payload')
  receive({ sender: trusted, senderFrame: {} }, 'secret-payload')
  expect(listener).not.toHaveBeenCalled()
  receive({ sender: trusted, senderFrame: trusted.mainFrame }, 'safe')
  expect(listener).toHaveBeenCalledWith('safe')
})

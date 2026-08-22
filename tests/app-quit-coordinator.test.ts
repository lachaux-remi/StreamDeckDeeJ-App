import { expect, test } from 'vitest'
import { AppQuitCoordinator } from '@main/services/app-quit-coordinator'

function deferred(): {
  promise: Promise<void>
  resolve: () => void
  reject: (error: Error) => void
} {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

test('orders shutdown resolution before updater launch and allows its before-quit event', async () => {
  const calls: string[] = []
  const shutdown = deferred()
  const coordinator = new AppQuitCoordinator({
    shutdown: () => {
      calls.push('shutdown')
      return shutdown.promise.then(() => void calls.push('shutdown-resolved'))
    },
    exit: () => calls.push('exit')
  })

  const launch = coordinator.installUpdate(() => calls.push('quit-and-install'))
  expect(calls).toEqual(['shutdown'])
  let prematureQuitPrevented = false
  coordinator.handleBeforeQuit({
    preventDefault: () => void (prematureQuitPrevented = true)
  })
  expect(prematureQuitPrevented).toBe(true)
  shutdown.resolve()
  await launch
  expect(calls).toEqual(['shutdown', 'shutdown-resolved', 'quit-and-install'])

  let prevented = false
  coordinator.handleBeforeQuit({ preventDefault: () => void (prevented = true) })
  expect(prevented).toBe(false)
  expect(calls).toEqual(['shutdown', 'shutdown-resolved', 'quit-and-install'])
})

test('does not launch the updater or allow quit when shutdown fails', async () => {
  const calls: string[] = []
  const coordinator = new AppQuitCoordinator({
    shutdown: async () => {
      calls.push('shutdown')
      throw new Error('LED shutdown failed')
    },
    exit: () => calls.push('exit')
  })

  await expect(coordinator.installUpdate(() => calls.push('quit-and-install'))).rejects.toThrow(
    /LED shutdown failed/
  )
  expect(calls).toEqual(['shutdown'])

  let prevented = false
  coordinator.handleBeforeQuit({ preventDefault: () => void (prevented = true) })
  await Promise.resolve()
  await Promise.resolve()
  expect(prevented).toBe(true)
  expect(calls).toEqual(['shutdown', 'exit'])
})

test('rejects update installation after an ordinary quit has started', async () => {
  const shutdown = deferred()
  const coordinator = new AppQuitCoordinator({ shutdown: () => shutdown.promise, exit: () => {} })
  coordinator.handleBeforeQuit({ preventDefault: () => {} })

  await expect(coordinator.installUpdate(() => {})).rejects.toThrow(/quit is already in progress/)
  shutdown.resolve()
})

test('ordinary repeated quit events share one asynchronous shutdown before exit', async () => {
  const calls: string[] = []
  const shutdown = deferred()
  const coordinator = new AppQuitCoordinator({
    shutdown: () => {
      calls.push('shutdown')
      return shutdown.promise
    },
    exit: () => calls.push('exit')
  })
  let prevented = 0
  const event = { preventDefault: () => void (prevented += 1) }

  coordinator.handleBeforeQuit(event)
  coordinator.handleBeforeQuit(event)
  expect(prevented).toBe(2)
  expect(calls).toEqual(['shutdown'])

  shutdown.resolve()
  await Promise.resolve()
  await Promise.resolve()
  expect(calls).toEqual(['shutdown', 'exit'])
})

import { expect, test, vi, type Mock } from 'vitest'
import type { CommandRunner } from '@main/services/audio-command'
import {
  KEYRING_RELAUNCH_SWITCH,
  keyringProbe,
  startKeyringRecovery,
  watchKeyringUnlock
} from '@main/services/keyring-unlock'

function runner(reply: (args: readonly string[]) => string | Error): CommandRunner & {
  run: ReturnType<typeof vi.fn>
} {
  return {
    run: vi.fn(async (_file: string, args: readonly string[]) => {
      const result = reply(args)
      if (result instanceof Error) {
        throw result
      }
      return result
    })
  }
}

function kwalletRunner(
  open: () => boolean | Error,
  wallet = 'kdewallet'
): ReturnType<typeof runner> {
  return runner((args) => {
    if (args.includes('org.kde.KWallet.networkWallet')) {
      return `method return\n   string "${wallet}"\n`
    }
    const state = open()
    return state instanceof Error ? state : `method return\n   boolean ${state}\n`
  })
}

const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

function manualTimers(): {
  setTimeout: Mock<(callback: () => void, ms: number) => unknown>
  clearTimeout: Mock<(handle: unknown) => void>
  fire(): Promise<void>
} {
  let pending: (() => void) | undefined
  return {
    setTimeout: vi.fn<(callback: () => void, ms: number) => unknown>((callback) => {
      pending = callback
      return 'timer'
    }),
    clearTimeout: vi.fn<(handle: unknown) => void>(),
    async fire() {
      const callback = pending
      pending = undefined
      callback?.()
      await flush()
    }
  }
}

test('asks the KWallet daemon of the backend whether the network wallet is open', async () => {
  for (const [backend, service, path] of [
    ['kwallet', 'org.kde.kwalletd', '/modules/kwalletd'],
    ['kwallet5', 'org.kde.kwalletd5', '/modules/kwalletd5'],
    ['kwallet6', 'org.kde.kwalletd6', '/modules/kwalletd6']
  ]) {
    const dbus = kwalletRunner(() => true, 'Network')
    await expect(keyringProbe(backend)?.(dbus)).resolves.toBe(true)
    expect(dbus.run).toHaveBeenNthCalledWith(
      1,
      'dbus-send',
      ['--session', '--print-reply', `--dest=${service}`, path, 'org.kde.KWallet.networkWallet'],
      2000
    )
    expect(dbus.run).toHaveBeenNthCalledWith(
      2,
      'dbus-send',
      [
        '--session',
        '--print-reply',
        `--dest=${service}`,
        path,
        'org.kde.KWallet.isOpen',
        'string:Network'
      ],
      2000
    )
  }
})

test('reports a closed wallet or a missing wallet name as locked', async () => {
  const probe = keyringProbe('kwallet6')
  await expect(probe?.(kwalletRunner(() => false))).resolves.toBe(false)

  const noWallet = runner(() => 'method return\n')
  await expect(probe?.(noWallet)).resolves.toBe(false)
  expect(noWallet.run).toHaveBeenCalledOnce()
})

test('reads the Locked property of the default Secret Service collection', async () => {
  const probe = keyringProbe('gnome_libsecret')
  const unlocked = runner(() => 'method return\n   variant       boolean false\n')
  await expect(probe?.(unlocked)).resolves.toBe(true)
  expect(unlocked.run).toHaveBeenCalledWith(
    'dbus-send',
    [
      '--session',
      '--print-reply',
      '--dest=org.freedesktop.secrets',
      '/org/freedesktop/secrets/aliases/default',
      'org.freedesktop.DBus.Properties.Get',
      'string:org.freedesktop.Secret.Collection',
      'string:Locked'
    ],
    2000
  )
  await expect(
    probe?.(runner(() => 'method return\n   variant       boolean true\n'))
  ).resolves.toBe(false)
})

test('has no probe for backends without a keyring', () => {
  expect(keyringProbe('basic_text')).toBeUndefined()
  expect(keyringProbe('unknown')).toBeUndefined()
})

test('polls until the keyring unlocks, then notifies once', async () => {
  const states: (boolean | Error)[] = [new Error('daemon not started'), false, true]
  const dbus = kwalletRunner(() => states.shift() ?? true)
  const timers = manualTimers()
  const onUnlocked = vi.fn()

  const stop = watchKeyringUnlock({
    backend: 'kwallet6',
    runner: dbus,
    onUnlocked,
    intervalMs: 1234,
    timers
  })
  expect(stop).toBeTypeOf('function')
  await flush()
  expect(onUnlocked).not.toHaveBeenCalled()
  expect(timers.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 1234)

  await timers.fire()
  expect(onUnlocked).not.toHaveBeenCalled()

  await timers.fire()
  expect(onUnlocked).toHaveBeenCalledOnce()
  expect(timers.setTimeout).toHaveBeenCalledTimes(2)
})

test('stops polling when asked, even during a pending probe', async () => {
  let resolveProbe: (reply: string) => void = () => {}
  const dbus: CommandRunner = {
    run: vi.fn(
      (_file: string, args: readonly string[]) =>
        new Promise<string>((resolve) => {
          if (args.includes('string:Locked')) {
            resolveProbe = resolve
          }
        })
    )
  }
  const timers = manualTimers()
  const onUnlocked = vi.fn()

  const stop = watchKeyringUnlock({ backend: 'gnome_libsecret', runner: dbus, onUnlocked, timers })
  stop?.()
  resolveProbe('variant boolean false')
  await flush()

  expect(onUnlocked).not.toHaveBeenCalled()
  expect(timers.setTimeout).not.toHaveBeenCalled()
  expect(timers.clearTimeout).toHaveBeenCalledOnce()
})

test('cannot watch a backend without a keyring', () => {
  expect(
    watchKeyringUnlock({ backend: 'basic_text', runner: runner(() => ''), onUnlocked: vi.fn() })
  ).toBeUndefined()
})

test('uses real timers by default', async () => {
  vi.useFakeTimers()
  try {
    const states = [false, true]
    const onUnlocked = vi.fn()
    watchKeyringUnlock({
      backend: 'kwallet6',
      runner: kwalletRunner(() => states.shift() ?? true),
      onUnlocked
    })
    await vi.advanceTimersByTimeAsync(4_999)
    expect(onUnlocked).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onUnlocked).toHaveBeenCalledOnce()

    const neverUnlocked = vi.fn()
    const stop = watchKeyringUnlock({
      backend: 'kwallet6',
      runner: kwalletRunner(() => false),
      onUnlocked: neverUnlocked
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(vi.getTimerCount()).toBe(1)
    stop?.()
    expect(vi.getTimerCount()).toBe(0)
  } finally {
    vi.useRealTimers()
  }
})

function recovery(overrides: Partial<Parameters<typeof startKeyringRecovery>[0]> = {}): {
  watch: ReturnType<typeof vi.fn>
  relaunch: ReturnType<typeof vi.fn>
  log: { info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> }
  unlock(): void
  result: ReturnType<typeof startKeyringRecovery>
} {
  let onUnlocked: () => void = () => {}
  const stop = vi.fn()
  const watch = vi.fn((_backend: string, callback: () => void) => {
    onUnlocked = callback
    return stop
  })
  const relaunch = vi.fn()
  const log = { info: vi.fn(), warn: vi.fn() }
  const result = startKeyringRecovery({
    argv: ['/opt/streamdeck-deej/streamdeck-deej', '--ozone-platform=x11'],
    env: {},
    backend: 'kwallet6',
    needsRecovery: () => true,
    watch,
    relaunch,
    log,
    ...overrides
  })
  return { watch, relaunch, log, unlock: () => onUnlocked(), result }
}

test('relaunches with the same arguments once the keyring unlocks', () => {
  const { watch, relaunch, log, unlock, result } = recovery()
  expect(watch).toHaveBeenCalledWith('kwallet6', expect.any(Function))
  expect(result).toBeTypeOf('function')
  expect(relaunch).not.toHaveBeenCalled()

  unlock()
  expect(relaunch).toHaveBeenCalledWith(['--ozone-platform=x11', KEYRING_RELAUNCH_SWITCH])
  expect(log.info).toHaveBeenCalledOnce()
})

test('does not relaunch when every unavailable secret was replaced meanwhile', () => {
  const { relaunch, unlock } = recovery({ needsRecovery: () => false })
  unlock()
  expect(relaunch).not.toHaveBeenCalled()
})

test('never relaunches twice in a row', () => {
  const { watch, log, result } = recovery({
    argv: ['/usr/bin/streamdeck-deej', KEYRING_RELAUNCH_SWITCH]
  })
  expect(watch).not.toHaveBeenCalled()
  expect(result).toBeUndefined()
  expect(log.warn).toHaveBeenCalledOnce()
})

test('keeps the dev server process instead of relaunching it', () => {
  const { watch, log, result } = recovery({ env: { ELECTRON_RENDERER_URL: 'http://localhost' } })
  expect(watch).not.toHaveBeenCalled()
  expect(result).toBeUndefined()
  expect(log.warn).toHaveBeenCalledOnce()
})

test('warns when the backend cannot be watched', () => {
  const { log, result } = recovery({ backend: 'basic_text', watch: vi.fn(() => undefined) })
  expect(result).toBeUndefined()
  expect(log.warn).toHaveBeenCalledWith(expect.stringContaining('basic_text'))
})

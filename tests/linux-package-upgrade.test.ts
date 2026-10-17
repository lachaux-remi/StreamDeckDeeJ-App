import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi, type Mock } from 'vitest'
import { KEYRING_RELAUNCH_SWITCH } from '@main/services/keyring-unlock'
import {
  pacmanEntryName,
  parsePacmanDesc,
  relaunchWhenIdle,
  upgradeRelaunchArgs,
  watchPackageUpgrade,
  watchPacmanUpgrade
} from '@main/services/package-upgrade'

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
    clearTimeout: vi.fn<(handle: unknown) => void>(() => {
      pending = undefined
    }),
    async fire() {
      const callback = pending
      pending = undefined
      callback?.()
      await flush()
    }
  }
}

function desc(name: string, version: string): string {
  return `%NAME%\n${name}\n\n%VERSION%\n${version}\n\n%DESC%\n\n`
}

test('reads the version of a pacman local database entry', () => {
  expect(parsePacmanDesc(desc('streamdeck-deej', '4.5.1-1'), 'streamdeck-deej')).toBe('4.5.1-1')
  expect(parsePacmanDesc(desc('other', '1.0-1'), 'streamdeck-deej')).toBeUndefined()
  expect(parsePacmanDesc('%NAME%\nstreamdeck-deej\n', 'streamdeck-deej')).toBeUndefined()
})

test('finds the entry of the package, not of a package sharing its prefix', () => {
  const entries = ['streamdeck-deej-git-1.0-1', 'glibc-2.42-1', 'streamdeck-deej-4.5.1-1']
  expect(pacmanEntryName(entries, 'streamdeck-deej')).toBe('streamdeck-deej-4.5.1-1')
  expect(pacmanEntryName(['streamdeck-deej-git-1.0-1'], 'streamdeck-deej')).toBeUndefined()
})

function upgradeWatch(
  versions: (string | undefined | Error)[],
  locked: () => boolean = () => false
): {
  started: Promise<(() => void) | undefined>
  timers: ReturnType<typeof manualTimers>
  stopWatching: Mock
  onUpgraded: Mock
  change: () => void
} {
  const timers = manualTimers()
  const stopWatching = vi.fn()
  const onUpgraded = vi.fn()
  let onChange: () => void = () => {}
  const readInstalledVersion = vi.fn(async () => {
    const version = versions.length > 1 ? versions.shift() : versions[0]
    if (version instanceof Error) {
      throw version
    }
    return version
  })
  const started = watchPackageUpgrade({
    watch: (listener) => {
      onChange = listener
      return stopWatching
    },
    readInstalledVersion,
    isTransactionRunning: async () => locked(),
    onUpgraded,
    timers
  })
  return { started, timers, stopWatching, onUpgraded, change: () => onChange() }
}

test('reports an upgrade once pacman released its lock and the version changed', async () => {
  let locked = true
  const watch = upgradeWatch(['4.5.1-1', '4.5.2-1'], () => locked)
  await watch.started

  watch.change()
  watch.change()
  expect(watch.timers.setTimeout).toHaveBeenCalledTimes(2)
  await watch.timers.fire()
  // Still locked: the hooks are running, so wait again.
  expect(watch.onUpgraded).not.toHaveBeenCalled()
  expect(watch.timers.setTimeout).toHaveBeenCalledTimes(3)

  locked = false
  await watch.timers.fire()
  expect(watch.onUpgraded).toHaveBeenCalledExactlyOnceWith('4.5.2-1')
  expect(watch.stopWatching).toHaveBeenCalledOnce()

  watch.change()
  expect(watch.timers.setTimeout).toHaveBeenCalledTimes(3)
})

test('ignores transactions that leave the package version unchanged', async () => {
  const watch = upgradeWatch(['4.5.1-1'])
  await watch.started
  watch.change()
  await watch.timers.fire()
  expect(watch.onUpgraded).not.toHaveBeenCalled()
  expect(watch.stopWatching).not.toHaveBeenCalled()
})

test('keeps watching when the database cannot be read mid-transaction', async () => {
  const watch = upgradeWatch(['4.5.1-1', new Error('ENOENT'), '4.5.2-1'])
  await watch.started
  watch.change()
  await watch.timers.fire()
  expect(watch.onUpgraded).not.toHaveBeenCalled()
  watch.change()
  await watch.timers.fire()
  expect(watch.onUpgraded).toHaveBeenCalledWith('4.5.2-1')
})

test('does not watch when the installed version is unknown', async () => {
  for (const version of [undefined, new Error('ENOENT')]) {
    const watch = upgradeWatch([version])
    await expect(watch.started).resolves.toBeUndefined()
  }
})

test('stops without reporting an upgrade found after it was stopped', async () => {
  let locked = false
  const watch = upgradeWatch(['4.5.1-1', '4.5.2-1'], () => locked)
  const stop = await watch.started
  watch.change()
  locked = true
  stop?.()
  expect(watch.stopWatching).toHaveBeenCalledOnce()
  await watch.timers.fire()
  expect(watch.onUpgraded).not.toHaveBeenCalled()
})

test('relaunches once no slider moved and no button was pressed for a while', async () => {
  const timers = manualTimers()
  const relaunch = vi.fn()
  let now = 10_000
  let lastActivityAt = 8_000
  relaunchWhenIdle({
    lastActivityAt: () => lastActivityAt,
    now: () => now,
    relaunch,
    idleMs: 5_000,
    timers
  })
  expect(relaunch).not.toHaveBeenCalled()
  expect(timers.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 3_000)

  now = 13_000
  lastActivityAt = 12_000
  await timers.fire()
  expect(relaunch).not.toHaveBeenCalled()
  expect(timers.setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 4_000)

  now = 17_000
  await timers.fire()
  expect(relaunch).toHaveBeenCalledOnce()
})

test('relaunches the upgraded version without the keyring relaunch marker', () => {
  expect(
    upgradeRelaunchArgs([
      '/opt/streamdeck-deej/streamdeck-deej',
      '--ozone-platform=x11',
      KEYRING_RELAUNCH_SWITCH
    ])
  ).toEqual(['--ozone-platform=x11'])
})

let dbPath: string | undefined

afterEach(async () => {
  if (dbPath) {
    await rm(dbPath, { recursive: true, force: true })
    dbPath = undefined
  }
})

async function writeEntry(root: string, version: string): Promise<string> {
  const entry = join(root, 'local', `streamdeck-deej-${version}`)
  await mkdir(entry, { recursive: true })
  await writeFile(join(entry, 'desc'), desc('streamdeck-deej', version))
  return entry
}

test('detects a pacman upgrade in a real database folder', async () => {
  dbPath = await mkdtemp(join(tmpdir(), 'pacman-db-'))
  const oldEntry = await writeEntry(dbPath, '4.5.1-1')
  const onUpgraded = vi.fn()
  const onWatchError = vi.fn()
  const stop = await watchPacmanUpgrade({
    dbPath,
    packageName: 'streamdeck-deej',
    onUpgraded,
    onWatchError,
    settleMs: 50
  })
  expect(stop).toBeTypeOf('function')

  const lock = join(dbPath, 'db.lck')
  await writeFile(lock, '')
  await writeEntry(dbPath, '4.5.2-1')
  await rm(oldEntry, { recursive: true })
  await new Promise((resolve) => setTimeout(resolve, 150))
  expect(onUpgraded).not.toHaveBeenCalled()

  await rename(lock, join(dbPath, 'released'))
  await vi.waitFor(() => expect(onUpgraded).toHaveBeenCalledWith('4.5.2-1'), { timeout: 2_000 })
  expect(onWatchError).not.toHaveBeenCalled()
})

test('does not watch a missing pacman database', async () => {
  dbPath = await mkdtemp(join(tmpdir(), 'pacman-db-'))
  const onWatchError = vi.fn()
  await expect(
    watchPacmanUpgrade({
      dbPath,
      packageName: 'streamdeck-deej',
      onUpgraded: vi.fn(),
      onWatchError
    })
  ).resolves.toBeUndefined()
  expect(onWatchError).not.toHaveBeenCalled()
})

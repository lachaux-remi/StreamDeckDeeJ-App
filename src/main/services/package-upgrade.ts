import { watch as fsWatch } from 'node:fs'
import { access, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { KEYRING_RELAUNCH_SWITCH } from './keyring-unlock'

const SETTLE_MS = 5_000
const IDLE_MS = 5_000

export interface Timers {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

const defaultTimers: Timers = {
  setTimeout,
  clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout)
}

/** Returns the `%VERSION%` of a pacman local database `desc` file for `name`. */
export function parsePacmanDesc(desc: string, name: string): string | undefined {
  const fields = new Map<string, string>()
  const lines = desc.split('\n').map((line) => line.trim())
  lines.forEach((line, index) => {
    const field = line.match(/^%([A-Z]+)%$/)?.[1]
    if (field && lines[index + 1]) {
      fields.set(field, lines[index + 1])
    }
  })
  return fields.get('NAME') === name ? fields.get('VERSION') : undefined
}

/** Picks the local database entry of `name` among `<name>-<pkgver>-<pkgrel>` folders. */
export function pacmanEntryName(entries: readonly string[], name: string): string | undefined {
  return entries.find(
    (entry) => entry.startsWith(`${name}-`) && /^[^-]+-[^-]+$/.test(entry.slice(name.length + 1))
  )
}

interface PackageUpgradeWatchOptions {
  /** Starts watching pacman's database; returns a function that stops it. */
  watch: (onChange: () => void) => () => void
  /** The installed package version, or undefined when it cannot be read. */
  readInstalledVersion: () => Promise<string | undefined>
  /** True while a pacman transaction holds the database lock. */
  isTransactionRunning: () => Promise<boolean>
  onUpgraded: (version: string) => void
  settleMs?: number
  timers?: Timers
}

/**
 * pacman replaces the files, writes its database, then runs its hooks before
 * releasing its lock. Waits until the database stopped changing and the lock
 * is gone, then calls `onUpgraded` once if the installed version differs from
 * the one installed when watching started. Returns a function that stops
 * watching, or undefined when the installed version cannot be read.
 */
export async function watchPackageUpgrade({
  watch,
  readInstalledVersion,
  isTransactionRunning,
  onUpgraded,
  settleMs = SETTLE_MS,
  timers = defaultTimers
}: PackageUpgradeWatchOptions): Promise<(() => void) | undefined> {
  const startedWith = await readInstalledVersion().catch(() => undefined)
  if (!startedWith) {
    return undefined
  }

  let stopped = false
  let timer: unknown
  const stop = (): void => {
    stopped = true
    timers.clearTimeout(timer)
    stopWatching()
  }
  const settle = (): void => {
    timers.clearTimeout(timer)
    timer = timers.setTimeout(() => void check(), settleMs)
  }
  const check = async (): Promise<void> => {
    let installed: string | undefined
    try {
      if (await isTransactionRunning()) {
        if (!stopped) {
          settle()
        }
        return
      }
      installed = await readInstalledVersion()
    } catch {
      // The database is mid-update; the next change checks again.
    }
    if (stopped || !installed || installed === startedWith) {
      return
    }
    stop()
    onUpgraded(installed)
  }
  const stopWatching = watch(() => {
    if (!stopped) {
      settle()
    }
  })
  return stop
}

interface RelaunchWhenIdleOptions {
  /** Timestamp of the last slider move or button press. */
  lastActivityAt: () => number
  now?: () => number
  relaunch: () => void
  idleMs?: number
  timers?: Timers
}

/** Relaunches once no slider moved and no button was pressed for `idleMs`. */
export function relaunchWhenIdle({
  lastActivityAt,
  now = Date.now,
  relaunch,
  idleMs = IDLE_MS,
  timers = defaultTimers
}: RelaunchWhenIdleOptions): void {
  const remaining = lastActivityAt() + idleMs - now()
  if (remaining <= 0) {
    relaunch()
    return
  }
  timers.setTimeout(
    () => relaunchWhenIdle({ lastActivityAt, now, relaunch, idleMs, timers }),
    remaining
  )
}

/**
 * The relaunched process runs the upgraded version, so it may retry the
 * keyring recovery the old one already attempted.
 */
export function upgradeRelaunchArgs(argv: readonly string[]): string[] {
  return argv.slice(1).filter((arg) => arg !== KEYRING_RELAUNCH_SWITCH)
}

interface PacmanUpgradeOptions {
  /** pacman's database folder, holding `db.lck` and `local/`. */
  dbPath: string
  packageName: string
  onUpgraded: (version: string) => void
  onWatchError: (error: unknown) => void
  settleMs?: number
}

/** Watches pacman's local database for an upgrade of `packageName`. */
export function watchPacmanUpgrade({
  dbPath,
  packageName,
  onUpgraded,
  onWatchError,
  settleMs
}: PacmanUpgradeOptions): Promise<(() => void) | undefined> {
  const localPath = join(dbPath, 'local')
  return watchPackageUpgrade({
    watch: (onChange) => {
      // The lock appears and disappears in dbPath, entries are renamed in local/.
      const watchers = [dbPath, localPath].flatMap((path) => {
        try {
          const watcher = fsWatch(path, onChange)
          watcher.on('error', onWatchError)
          return [watcher]
        } catch (error) {
          onWatchError(error)
          return []
        }
      })
      return () => watchers.forEach((watcher) => watcher.close())
    },
    readInstalledVersion: async () => {
      const entry = pacmanEntryName(await readdir(localPath), packageName)
      if (!entry) {
        return undefined
      }
      return parsePacmanDesc(await readFile(join(localPath, entry, 'desc'), 'utf8'), packageName)
    },
    isTransactionRunning: async () => {
      try {
        await access(join(dbPath, 'db.lck'))
        return true
      } catch {
        return false
      }
    },
    onUpgraded,
    settleMs
  })
}

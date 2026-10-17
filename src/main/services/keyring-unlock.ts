import type { CommandRunner } from './audio-command'

/** Marks the process relaunched after a keyring unlock, so it never relaunches again. */
export const KEYRING_RELAUNCH_SWITCH = '--keyring-unlocked-relaunch'

const DBUS_TIMEOUT_MS = 2_000
const POLL_INTERVAL_MS = 5_000

const KWALLET_DAEMONS: Record<string, { service: string; path: string }> = {
  kwallet: { service: 'org.kde.kwalletd', path: '/modules/kwalletd' },
  kwallet5: { service: 'org.kde.kwalletd5', path: '/modules/kwalletd5' },
  kwallet6: { service: 'org.kde.kwalletd6', path: '/modules/kwalletd6' }
}

type KeyringProbe = (runner: CommandRunner) => Promise<boolean>

function dbusCall(runner: CommandRunner, args: readonly string[]): Promise<string> {
  return runner.run('dbus-send', ['--session', '--print-reply', ...args], DBUS_TIMEOUT_MS)
}

function kwalletProbe(service: string, path: string): KeyringProbe {
  return async (runner) => {
    // Chromium stores its key in the network wallet.
    const walletReply = await dbusCall(runner, [
      `--dest=${service}`,
      path,
      'org.kde.KWallet.networkWallet'
    ])
    const wallet = walletReply.match(/string "([^"]*)"/)?.[1]
    if (!wallet) {
      return false
    }
    const openReply = await dbusCall(runner, [
      `--dest=${service}`,
      path,
      'org.kde.KWallet.isOpen',
      `string:${wallet}`
    ])
    return /boolean true/.test(openReply)
  }
}

const secretServiceProbe: KeyringProbe = async (runner) => {
  const reply = await dbusCall(runner, [
    '--dest=org.freedesktop.secrets',
    '/org/freedesktop/secrets/aliases/default',
    'org.freedesktop.DBus.Properties.Get',
    'string:org.freedesktop.Secret.Collection',
    'string:Locked'
  ])
  return /boolean false/.test(reply)
}

/**
 * Returns how to ask, without prompting the user, whether the keyring behind a
 * safeStorage backend is unlocked, or undefined when the backend has no keyring.
 */
export function keyringProbe(backend: string): KeyringProbe | undefined {
  const kwallet = KWALLET_DAEMONS[backend]
  if (kwallet) {
    return kwalletProbe(kwallet.service, kwallet.path)
  }
  if (backend === 'gnome_libsecret') {
    return secretServiceProbe
  }
  return undefined
}

interface Timers {
  setTimeout(callback: () => void, ms: number): unknown
  clearTimeout(handle: unknown): void
}

interface KeyringWatchOptions {
  backend: string
  runner: CommandRunner
  onUnlocked: () => void
  intervalMs?: number
  timers?: Timers
}

/**
 * Polls the keyring until it is unlocked, then calls `onUnlocked` once.
 * Returns a function that stops watching, or undefined when the backend
 * cannot be watched.
 */
export function watchKeyringUnlock({
  backend,
  runner,
  onUnlocked,
  intervalMs = POLL_INTERVAL_MS,
  timers = { setTimeout, clearTimeout: (handle) => clearTimeout(handle as NodeJS.Timeout) }
}: KeyringWatchOptions): (() => void) | undefined {
  const probe = keyringProbe(backend)
  if (!probe) {
    return undefined
  }

  let stopped = false
  let timer: unknown
  const schedule = (): void => {
    timer = timers.setTimeout(() => void check(), intervalMs)
  }
  const check = async (): Promise<void> => {
    let unlocked = false
    try {
      unlocked = await probe(runner)
    } catch {
      // The daemon may not be running yet; keep polling.
    }
    if (stopped) {
      return
    }
    if (unlocked) {
      stopped = true
      onUnlocked()
      return
    }
    schedule()
  }

  void check()
  return () => {
    stopped = true
    timers.clearTimeout(timer)
  }
}

interface KeyringRecoveryOptions {
  argv: readonly string[]
  env: NodeJS.ProcessEnv
  backend: string
  /** False once every unavailable secret was replaced, making the relaunch pointless. */
  needsRecovery: () => boolean
  watch: (backend: string, onUnlocked: () => void) => (() => void) | undefined
  relaunch: (args: string[]) => void
  log: { info(message: string): void; warn(message: string): void }
}

/**
 * Chromium reads the keyring once per process: when it is still locked at
 * startup, safeStorage stays unable to decrypt until the app restarts. Waits
 * for the keyring to unlock, then relaunches once so the secrets load.
 */
export function startKeyringRecovery({
  argv,
  env,
  backend,
  needsRecovery,
  watch,
  relaunch,
  log
}: KeyringRecoveryOptions): (() => void) | undefined {
  if (argv.includes(KEYRING_RELAUNCH_SWITCH)) {
    log.warn('Keyring is unlocked but secrets still cannot be decrypted; not relaunching again')
    return undefined
  }
  if (env['ELECTRON_RENDERER_URL']) {
    log.warn('Keyring is locked; restart the dev server once it is unlocked to load secrets')
    return undefined
  }

  const stop = watch(backend, () => {
    if (!needsRecovery()) {
      return
    }
    log.info('Keyring unlocked; relaunching to load Home Assistant and Discord secrets')
    relaunch([...argv.slice(1), KEYRING_RELAUNCH_SWITCH])
  })
  if (!stop) {
    log.warn(`Cannot watch the ${backend} keyring; restart the app once it is unlocked`)
  }
  return stop
}

import { existsSync } from 'node:fs'

const NVIDIA_DRIVER = '/proc/driver/nvidia/version'
export const XWAYLAND_SWITCH = '--ozone-platform=x11'

interface DisplayEnvironment {
  platform: NodeJS.Platform
  env: NodeJS.ProcessEnv
  argv: readonly string[]
  hasNvidiaDriver(): boolean
}

/**
 * Chromium's native Wayland backend with the NVIDIA driver can show a newly
 * created window with stale, wrong colors until something forces a repaint.
 * Rendering through XWayland avoids it. Chromium picks its display backend
 * before the main script runs, so the switch must be on the command line:
 * returns the arguments to relaunch with, or undefined to start normally.
 * An explicit --ozone-platform wins, and the dev server's process is kept.
 */
export function xwaylandRelaunchArgs({
  platform,
  env,
  argv,
  hasNvidiaDriver
}: DisplayEnvironment): string[] | undefined {
  const args = argv.slice(1)
  if (
    platform !== 'linux' ||
    env['XDG_SESSION_TYPE'] !== 'wayland' ||
    !env['DISPLAY'] ||
    env['ELECTRON_RENDERER_URL'] ||
    args.some((arg) => arg.startsWith('--ozone-platform')) ||
    !hasNvidiaDriver()
  ) {
    return undefined
  }
  return [XWAYLAND_SWITCH, ...args]
}

export function linuxXWaylandRelaunchArgs(): string[] | undefined {
  return xwaylandRelaunchArgs({
    platform: process.platform,
    env: process.env,
    argv: process.argv,
    hasNvidiaDriver: () => existsSync(NVIDIA_DRIVER)
  })
}

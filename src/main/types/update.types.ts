export type LinuxUpdateMode = 'disabled' | 'appimage' | 'package-manager'
export type LinuxUpdateCommand = 'check' | 'download' | 'install' | 'open-release'

export interface LinuxReleaseInfo {
  version: string
  releaseName: string
  releaseNotes: string
}

export type LinuxUpdateState =
  | { mode: 'disabled'; status: 'disabled' }
  | { mode: Exclude<LinuxUpdateMode, 'disabled'>; status: 'idle'; currentVersion: string }
  | { mode: Exclude<LinuxUpdateMode, 'disabled'>; status: 'checking'; currentVersion: string }
  | { mode: Exclude<LinuxUpdateMode, 'disabled'>; status: 'up-to-date'; currentVersion: string }
  | ({
      mode: Exclude<LinuxUpdateMode, 'disabled'>
      status: 'available' | 'downloading' | 'downloaded'
      currentVersion: string
    } & LinuxReleaseInfo & { progress?: number })
  | {
      mode: Exclude<LinuxUpdateMode, 'disabled'>
      status: 'error'
      currentVersion: string
      message: string
    }

const COMMANDS: readonly LinuxUpdateCommand[] = ['check', 'download', 'install', 'open-release']

export function isLinuxUpdateCommand(value: unknown): value is LinuxUpdateCommand {
  return typeof value === 'string' && COMMANDS.includes(value as LinuxUpdateCommand)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

export function isLinuxUpdateState(value: unknown): value is LinuxUpdateState {
  if (!isRecord(value) || typeof value.mode !== 'string' || typeof value.status !== 'string') {
    return false
  }
  if (value.mode === 'disabled') {
    return value.status === 'disabled' && hasOnlyKeys(value, ['mode', 'status'])
  }
  if (value.mode !== 'appimage' && value.mode !== 'package-manager') {
    return false
  }
  if (typeof value.currentVersion !== 'string') {
    return false
  }

  if (value.status === 'idle' || value.status === 'checking' || value.status === 'up-to-date') {
    return hasOnlyKeys(value, ['mode', 'status', 'currentVersion'])
  }
  if (value.status === 'error') {
    return (
      typeof value.message === 'string' &&
      hasOnlyKeys(value, ['mode', 'status', 'currentVersion', 'message'])
    )
  }
  if (
    value.status !== 'available' &&
    value.status !== 'downloading' &&
    value.status !== 'downloaded'
  ) {
    return false
  }
  return (
    typeof value.version === 'string' &&
    typeof value.releaseName === 'string' &&
    typeof value.releaseNotes === 'string' &&
    (value.progress === undefined ||
      (typeof value.progress === 'number' && value.progress >= 0 && value.progress <= 100)) &&
    hasOnlyKeys(value, [
      'mode',
      'status',
      'currentVersion',
      'version',
      'releaseName',
      'releaseNotes',
      'progress'
    ])
  )
}

export type UpdateCommand = 'check' | 'download' | 'install' | 'open-release'

export type UpdateState =
  | { mode: 'disabled'; status: 'disabled' }
  | {
      mode: 'appimage' | 'package-manager' | 'nsis'
      status: 'idle' | 'checking' | 'up-to-date'
      currentVersion: string
    }
  | {
      mode: 'appimage' | 'package-manager' | 'nsis'
      status: 'available' | 'downloading' | 'downloaded'
      currentVersion: string
      version: string
      releaseName: string
      releaseNotes: string
      progress?: number
    }
  | {
      mode: 'appimage' | 'package-manager' | 'nsis'
      status: 'error'
      currentVersion: string
      message: string
    }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasOnlyKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).every((key) => keys.includes(key))
}

export function isUpdateState(value: unknown): value is UpdateState {
  if (!isRecord(value) || typeof value.mode !== 'string' || typeof value.status !== 'string') {
    return false
  }
  if (value.mode === 'disabled') {
    return value.status === 'disabled' && hasOnlyKeys(value, ['mode', 'status'])
  }
  if (value.mode !== 'appimage' && value.mode !== 'package-manager' && value.mode !== 'nsis') {
    return false
  }
  if (typeof value.currentVersion !== 'string') {
    return false
  }
  if (['idle', 'checking', 'up-to-date'].includes(value.status)) {
    return hasOnlyKeys(value, ['mode', 'status', 'currentVersion'])
  }
  if (value.status === 'error') {
    return (
      typeof value.message === 'string' &&
      hasOnlyKeys(value, ['mode', 'status', 'currentVersion', 'message'])
    )
  }
  if (!['available', 'downloading', 'downloaded'].includes(value.status)) {
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

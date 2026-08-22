export const MAX_SETTINGS_BYTES = 8 * 1024 * 1024
export const MAX_ICON_FILE_BYTES = 512 * 1024
export const MAX_ICON_DATA_URL_LENGTH = 700_000
export const MAX_STREAMDECK_KEYS = 64
export const MAX_DEEJ_SLIDERS = 16
export const MAX_SESSIONS_PER_SLIDER = 128
export const MAX_ACTION_PARAMS = 8
export const MAX_LED_CONDITIONS = 6
export const MAX_SHORT_STRING_LENGTH = 256
export const MAX_PARAM_LENGTH = 4096
export const MAX_URL_LENGTH = 2048

export const SUPPORTED_ICON_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml'
] as const

export function isIconDataUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_ICON_DATA_URL_LENGTH) return false
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/.exec(value)
  const payload = match?.[2]
  const padding = payload?.endsWith('==') ? 2 : payload?.endsWith('=') ? 1 : 0
  return (
    match !== null &&
    SUPPORTED_ICON_MIME_TYPES.includes(match[1] as (typeof SUPPORTED_ICON_MIME_TYPES)[number]) &&
    payload !== undefined &&
    payload.length > 0 &&
    payload.length % 4 === 0 &&
    (payload.length / 4) * 3 - padding <= MAX_ICON_FILE_BYTES
  )
}

export function isDeckKey(value: unknown): value is string {
  return (
    typeof value === 'string' && /^(0|[1-9]\d?)$/.test(value) && Number(value) < MAX_STREAMDECK_KEYS
  )
}

export function isSliderKey(value: string): boolean {
  return /^(0|[1-9]\d?)$/.test(value) && Number(value) < MAX_DEEJ_SLIDERS
}

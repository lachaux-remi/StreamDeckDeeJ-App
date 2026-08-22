import {
  MAX_ICON_FILE_BYTES,
  SUPPORTED_ICON_MIME_TYPES,
  isIconDataUrl
} from '../../../shared/input-limits'

export const ICON_FILE_ACCEPT = SUPPORTED_ICON_MIME_TYPES.join(',')

export function readIconFile(
  file: File,
  createReader: () => FileReader = () => new FileReader()
): Promise<string | null> {
  if (
    file.size <= 0 ||
    file.size > MAX_ICON_FILE_BYTES ||
    !SUPPORTED_ICON_MIME_TYPES.includes(file.type as (typeof SUPPORTED_ICON_MIME_TYPES)[number])
  ) {
    return Promise.resolve(null)
  }

  return new Promise((resolve) => {
    const reader = createReader()
    reader.onload = () => resolve(isIconDataUrl(reader.result) ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(file)
  })
}

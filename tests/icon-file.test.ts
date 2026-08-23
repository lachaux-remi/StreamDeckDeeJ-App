import { afterEach, expect, test, vi } from 'vitest'
import { MAX_ICON_FILE_BYTES } from '../src/shared/input-limits'
import { readIconFile } from '@renderer/lib/icon-file'

afterEach(() => vi.unstubAllGlobals())

test('rejects unsupported or oversized icons before constructing FileReader', async () => {
  const createReader = vi.fn(() => {
    throw new Error('FileReader must not be constructed')
  })

  await expect(
    readIconFile({ type: 'text/html', size: 10 } as File, createReader)
  ).resolves.toBeNull()
  await expect(
    readIconFile({ type: 'image/png', size: MAX_ICON_FILE_BYTES + 1 } as File, createReader)
  ).resolves.toBeNull()
  expect(createReader).not.toHaveBeenCalled()
})

test('reads a supported icon within the file-size limit', async () => {
  const dataUrl = 'data:image/png;base64,AAA='
  const reader = {
    result: null as string | null,
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    readAsDataURL: vi.fn(function (this: typeof reader) {
      this.result = dataUrl
      this.onload?.()
    })
  }

  await expect(
    readIconFile({ type: 'image/png', size: 1 } as File, () => reader as unknown as FileReader)
  ).resolves.toBe(dataUrl)
  expect(reader.readAsDataURL).toHaveBeenCalledOnce()
})

test('uses FileReader by default and treats read errors as rejection', async () => {
  class SuccessfulReader {
    result: string | null = 'data:image/png;base64,AA=='
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    readAsDataURL(): void {
      this.onload?.()
    }
  }
  vi.stubGlobal('FileReader', SuccessfulReader)

  await expect(readIconFile({ type: 'image/png', size: 1 } as File)).resolves.toBe(
    'data:image/png;base64,AA=='
  )

  const failingReader = {
    result: null,
    onload: null as (() => void) | null,
    onerror: null as (() => void) | null,
    readAsDataURL() {
      this.onerror?.()
    }
  }
  await expect(
    readIconFile(
      { type: 'image/webp', size: 1 } as File,
      () => failingReader as unknown as FileReader
    )
  ).resolves.toBeNull()
})

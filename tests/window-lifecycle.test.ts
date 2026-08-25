import { expect, test, vi } from 'vitest'
import { restoreAndFocusWindow } from '@main/services/window-lifecycle'

test('restores, shows, and focuses the existing window for a second instance', () => {
  const window = {
    isMinimized: vi.fn().mockReturnValue(true),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn()
  }

  restoreAndFocusWindow(window)

  expect(window.restore).toHaveBeenCalledOnce()
  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
})

test('does not restore a window that is not minimized', () => {
  const window = {
    isMinimized: vi.fn().mockReturnValue(false),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn()
  }

  restoreAndFocusWindow(window)

  expect(window.restore).not.toHaveBeenCalled()
  expect(window.show).toHaveBeenCalledOnce()
  expect(window.focus).toHaveBeenCalledOnce()
})

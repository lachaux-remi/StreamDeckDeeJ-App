import { expect, test, vi } from 'vitest'
import { createWindowCloseHandler } from '@main/services/window-close-handler'

test('reads the current close-to-tray setting whenever the window closes', () => {
  let closeToTray = true
  let quitting = false
  const hide = vi.fn()
  const preventDefault = vi.fn()
  const handleClose = createWindowCloseHandler(
    () => closeToTray,
    () => quitting,
    hide
  )

  handleClose({ preventDefault })
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(hide).toHaveBeenCalledOnce()

  closeToTray = false
  handleClose({ preventDefault })
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(hide).toHaveBeenCalledOnce()

  closeToTray = true
  quitting = true
  handleClose({ preventDefault })
  expect(preventDefault).toHaveBeenCalledOnce()
  expect(hide).toHaveBeenCalledOnce()
})

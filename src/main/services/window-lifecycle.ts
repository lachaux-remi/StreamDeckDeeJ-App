interface RestorableWindow {
  isMinimized(): boolean
  restore(): void
  show(): void
  focus(): void
}

export function restoreAndFocusWindow(window: RestorableWindow): void {
  if (window.isMinimized()) {
    window.restore()
  }
  window.show()
  window.focus()
}

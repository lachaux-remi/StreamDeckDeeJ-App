interface WindowCloseEvent {
  preventDefault(): void
}

export function createWindowCloseHandler(
  closeToTrayEnabled: () => boolean,
  isQuitting: () => boolean,
  hideWindow: () => void
): (event: WindowCloseEvent) => void {
  return (event) => {
    if (isQuitting() || !closeToTrayEnabled()) {
      return
    }
    event.preventDefault()
    hideWindow()
  }
}

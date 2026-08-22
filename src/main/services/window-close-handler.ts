interface WindowCloseEvent {
  preventDefault(): void
}

export function createWindowCloseHandler(
  closeToTrayEnabled: () => boolean,
  hideWindow: () => void
): (event: WindowCloseEvent) => void {
  return (event) => {
    if (!closeToTrayEnabled()) return
    event.preventDefault()
    hideWindow()
  }
}

interface TrustedSender {
  mainFrame: unknown
}

interface SenderEvent {
  sender: unknown
  senderFrame: unknown
}

export function isTrustedSender(event: SenderEvent, trustedSender: TrustedSender): boolean {
  return event.sender === trustedSender && event.senderFrame === trustedSender.mainFrame
}

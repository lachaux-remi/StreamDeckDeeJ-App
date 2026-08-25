import type { WebContents } from 'electron'
import type { AudioSessionsCapability } from '@main/platform-runtime'
import { sliderService } from '@main/services/slider.service'
import { handleIpc } from './trusted-ipc'

export function registerDeejHandlers(
  trustedSender: WebContents,
  sessions: AudioSessionsCapability
): void {
  handleIpc(trustedSender, 'deej:sliders', () => {
    const sliders = sliderService.getSliders()
    // If no data from Arduino yet, read current volumes from OS
    if (Object.keys(sliders).length === 0) {
      return sessions.getOsVolumes()
    }
    return sliders
  })
  handleIpc(trustedSender, 'deej:sessions', () => sessions.getAllSessions())
}

import type { WebContents } from 'electron'
import { sessionsService } from '@main/services/sessions.service'
import { sliderService } from '@main/services/slider.service'
import { handleIpc } from './trusted-ipc'

export function registerDeejHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, 'deej:sliders', () => {
    const sliders = sliderService.getSliders()
    // If no data from Arduino yet, read current volumes from OS
    if (Object.keys(sliders).length === 0) {
      return sessionsService.getOsVolumes()
    }
    return sliders
  })
  handleIpc(trustedSender, 'deej:sessions', () => sessionsService.getAllSessions())
}

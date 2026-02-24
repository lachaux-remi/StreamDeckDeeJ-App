import { ipcMain } from 'electron'
import { sessionsService } from '@main/services/sessions.service'
import { sliderService } from '@main/services/slider.service'

export function registerDeejHandlers(): void {
  ipcMain.handle('deej:sliders', () => {
    const sliders = sliderService.getSliders()
    // If no data from Arduino yet, read current volumes from OS
    if (Object.keys(sliders).length === 0) {
      return sessionsService.getOsVolumes()
    }
    return sliders
  })
  ipcMain.handle('deej:sessions', () => sessionsService.getAllSessions())
}

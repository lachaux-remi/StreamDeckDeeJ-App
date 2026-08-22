import type { WebContents } from 'electron'
import { hardwarePermissionsService } from '@main/services/hardware-permissions.service'
import { handleIpc } from './trusted-ipc'
import {
  HARDWARE_PERMISSIONS_CHANNELS,
  assertHardwarePermissionsRequest
} from './hardware-permissions.contract'

export function registerHardwarePermissionsHandlers(trustedSender: WebContents): void {
  handleIpc(trustedSender, HARDWARE_PERMISSIONS_CHANNELS.diagnose, (...args: unknown[]) => {
    assertHardwarePermissionsRequest(args)
    return hardwarePermissionsService.diagnose()
  })
  handleIpc(trustedSender, HARDWARE_PERMISSIONS_CHANNELS.install, (...args: unknown[]) => {
    assertHardwarePermissionsRequest(args)
    return hardwarePermissionsService.install()
  })
}

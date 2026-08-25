import type { WebContents } from 'electron'
import type { HardwarePermissionsCapability } from '@main/platform-runtime'
import { handleIpc } from './trusted-ipc'
import {
  HARDWARE_PERMISSIONS_CHANNELS,
  assertHardwarePermissionsRequest
} from './hardware-permissions.contract'

export function registerHardwarePermissionsHandlers(
  trustedSender: WebContents,
  hardwarePermissions: HardwarePermissionsCapability
): void {
  handleIpc(trustedSender, HARDWARE_PERMISSIONS_CHANNELS.diagnose, (...args: unknown[]) => {
    assertHardwarePermissionsRequest(args)
    return hardwarePermissions.diagnose()
  })
  handleIpc(trustedSender, HARDWARE_PERMISSIONS_CHANNELS.install, (...args: unknown[]) => {
    assertHardwarePermissionsRequest(args)
    return hardwarePermissions.install()
  })
}

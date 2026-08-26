import HID from 'node-hid'
import { SerialPort } from 'serialport'
import type { HardwareDiagnostic } from '../../shared/hardware-diagnostic'
import {
  isOfficialFirmwarePort,
  OFFICIAL_PRODUCT_ID,
  OFFICIAL_VENDOR_ID
} from './serial-port-discovery'

export function buildWindowsHardwareDiagnostic(
  hidDevices: { path?: string; interface?: number; usage?: number }[],
  serialDevices: { path?: string; vendorId: string | undefined; productId: string | undefined }[]
): Extract<HardwareDiagnostic, { platform: 'windows' }> {
  return {
    platform: 'windows',
    hid: hidDevices.some((device) => device.interface === 2 && device.usage === 1)
      ? 'detected'
      : 'not-detected',
    serial: serialDevices.some(isOfficialFirmwarePort) ? 'detected' : 'not-detected'
  }
}

export async function diagnoseWindowsHardware(): Promise<
  Extract<HardwareDiagnostic, { platform: 'windows' }>
> {
  const [serialDevices, hidDevices] = await Promise.all([
    SerialPort.list(),
    Promise.resolve(HID.devices(OFFICIAL_VENDOR_ID, OFFICIAL_PRODUCT_ID))
  ])
  return buildWindowsHardwareDiagnostic(hidDevices, serialDevices)
}

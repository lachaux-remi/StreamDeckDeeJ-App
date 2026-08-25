import { expect, test } from 'vitest'
import {
  isOfficialFirmwarePort,
  linuxUsbProductLink,
  preferOfficialFirmwarePorts
} from '@main/services/serial-port-discovery'

test('recognizes the official firmware exact USB VID/PID', () => {
  expect(isOfficialFirmwarePort({ vendorId: '5239', productId: '0001' })).toBe(true)
  expect(isOfficialFirmwarePort({ vendorId: '0x5239', productId: '0X0001' })).toBe(true)
  expect(isOfficialFirmwarePort({ vendorId: '5239', productId: '0002' })).toBe(false)
  expect(isOfficialFirmwarePort({ vendorId: undefined, productId: undefined })).toBe(false)
  expect(isOfficialFirmwarePort({ vendorId: 'not-hex', productId: '0001' })).toBe(false)
})

test('prefers the official module without removing another controller', () => {
  const configuredPort = {
    path: '/dev/ttyUSB7',
    vendorId: undefined,
    productId: undefined,
    manufacturer: undefined
  }
  const officialPort = { path: '/dev/ttyACM2', vendorId: '5239', productId: '0001' }
  const otherPort = { path: '/dev/ttyACM0', vendorId: 'abcd', productId: '0001' }

  const result = preferOfficialFirmwarePorts([configuredPort, officialPort, otherPort])

  expect(result).toEqual([officialPort, configuredPort, otherPort])
  expect(result).toContain(configuredPort)
})

test('resolves Linux USB metadata only for Linux device paths', () => {
  expect(linuxUsbProductLink('linux', '/dev/ttyACM2')).toBe('/sys/class/tty/ttyACM2/device')
  expect(linuxUsbProductLink('win32', 'COM7')).toBeUndefined()
  expect(linuxUsbProductLink('linux', 'COM7')).toBeUndefined()
  expect(linuxUsbProductLink('linux', '/dev/serial/by-id/device')).toBeUndefined()
})

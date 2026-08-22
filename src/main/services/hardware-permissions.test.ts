import { expect, test } from 'vitest'
import {
  HARDWARE_PERMISSIONS_CHANNELS,
  assertHardwarePermissionsRequest
} from '../handlers/hardware-permissions.contract'
import {
  buildManualInstallCommand,
  buildHardwarePermissionsDiagnostic,
  isReadOnlyAppImageMount,
  runPermissionInstaller
} from './hardware-permissions-core'
import { isTrustedSender } from '../handlers/trusted-ipc-core'

const EXPECTED_RULE = [
  'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="5239", ATTRS{idProduct}=="0001", TAG+="uaccess"',
  'SUBSYSTEM=="tty", ATTRS{idVendor}=="5239", ATTRS{idProduct}=="0001", MODE="0660", TAG+="uaccess"',
  ''
].join('\n')

test('distinguishes missing hardware from inaccessible HID and accessible official serial', async () => {
  const diagnostic = await buildHardwarePermissionsDiagnostic({
    hidDevices: [{ path: '/dev/hidraw9' }],
    serialDevices: [{ path: '/dev/ttyACM9', vendorId: '5239', productId: '0001' }],
    canReadWrite: async (path) => path.endsWith('ttyACM9'),
    readInstalledRule: async () => null,
    appImage: true,
    pkexecAvailable: true,
    installerAvailable: true,
    officialVendorId: '5239',
    officialProductId: '0001',
    expectedRule: EXPECTED_RULE
  })

  expect(diagnostic).toEqual({
    hid: 'permission-denied',
    serial: 'accessible',
    rule: 'missing',
    installAction: 'available'
  })
  expect(JSON.stringify(diagnostic)).not.toContain('/dev/')
})

test('reports official interfaces absent without confusing absence with permissions', async () => {
  const diagnostic = await buildHardwarePermissionsDiagnostic({
    hidDevices: [],
    serialDevices: [{ path: '/dev/ttyUSB9', vendorId: '1234', productId: '5678' }],
    canReadWrite: async () => true,
    readInstalledRule: async () => null,
    appImage: false,
    pkexecAvailable: false,
    installerAvailable: false,
    officialVendorId: '5239',
    officialProductId: '0001',
    expectedRule: EXPECTED_RULE
  })

  expect(diagnostic.hid).toBe('not-detected')
  expect(diagnostic.serial).toBe('not-detected')
  expect(diagnostic.installAction).toBe('unavailable')
  expect(diagnostic.manualCommand).toBe(buildManualInstallCommand(EXPECTED_RULE))
})

test('offers elevation only when packaged resources are on a read-only AppImage mount', () => {
  const mountInfo =
    '42 31 0:99 / /tmp/.mount_stream\\040deck ro,nosuid,nodev - fuse.streamdeck streamdeck ro'

  expect(
    isReadOnlyAppImageMount({
      isPackaged: true,
      appImagePath: '/home/user/streamdeck-deej.AppImage',
      resourcesPath: '/tmp/.mount_stream deck/resources',
      mountInfo
    })
  ).toBe(true)
  expect(
    isReadOnlyAppImageMount({
      isPackaged: true,
      appImagePath: '/home/user/streamdeck-deej.AppImage',
      resourcesPath: '/tmp/extracted/resources',
      mountInfo: '42 31 0:99 / /tmp/extracted rw - ext4 /dev/root rw'
    })
  ).toBe(false)
})

test('runs only the fixed AppImage helper through pkexec without a shell', async () => {
  const calls: unknown[] = []
  const result = await runPermissionInstaller(
    {
      appImage: true,
      pkexecPath: '/usr/bin/pkexec',
      installerPath: '/read-only-appimage/resources/linux/install-udev-rule'
    },
    (command, args, options) => {
      calls.push({ command, args, options })
      return Promise.resolve(0)
    }
  )

  expect(result).toBe('installed')
  expect(calls).toEqual([
    {
      command: '/usr/bin/pkexec',
      args: ['/read-only-appimage/resources/linux/install-udev-rule', 'install'],
      options: { shell: false }
    }
  ])
})

test('refuses privileged installation outside an AppImage', async () => {
  await expect(
    runPermissionInstaller(
      {
        appImage: false,
        pkexecPath: '/usr/bin/pkexec',
        installerPath: '/tmp/install-udev-rule'
      },
      async () => 0
    )
  ).rejects.toThrow(/AppImage/)
})

test('permission IPC exposes fixed no-input diagnostic and install operations', () => {
  expect(HARDWARE_PERMISSIONS_CHANNELS).toEqual({
    diagnose: 'hardware-permissions:diagnose',
    install: 'hardware-permissions:install'
  })
  expect(() => assertHardwarePermissionsRequest([])).not.toThrow()
  expect(() => assertHardwarePermissionsRequest(['/dev/ttyACM0'])).toThrow(
    /do not accept arguments/i
  )

  const mainFrame = {}
  const trustedSender = { mainFrame }
  expect(isTrustedSender({ sender: trustedSender, senderFrame: mainFrame }, trustedSender)).toBe(
    true
  )
  expect(isTrustedSender({ sender: trustedSender, senderFrame: {} }, trustedSender)).toBe(false)
  expect(isTrustedSender({ sender: {}, senderFrame: mainFrame }, trustedSender)).toBe(false)
})

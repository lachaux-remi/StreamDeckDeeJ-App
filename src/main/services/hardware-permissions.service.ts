import { constants } from 'node:fs'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import { app } from 'electron'
import HID from 'node-hid'
import { SerialPort } from 'serialport'
import {
  buildHardwarePermissionsDiagnostic,
  isReadOnlyAppImageMount,
  runPermissionInstaller,
  type HardwarePermissionsDiagnostic
} from './hardware-permissions-core'

const PKEXEC_PATH = '/usr/bin/pkexec'
const INSTALLED_RULE_PATH = '/etc/udev/rules.d/70-streamdeck-deej.rules'
const OFFICIAL_VENDOR_ID = '5239'
const OFFICIAL_PRODUCT_ID = '0001'

async function canReadWrite(path: string): Promise<boolean> {
  return access(path, constants.R_OK | constants.W_OK).then(
    () => true,
    () => false
  )
}

async function canExecute(path: string): Promise<boolean> {
  return access(path, constants.X_OK).then(
    () => true,
    () => false
  )
}

async function readInstalledRule(): Promise<string | null> {
  return readFile(INSTALLED_RULE_PATH, 'utf8').catch(() => null)
}

function spawnInstaller(
  command: string,
  args: string[],
  options: { shell: false }
): Promise<number | null> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, stdio: 'ignore' })
    child.once('error', reject)
    child.once('close', resolve)
  })
}

class HardwarePermissionsService {
  private get installerPath(): string {
    return join(process.resourcesPath, 'linux', 'install-udev-rule')
  }

  private get ruleSourcePath(): string {
    return app.isPackaged
      ? join(process.resourcesPath, 'linux', '70-streamdeck-deej.rules')
      : join(__dirname, '../../resources/linux/70-streamdeck-deej.rules')
  }

  private async isReadOnlyAppImage(): Promise<boolean> {
    const mountInfo = await readFile('/proc/self/mountinfo', 'utf8').catch(() => '')
    return isReadOnlyAppImageMount({
      isPackaged: app.isPackaged,
      appImagePath: process.env.APPIMAGE,
      resourcesPath: process.resourcesPath,
      mountInfo
    })
  }

  async diagnose(): Promise<HardwarePermissionsDiagnostic> {
    const [serialDevices, pkexecAvailable, installerAvailable, appImage, expectedRule] =
      await Promise.all([
        SerialPort.list(),
        canExecute(PKEXEC_PATH),
        canExecute(this.installerPath),
        this.isReadOnlyAppImage(),
        readFile(this.ruleSourcePath, 'utf8')
      ])
    const hidDevices = HID.devices(
      Number.parseInt(OFFICIAL_VENDOR_ID, 16),
      Number.parseInt(OFFICIAL_PRODUCT_ID, 16)
    ).filter(
      (device) => device.interface === 2 && device.usage === 1
    )

    return buildHardwarePermissionsDiagnostic({
      hidDevices,
      serialDevices,
      canReadWrite,
      readInstalledRule,
      appImage,
      pkexecAvailable,
      installerAvailable,
      officialVendorId: OFFICIAL_VENDOR_ID,
      officialProductId: OFFICIAL_PRODUCT_ID,
      expectedRule
    })
  }

  async install(): Promise<{
    result: 'installed' | 'cancelled' | 'failed'
    diagnostic: HardwarePermissionsDiagnostic
  }> {
    const appImage = await this.isReadOnlyAppImage()
    const result = await runPermissionInstaller(
      {
        appImage,
        pkexecPath: PKEXEC_PATH,
        installerPath: this.installerPath
      },
      spawnInstaller
    )
    return { result, diagnostic: await this.diagnose() }
  }
}

export const hardwarePermissionsService = new HardwarePermissionsService()

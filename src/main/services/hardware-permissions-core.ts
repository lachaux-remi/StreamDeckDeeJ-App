export type DeviceAccess = 'accessible' | 'permission-denied' | 'not-detected'
export type RuleStatus = 'installed' | 'missing' | 'different'
export type InstallAction = 'available' | 'unavailable'

export interface HardwarePermissionsDiagnostic {
  hid: DeviceAccess
  serial: DeviceAccess
  rule: RuleStatus
  installAction: InstallAction
  manualCommand?: string
}

interface HidDevice {
  path?: string
}

interface SerialDevice {
  path: string
  vendorId?: string
  productId?: string
}

interface DiagnosticInputs {
  hidDevices: HidDevice[]
  serialDevices: SerialDevice[]
  canReadWrite: (path: string) => Promise<boolean>
  readInstalledRule: () => Promise<string | null>
  appImage: boolean
  pkexecAvailable: boolean
  installerAvailable: boolean
  officialVendorId: string
  officialProductId: string
  expectedRule: string
}

function usbIdMatches(value: string | undefined, expected: string): boolean {
  return value?.replace(/^0x/i, '').padStart(4, '0').toLowerCase() === expected
}

async function deviceAccess(
  paths: string[],
  canReadWrite: DiagnosticInputs['canReadWrite']
): Promise<DeviceAccess> {
  if (paths.length === 0) {
    return 'not-detected' as const
  }
  const access = await Promise.all(paths.map((path) => canReadWrite(path)))
  return access.some(Boolean) ? ('accessible' as const) : ('permission-denied' as const)
}

export async function buildHardwarePermissionsDiagnostic(
  inputs: DiagnosticInputs
): Promise<HardwarePermissionsDiagnostic> {
  const hidPaths = inputs.hidDevices.flatMap((device) =>
    typeof device.path === 'string' ? [device.path] : []
  )
  const serialPaths = inputs.serialDevices
    .filter(
      (device) =>
        usbIdMatches(device.vendorId, inputs.officialVendorId) &&
        usbIdMatches(device.productId, inputs.officialProductId)
    )
    .map((device) => device.path)
  const [hid, serial, installedRule] = await Promise.all([
    deviceAccess(hidPaths, inputs.canReadWrite),
    deviceAccess(serialPaths, inputs.canReadWrite),
    inputs.readInstalledRule()
  ])

  const installAction =
    inputs.appImage && inputs.pkexecAvailable && inputs.installerAvailable
      ? 'available'
      : 'unavailable'
  return {
    hid,
    serial,
    rule:
      installedRule === null
        ? 'missing'
        : installedRule === inputs.expectedRule
          ? 'installed'
          : 'different',
    installAction,
    ...(installAction === 'unavailable'
      ? { manualCommand: buildManualInstallCommand(inputs.expectedRule) }
      : {})
  }
}

export function buildManualInstallCommand(rule: string): string {
  const quotedLines = rule
    .trimEnd()
    .split('\n')
    .map((line) => `'${line.replaceAll("'", `'\\''`)}'`)
    .join(' ')
  return [
    `printf '%s\\n' ${quotedLines} | sudo tee /etc/udev/rules.d/70-streamdeck-deej.rules >/dev/null`,
    'sudo udevadm control --reload-rules',
    'sudo udevadm trigger --subsystem-match=hidraw',
    'sudo udevadm trigger --subsystem-match=tty'
  ].join(' && ')
}

function decodeMountField(value: string): string {
  return value.replace(/\\([0-7]{3})/g, (_, octal: string) =>
    String.fromCharCode(Number.parseInt(octal, 8))
  )
}

export function isReadOnlyAppImageMount(configuration: {
  isPackaged: boolean
  appImagePath?: string
  resourcesPath: string
  mountInfo: string
}): boolean {
  if (!configuration.isPackaged || !configuration.appImagePath?.startsWith('/')) {
    return false
  }

  return configuration.mountInfo.split('\n').some((line) => {
    const [mount, filesystem] = line.split(' - ')
    if (!mount || !filesystem) {
      return false
    }
    const fields = mount.split(' ')
    const mountPoint = decodeMountField(fields[4] ?? '')
    const options = (fields[5] ?? '').split(',')
    const filesystemType = filesystem.split(' ')[0]
    const containsResources =
      configuration.resourcesPath === mountPoint ||
      configuration.resourcesPath.startsWith(`${mountPoint}/`)
    return (
      containsResources &&
      options.includes('ro') &&
      (filesystemType === 'squashfs' || filesystemType.startsWith('fuse'))
    )
  })
}

interface InstallerConfiguration {
  appImage: boolean
  pkexecPath: string
  installerPath: string
}

type SpawnInstaller = (
  command: string,
  args: string[],
  options: { shell: false }
) => Promise<number | null>

export async function runPermissionInstaller(
  configuration: InstallerConfiguration,
  spawnInstaller: SpawnInstaller
): Promise<'installed' | 'cancelled' | 'failed'> {
  if (!configuration.appImage) {
    throw new Error('Privileged installation is available only from the packaged AppImage')
  }
  if (configuration.pkexecPath !== '/usr/bin/pkexec') {
    throw new Error('The fixed pkexec executable is unavailable')
  }

  const exitCode = await spawnInstaller(
    configuration.pkexecPath,
    [configuration.installerPath, 'install'],
    { shell: false }
  )
  if (exitCode === 0) {
    return 'installed'
  }
  if (exitCode === 126 || exitCode === 127) {
    return 'cancelled'
  }
  return 'failed'
}

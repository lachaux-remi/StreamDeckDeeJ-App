interface UsbPortIdentity {
  vendorId: string | undefined
  productId: string | undefined
}

export const OFFICIAL_VENDOR_ID = 0x5239
export const OFFICIAL_PRODUCT_ID = 0x0001

export function linuxUsbProductLink(
  platform: NodeJS.Platform,
  portPath: string
): string | undefined {
  if (platform !== 'linux' || !portPath.startsWith('/dev/')) {
    return undefined
  }
  const ttyName = portPath.slice('/dev/'.length)
  if (!ttyName || ttyName.includes('/')) {
    return undefined
  }
  return `/sys/class/tty/${ttyName}/device`
}

export function isOfficialFirmwarePort(port: UsbPortIdentity): boolean {
  return (
    parseHexIdentifier(port.vendorId) === OFFICIAL_VENDOR_ID &&
    parseHexIdentifier(port.productId) === OFFICIAL_PRODUCT_ID
  )
}

export function preferOfficialFirmwarePorts<T extends UsbPortIdentity>(ports: T[]): T[] {
  return [...ports].sort(
    (left, right) => Number(isOfficialFirmwarePort(right)) - Number(isOfficialFirmwarePort(left))
  )
}

function parseHexIdentifier(identifier: string | undefined): number | undefined {
  if (!identifier) {
    return undefined
  }
  const normalized = identifier.trim().replace(/^0x/i, '')
  if (!/^[0-9a-f]+$/i.test(normalized)) {
    return undefined
  }
  return Number.parseInt(normalized, 16)
}

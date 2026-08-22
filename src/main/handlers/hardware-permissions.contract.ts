export const HARDWARE_PERMISSIONS_CHANNELS = {
  diagnose: 'hardware-permissions:diagnose',
  install: 'hardware-permissions:install'
} as const

export function assertHardwarePermissionsRequest(args: unknown[]): void {
  if (args.length !== 0) {
    throw new Error('Hardware permission operations do not accept arguments')
  }
}

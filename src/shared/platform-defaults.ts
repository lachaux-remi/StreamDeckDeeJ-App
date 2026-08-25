export function defaultSerialPort(platform: string): string {
  return platform === 'win32' || platform === 'windows' ? '' : '/dev/ttyACM0'
}

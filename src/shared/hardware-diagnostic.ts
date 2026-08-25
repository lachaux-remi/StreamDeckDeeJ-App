export type HardwareDiagnostic =
  | {
      platform: 'linux'
      hid: 'accessible' | 'permission-denied' | 'not-detected'
      serial: 'accessible' | 'permission-denied' | 'not-detected'
      rule: 'installed' | 'missing' | 'different'
      installAction: 'available' | 'unavailable'
      manualCommand?: string
    }
  | {
      platform: 'windows'
      hid: 'detected' | 'not-detected'
      serial: 'detected' | 'not-detected'
    }

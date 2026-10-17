import { chmodSync, readFileSync, writeFileSync } from 'node:fs'

const SECURE_LINUX_BACKENDS = new Set(['gnome_libsecret', 'kwallet', 'kwallet5', 'kwallet6'])

interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean
  getSelectedStorageBackend(): string
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

interface EncryptedSecret {
  type: 'electron-safe-storage'
  data: string
}

type StoredSecret = string | EncryptedSecret

/** The keyring could not decrypt a stored secret, e.g. because it is still locked. */
export class SecretUnavailableError extends Error {
  constructor() {
    super('Stored secret is unavailable')
  }
}

export interface SecretCodec {
  encode(value: string): StoredSecret
  decode(value: unknown): string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isEncryptedSecret(value: unknown): value is EncryptedSecret {
  return (
    isRecord(value) &&
    Object.keys(value).length === 2 &&
    value.type === 'electron-safe-storage' &&
    typeof value.data === 'string'
  )
}

export class ElectronSafeStorageSecretCodec implements SecretCodec {
  private readonly safeStorage: SafeStorageAdapter
  private readonly onEncryptionFallback: () => void

  constructor(safeStorage: SafeStorageAdapter, onEncryptionFallback: () => void = () => {}) {
    this.safeStorage = safeStorage
    this.onEncryptionFallback = onEncryptionFallback
  }

  public encode(value: string): StoredSecret {
    if (!value || !this.hasSecureBackend()) {
      return value
    }

    try {
      return {
        type: 'electron-safe-storage',
        data: this.safeStorage.encryptString(value).toString('base64')
      }
    } catch {
      this.onEncryptionFallback()
      return value
    }
  }

  public usesSecureBackend(): boolean {
    return this.hasSecureBackend()
  }

  public storageBackend(): string {
    try {
      return this.safeStorage.getSelectedStorageBackend()
    } catch {
      return 'unknown'
    }
  }

  public decode(value: unknown): string {
    if (typeof value === 'string') {
      return value
    }
    if (!isEncryptedSecret(value)) {
      throw new Error('Stored secret is invalid')
    }

    try {
      return this.safeStorage.decryptString(Buffer.from(value.data, 'base64'))
    } catch {
      throw new SecretUnavailableError()
    }
  }

  private hasSecureBackend(): boolean {
    try {
      return (
        this.safeStorage.isEncryptionAvailable() &&
        SECURE_LINUX_BACKENDS.has(this.safeStorage.getSelectedStorageBackend())
      )
    } catch {
      return false
    }
  }
}

const SECRET_PATHS = [
  ['homeAssistant', 'token'],
  ['discord', 'clientSecret'],
  ['discord', 'accessToken'],
  ['discord', 'refreshToken']
] as const

type SecretPath = (typeof SECRET_PATHS)[number]

export class SettingsPersistence {
  private readonly path: string
  private readonly secretCodec: SecretCodec
  /**
   * Stored values of secrets the keyring could not decrypt at load. They are
   * loaded as empty strings and written back unchanged until a new value replaces
   * them, so a locked keyring never costs the rest of the config or the secrets.
   */
  private unavailableSecrets = new Map<string, StoredSecret>()

  constructor(path: string, secretCodec: SecretCodec) {
    this.path = path
    this.secretCodec = secretCodec
  }

  public load(): unknown {
    const storedSettings = JSON.parse(readFileSync(this.path, 'utf8'))
    const migratedSettings = this.removeLegacyBrightnessState(storedSettings)
    const unavailableSecrets = new Map<string, StoredSecret>()
    const settings = this.transformSecrets(migratedSettings, (value, key) => {
      try {
        return this.secretCodec.decode(value)
      } catch (error) {
        if (!(error instanceof SecretUnavailableError)) {
          throw error
        }
        unavailableSecrets.set(key, value as StoredSecret)
        return ''
      }
    })
    this.unavailableSecrets = unavailableSecrets
    return settings
  }

  public hasUnavailableSecrets(): boolean {
    return this.unavailableSecrets.size > 0
  }

  public save(settings: unknown): void {
    const replacedSecrets = new Set<string>()
    const storedSettings = this.transformSecrets(settings, (value, key) => {
      if (typeof value !== 'string') {
        throw new Error('Secret value is invalid')
      }
      const unavailable = this.unavailableSecrets.get(key)
      if (unavailable !== undefined && value === '') {
        return unavailable
      }
      replacedSecrets.add(key)
      return this.secretCodec.encode(value)
    })
    writeFileSync(
      this.path,
      JSON.stringify(this.restoreUnavailableSecrets(storedSettings, replacedSecrets), null, 2),
      { encoding: 'utf8', mode: 0o600 }
    )
    chmodSync(this.path, 0o600)
    for (const key of replacedSecrets) {
      this.unavailableSecrets.delete(key)
    }
  }

  public protectFile(): void {
    chmodSync(this.path, 0o600)
  }

  private removeLegacyBrightnessState(settings: unknown): unknown {
    if (!isRecord(settings) || !('brightnessState' in settings)) {
      return settings
    }

    const migratedSettings = { ...settings }
    delete migratedSettings.brightnessState
    return migratedSettings
  }

  /** Puts back unavailable secrets whose field was removed rather than replaced. */
  private restoreUnavailableSecrets(settings: unknown, replacedSecrets: Set<string>): unknown {
    if (!isRecord(settings) || this.unavailableSecrets.size === 0) {
      return settings
    }

    const restored = { ...settings }
    for (const path of SECRET_PATHS) {
      const [section, field] = path
      const key = secretKey(path)
      const unavailable = this.unavailableSecrets.get(key)
      if (unavailable === undefined || replacedSecrets.has(key)) {
        continue
      }
      const current = isRecord(restored[section]) ? restored[section] : {}
      if (current[field] === undefined) {
        restored[section] = { ...current, [field]: unavailable }
      }
    }
    return restored
  }

  private transformSecrets(
    settings: unknown,
    transform: (value: unknown, key: string) => StoredSecret
  ): unknown {
    if (!isRecord(settings)) {
      return settings
    }

    const transformed = { ...settings }
    for (const path of SECRET_PATHS) {
      const [section, field] = path
      const sectionValue = transformed[section]
      if (isRecord(sectionValue) && field in sectionValue && sectionValue[field] !== undefined) {
        transformed[section] = {
          ...sectionValue,
          [field]: transform(sectionValue[field], secretKey(path))
        }
      }
    }
    return transformed
  }
}

function secretKey(path: SecretPath): string {
  return path.join('.')
}

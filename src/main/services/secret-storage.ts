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
    if (!value || !this.hasSecureBackend()) return value

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

  public decode(value: unknown): string {
    if (typeof value === 'string') return value
    if (!isEncryptedSecret(value)) throw new Error('Stored secret is invalid')

    try {
      return this.safeStorage.decryptString(Buffer.from(value.data, 'base64'))
    } catch {
      throw new Error('Stored secret is unavailable')
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

export class SettingsPersistence {
  private readonly path: string
  private readonly secretCodec: SecretCodec

  constructor(path: string, secretCodec: SecretCodec) {
    this.path = path
    this.secretCodec = secretCodec
  }

  public load(): unknown {
    return this.transformSecrets(JSON.parse(readFileSync(this.path, 'utf8')), (value) =>
      this.secretCodec.decode(value)
    )
  }

  public save(settings: unknown): void {
    const storedSettings = this.transformSecrets(settings, (value) => {
      if (typeof value !== 'string') throw new Error('Secret value is invalid')
      return this.secretCodec.encode(value)
    })
    writeFileSync(this.path, JSON.stringify(storedSettings, null, 2), {
      encoding: 'utf8',
      mode: 0o600
    })
    chmodSync(this.path, 0o600)
  }

  public protectFile(): void {
    chmodSync(this.path, 0o600)
  }

  private transformSecrets(
    settings: unknown,
    transform: (value: unknown) => StoredSecret
  ): unknown {
    if (!isRecord(settings)) return settings

    const transformed = { ...settings }
    if (isRecord(settings.homeAssistant) && 'token' in settings.homeAssistant) {
      transformed.homeAssistant = {
        ...settings.homeAssistant,
        token: transform(settings.homeAssistant.token)
      }
    }
    if (isRecord(settings.discord)) {
      const discord = { ...settings.discord }
      for (const key of ['clientSecret', 'accessToken', 'refreshToken']) {
        if (key in settings.discord && settings.discord[key] !== undefined) {
          discord[key] = transform(settings.discord[key])
        }
      }
      transformed.discord = discord
    }
    return transformed
  }
}

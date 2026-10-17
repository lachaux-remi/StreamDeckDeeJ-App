import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { ElectronSafeStorageSecretCodec, SettingsPersistence } from '@main/services/secret-storage'

const fixtureSecret = 'synthetic-fixture-value'

type Backend = 'basic_text' | 'gnome_libsecret'

interface FakeSafeStorage {
  isEncryptionAvailable(): boolean
  getSelectedStorageBackend(): Backend
  encryptString(value: string): Buffer
  decryptString(value: Buffer): string
}

interface FixtureSettings {
  homeAssistant: { url: string; token: string }
  discord: {
    clientId: string
    clientSecret: string
    accessToken: string
    refreshToken: string
  }
}

function safeStorage(backend: Backend = 'gnome_libsecret'): FakeSafeStorage {
  return {
    isEncryptionAvailable: () => true,
    getSelectedStorageBackend: () => backend,
    encryptString: (value: string) => Buffer.from(`protected:${value}`),
    decryptString: (value: Buffer) => value.toString().replace(/^protected:/, '')
  }
}

function settings(secret = fixtureSecret): FixtureSettings {
  return {
    homeAssistant: { url: 'https://example.invalid', token: secret },
    discord: {
      clientId: 'fixture-client',
      clientSecret: secret,
      accessToken: secret,
      refreshToken: secret
    }
  }
}

test('migrates plaintext secrets to safeStorage envelopes on the next save', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'settings-')), 'config.json')
  const persistence = new SettingsPersistence(
    path,
    new ElectronSafeStorageSecretCodec(safeStorage())
  )
  writeFileSync(path, JSON.stringify(settings()), { mode: 0o600 })

  const loaded = persistence.load()
  expect(loaded).toEqual(settings())
  persistence.save(loaded)

  const stored = readFileSync(path, 'utf8')
  expect(stored).not.toMatch(new RegExp(fixtureSecret))
  expect(stored).toMatch(/"type": "electron-safe-storage"/)
  expect(persistence.load()).toEqual(settings())
})

test('does not describe basic_text as encryption and falls back to mode 0600 plaintext', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'settings-')), 'config.json')
  const persistence = new SettingsPersistence(
    path,
    new ElectronSafeStorageSecretCodec(safeStorage('basic_text'))
  )
  expect(new ElectronSafeStorageSecretCodec(safeStorage('basic_text')).usesSecureBackend()).toBe(
    false
  )

  persistence.save(settings())

  if (process.platform !== 'win32') {
    expect(statSync(path).mode & 0o777).toBe(0o600)
  }
  expect(JSON.parse(readFileSync(path, 'utf8')).homeAssistant.token).toBe(fixtureSecret)
  expect(persistence.load()).toEqual(settings())
})

test('falls back without losing secrets when safeStorage encryption throws', () => {
  const adapter = safeStorage()
  adapter.encryptString = () => {
    throw new Error('fixture failure')
  }
  const path = join(mkdtempSync(join(tmpdir(), 'settings-')), 'config.json')
  let fallbackReported = false
  const persistence = new SettingsPersistence(
    path,
    new ElectronSafeStorageSecretCodec(adapter, () => {
      fallbackReported = true
    })
  )

  persistence.save(settings())

  expect(fallbackReported).toBe(true)
  expect(persistence.load()).toEqual(settings())
})

test('treats unavailable or failing safeStorage backends as insecure', () => {
  const unavailable = safeStorage()
  unavailable.isEncryptionAvailable = () => false
  expect(new ElectronSafeStorageSecretCodec(unavailable).usesSecureBackend()).toBe(false)

  const failing = safeStorage()
  failing.isEncryptionAvailable = () => {
    throw new Error('backend unavailable')
  }
  expect(new ElectronSafeStorageSecretCodec(failing).usesSecureBackend()).toBe(false)
})

test('reports the selected storage backend, or unknown when it cannot be read', () => {
  expect(new ElectronSafeStorageSecretCodec(safeStorage()).storageBackend()).toBe('gnome_libsecret')

  const failing = safeStorage()
  failing.getSelectedStorageBackend = () => {
    throw new Error('app not ready')
  }
  expect(new ElectronSafeStorageSecretCodec(failing).storageBackend()).toBe('unknown')
})

test('rejects non-string secret values when saving', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'settings-')), 'config.json')
  const persistence = new SettingsPersistence(
    path,
    new ElectronSafeStorageSecretCodec(safeStorage())
  )
  const invalid = settings()
  const invalidHomeAssistant = invalid.homeAssistant as unknown as { token: unknown }
  invalidHomeAssistant.token = 42

  expect(() => persistence.save(invalid)).toThrow('Secret value is invalid')
})

test('passes through non-object settings and removes legacy brightness state', () => {
  const directory = mkdtempSync(join(tmpdir(), 'settings-'))
  const codec = new ElectronSafeStorageSecretCodec(safeStorage())
  const primitivePath = join(directory, 'primitive.json')
  writeFileSync(primitivePath, 'null')
  expect(new SettingsPersistence(primitivePath, codec).load()).toBeNull()

  const legacyPath = join(directory, 'legacy.json')
  writeFileSync(legacyPath, JSON.stringify({ brightnessState: true, retained: 1 }))
  expect(new SettingsPersistence(legacyPath, codec).load()).toEqual({ retained: 1 })
})

test('rejects malformed and undecryptable encrypted values without exposing their contents', () => {
  const codec = new ElectronSafeStorageSecretCodec(safeStorage())
  const malformed = { type: 'electron-safe-storage', data: 42 }
  expect(() => codec.decode(malformed)).toThrow('Stored secret is invalid')

  const adapter = safeStorage()
  adapter.decryptString = () => {
    throw new Error(fixtureSecret)
  }
  const failingCodec = new ElectronSafeStorageSecretCodec(adapter)
  expect(() =>
    failingCodec.decode({ type: 'electron-safe-storage', data: 'not-sensitive' })
  ).toThrow('Stored secret is unavailable')
})

test('leaves corrupt and undecryptable config files unchanged', () => {
  const directory = mkdtempSync(join(tmpdir(), 'settings-'))
  const malformedPath = join(directory, 'malformed.json')
  const malformed = '{not-json'
  writeFileSync(malformedPath, malformed, { mode: 0o644 })
  const codec = new ElectronSafeStorageSecretCodec(safeStorage())
  const malformedPersistence = new SettingsPersistence(malformedPath, codec)
  expect(() => malformedPersistence.load()).toThrow()
  malformedPersistence.protectFile()
  expect(readFileSync(malformedPath, 'utf8')).toBe(malformed)
  if (process.platform !== 'win32') {
    expect(statSync(malformedPath).mode & 0o777).toBe(0o600)
  }
})

function lockedKeyring(): FakeSafeStorage {
  const adapter = safeStorage()
  adapter.decryptString = () => {
    throw new Error(fixtureSecret)
  }
  return adapter
}

const lockedCiphertext = { type: 'electron-safe-storage', data: 'fixture-ciphertext' }

test('loads the rest of the config when the keyring cannot decrypt secrets', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'settings-')), 'config.json')
  const stored = JSON.stringify({
    retained: 1,
    homeAssistant: { url: 'https://example.invalid', token: lockedCiphertext },
    discord: { clientId: 'fixture-client', clientSecret: lockedCiphertext }
  })
  writeFileSync(path, stored, { mode: 0o600 })
  const persistence = new SettingsPersistence(
    path,
    new ElectronSafeStorageSecretCodec(lockedKeyring())
  )

  expect(persistence.load()).toEqual({
    retained: 1,
    homeAssistant: { url: 'https://example.invalid', token: '' },
    discord: { clientId: 'fixture-client', clientSecret: '' }
  })
  expect(persistence.hasUnavailableSecrets()).toBe(true)
  expect(readFileSync(path, 'utf8')).toBe(stored)
})

test('keeps undecryptable secrets on save until a new value replaces them', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'settings-')), 'config.json')
  writeFileSync(
    path,
    JSON.stringify({
      homeAssistant: { url: 'https://example.invalid', token: lockedCiphertext },
      discord: {
        clientId: 'fixture-client',
        clientSecret: lockedCiphertext,
        accessToken: lockedCiphertext
      }
    }),
    { mode: 0o600 }
  )
  const persistence = new SettingsPersistence(
    path,
    new ElectronSafeStorageSecretCodec(lockedKeyring())
  )
  persistence.load()

  persistence.save({
    homeAssistant: { url: 'https://changed.invalid', token: '' },
    discord: undefined
  })
  expect(JSON.parse(readFileSync(path, 'utf8'))).toEqual({
    homeAssistant: { url: 'https://changed.invalid', token: lockedCiphertext },
    discord: { clientSecret: lockedCiphertext, accessToken: lockedCiphertext }
  })

  persistence.save({
    homeAssistant: { url: 'https://changed.invalid', token: fixtureSecret },
    discord: { clientId: 'fixture-client', clientSecret: '', accessToken: undefined }
  })
  const replaced = JSON.parse(readFileSync(path, 'utf8'))
  expect(replaced.homeAssistant.token).toEqual({
    type: 'electron-safe-storage',
    data: Buffer.from(`protected:${fixtureSecret}`).toString('base64')
  })
  expect(replaced.discord).toEqual({
    clientId: 'fixture-client',
    clientSecret: lockedCiphertext,
    accessToken: lockedCiphertext
  })
  expect(persistence.hasUnavailableSecrets()).toBe(true)
})

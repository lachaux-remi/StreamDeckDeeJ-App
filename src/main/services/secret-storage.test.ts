import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { ElectronSafeStorageSecretCodec, SettingsPersistence } from './secret-storage.ts'

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
  assert.deepEqual(loaded, settings())
  persistence.save(loaded)

  const stored = readFileSync(path, 'utf8')
  assert.doesNotMatch(stored, new RegExp(fixtureSecret))
  assert.match(stored, /"type": "electron-safe-storage"/)
  assert.deepEqual(persistence.load(), settings())
})

test('does not describe basic_text as encryption and falls back to mode 0600 plaintext', () => {
  const path = join(mkdtempSync(join(tmpdir(), 'settings-')), 'config.json')
  const persistence = new SettingsPersistence(
    path,
    new ElectronSafeStorageSecretCodec(safeStorage('basic_text'))
  )
  assert.equal(
    new ElectronSafeStorageSecretCodec(safeStorage('basic_text')).usesSecureBackend(),
    false
  )

  persistence.save(settings())

  assert.equal(statSync(path).mode & 0o777, 0o600)
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).homeAssistant.token, fixtureSecret)
  assert.deepEqual(persistence.load(), settings())
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

  assert.equal(fallbackReported, true)
  assert.deepEqual(persistence.load(), settings())
})

test('rejects malformed and undecryptable encrypted values without exposing their contents', () => {
  const codec = new ElectronSafeStorageSecretCodec(safeStorage())
  const malformed = { type: 'electron-safe-storage', data: 42 }
  assert.throws(() => codec.decode(malformed), { message: 'Stored secret is invalid' })

  const adapter = safeStorage()
  adapter.decryptString = () => {
    throw new Error(fixtureSecret)
  }
  const failingCodec = new ElectronSafeStorageSecretCodec(adapter)
  assert.throws(
    () => failingCodec.decode({ type: 'electron-safe-storage', data: 'not-sensitive' }),
    { message: 'Stored secret is unavailable' }
  )
})

test('leaves corrupt and undecryptable config files unchanged', () => {
  const directory = mkdtempSync(join(tmpdir(), 'settings-'))
  const malformedPath = join(directory, 'malformed.json')
  const malformed = '{not-json'
  writeFileSync(malformedPath, malformed, { mode: 0o644 })
  const codec = new ElectronSafeStorageSecretCodec(safeStorage())
  const malformedPersistence = new SettingsPersistence(malformedPath, codec)
  assert.throws(() => malformedPersistence.load())
  malformedPersistence.protectFile()
  assert.equal(readFileSync(malformedPath, 'utf8'), malformed)
  assert.equal(statSync(malformedPath).mode & 0o777, 0o600)

  const unavailablePath = join(directory, 'unavailable.json')
  const unavailable = JSON.stringify({
    homeAssistant: {
      token: { type: 'electron-safe-storage', data: 'fixture-ciphertext' }
    }
  })
  writeFileSync(unavailablePath, unavailable, { mode: 0o600 })
  const adapter = safeStorage()
  adapter.decryptString = () => {
    throw new Error(fixtureSecret)
  }
  assert.throws(() =>
    new SettingsPersistence(unavailablePath, new ElectronSafeStorageSecretCodec(adapter)).load()
  )
  assert.equal(readFileSync(unavailablePath, 'utf8'), unavailable)
})

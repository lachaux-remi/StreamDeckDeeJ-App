import { createHash, createPublicKey, generateKeyPairSync } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, expect, test } from 'vitest'
import {
  UPDATE_KEY_ID,
  UPDATE_MANIFEST_NAME,
  UPDATE_PUBLIC_KEY,
  encryptedEd25519PrivateKey,
  verifySignedReleaseDirectory,
  writeSignedUpdateManifest
} from '../scripts/update-signing.mjs'
import { TRUSTED_UPDATE_KEYS } from '@main/services/signed-update'

const temporaryDirectories: string[] = []
const version = '4.1.0'
const commit = '0123456789abcdef0123456789abcdef01234567'

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

async function releaseDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'release-signing-'))
  temporaryDirectories.push(directory)
  await Promise.all([
    writeFile(join(directory, `streamdeck-deej-${version}.AppImage`), 'appimage'),
    writeFile(join(directory, `streamdeck-deej-${version}.pkg.tar.xz`), 'pacman'),
    writeFile(join(directory, 'latest-linux.yml'), 'version: 4.1.0\n')
  ])
  return directory
}

test('keeps the signer key ID and public key synchronized with the application trust store', () => {
  expect(TRUSTED_UPDATE_KEYS[UPDATE_KEY_ID]).toBe(UPDATE_PUBLIC_KEY)
  const fingerprint = createHash('sha256')
    .update(createPublicKey(UPDATE_PUBLIC_KEY).export({ type: 'spki', format: 'der' }))
    .digest('hex')
  expect(UPDATE_KEY_ID.endsWith(fingerprint.slice(0, 8))).toBe(true)
})

test('creates and verifies a canonical manifest with an encrypted PKCS#8 Ed25519 key', async () => {
  const directory = await releaseDirectory()
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const passphrase = 'test-only passphrase'
  const encryptedPrivateKey = privateKey
    .export({
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase
    })
    .toString()
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

  await writeSignedUpdateManifest(
    directory,
    version,
    commit,
    encryptedPrivateKey,
    passphrase,
    publicKeyPem,
    'test-key'
  )
  await expect(
    verifySignedReleaseDirectory(directory, version, commit, { 'test-key': publicKeyPem })
  ).resolves.toBeUndefined()

  const manifestText = await readFile(join(directory, UPDATE_MANIFEST_NAME), 'utf8')
  expect(manifestText.endsWith('\n')).toBe(true)
  expect(manifestText).not.toContain('\n  ')
  expect(JSON.parse(manifestText)).toEqual(
    expect.objectContaining({
      schemaVersion: 1,
      version,
      releaseCommit: commit,
      keyId: 'test-key'
    })
  )
})

test('rejects unencrypted keys and incorrect passphrases without writing secret material', () => {
  const { privateKey } = generateKeyPairSync('ed25519')
  const unencrypted = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString()
  expect(() => encryptedEd25519PrivateKey(unencrypted, 'passphrase')).toThrow(/ENCRYPTED/)

  const encrypted = privateKey
    .export({
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase: 'correct'
    })
    .toString()
  expect(() => encryptedEd25519PrivateKey(encrypted, 'incorrect')).toThrow()
})

test('detects a release artifact altered after manifest signing', async () => {
  const directory = await releaseDirectory()
  const { privateKey, publicKey } = generateKeyPairSync('ed25519')
  const passphrase = 'test-only passphrase'
  const encryptedPrivateKey = privateKey
    .export({
      type: 'pkcs8',
      format: 'pem',
      cipher: 'aes-256-cbc',
      passphrase
    })
    .toString()
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
  await writeSignedUpdateManifest(
    directory,
    version,
    commit,
    encryptedPrivateKey,
    passphrase,
    publicKeyPem,
    'test-key'
  )

  await writeFile(join(directory, `streamdeck-deej-${version}.AppImage`), 'tampered')
  await expect(
    verifySignedReleaseDirectory(directory, version, commit, { 'test-key': publicKeyPem })
  ).rejects.toThrow(/SHA-512/)
})

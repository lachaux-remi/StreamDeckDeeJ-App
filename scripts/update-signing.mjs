/* eslint-disable @typescript-eslint/explicit-function-return-type */
import assert from 'node:assert/strict'
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as ed25519Sign,
  verify as ed25519Verify
} from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const UPDATE_KEY_ID = 'ed25519-2026-f259170f'
export const UPDATE_MANIFEST_NAME = 'update-manifest-v1.json'
export const UPDATE_SIGNATURE_NAME = 'update-manifest-v1.sig'
export const UPDATE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAk2JDC7gjc/OWs/mQqeexlFuIlx4rXaHBwXcdWFO0/ak=
-----END PUBLIC KEY-----`

function canonicalManifest(manifest) {
  return `${JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
    releaseCommit: manifest.releaseCommit,
    keyId: manifest.keyId,
    artifacts: manifest.artifacts.map(({ name, size, sha512 }) => ({ name, size, sha512 }))
  })}\n`
}

async function sha512(path) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha512')
    createReadStream(path)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('base64')))
  })
}

export async function createUpdateManifest(
  directory,
  version,
  releaseCommit,
  keyId = UPDATE_KEY_ID
) {
  assert.match(version, /^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/)
  assert.match(releaseCommit, /^[0-9a-f]{40}$/)
  assert.match(keyId, /^[a-z0-9][a-z0-9-]{2,63}$/)
  const names = await readdir(directory)
  const expectedNames = [
    `streamdeck-deej-${version}.AppImage`,
    `streamdeck-deej-${version}.pkg.tar.xz`,
    'latest-linux.yml'
  ]
  const windowsNames = [
    `streamdeck-deej-${version}-windows-x64.exe`,
    `streamdeck-deej-${version}-windows-x64.exe.blockmap`,
    'latest.yml'
  ]
  const windowsArtifactCount = windowsNames.filter((name) => names.includes(name)).length
  assert.ok(
    windowsArtifactCount === 0 || windowsArtifactCount === windowsNames.length,
    'Windows release artifacts must be supplied as setup, blockmap, and latest.yml together'
  )
  if (windowsArtifactCount > 0) {
    expectedNames.push(...windowsNames)
  }
  const blockmapName = `streamdeck-deej-${version}.AppImage.blockmap`
  if (names.includes(blockmapName)) {
    expectedNames.push(blockmapName)
  }
  expectedNames.sort()

  const artifacts = []
  for (const name of expectedNames) {
    assert.equal(basename(name), name)
    const details = await stat(join(directory, name))
    assert.ok(details.isFile() && details.size > 0, `${name} must be a non-empty regular file`)
    artifacts.push({ name, size: details.size, sha512: await sha512(join(directory, name)) })
  }
  return {
    schemaVersion: 1,
    version,
    releaseCommit,
    keyId,
    artifacts
  }
}

export function encryptedEd25519PrivateKey(privateKeyPem, passphrase) {
  assert.match(privateKeyPem, /^-----BEGIN ENCRYPTED PRIVATE KEY-----\n/)
  assert.ok(passphrase, 'UPDATE_SIGNING_KEY_PASSPHRASE must not be empty')
  const privateKey = createPrivateKey({ key: privateKeyPem, format: 'pem', passphrase })
  assert.equal(privateKey.asymmetricKeyType, 'ed25519', 'Signing key must be Ed25519')
  return privateKey
}

export async function writeSignedUpdateManifest(
  directory,
  version,
  releaseCommit,
  privateKeyPem,
  passphrase,
  expectedPublicKey = UPDATE_PUBLIC_KEY,
  keyId = UPDATE_KEY_ID
) {
  const privateKey = encryptedEd25519PrivateKey(privateKeyPem, passphrase)
  const derivedPublicKey = createPublicKey(privateKey)
    .export({ type: 'spki', format: 'pem' })
    .trim()
  assert.equal(
    derivedPublicKey,
    createPublicKey(expectedPublicKey).export({ type: 'spki', format: 'pem' }).trim(),
    'Signing key does not match the configured trusted public key'
  )
  const manifest = await createUpdateManifest(directory, version, releaseCommit, keyId)
  const manifestBytes = Buffer.from(canonicalManifest(manifest), 'utf8')
  const signature = ed25519Sign(null, manifestBytes, privateKey)
  await writeFile(join(directory, UPDATE_MANIFEST_NAME), manifestBytes, { mode: 0o644 })
  await writeFile(join(directory, UPDATE_SIGNATURE_NAME), `${signature.toString('base64')}\n`, {
    mode: 0o644
  })
}

export async function verifySignedReleaseDirectory(
  directory,
  expectedVersion,
  expectedCommit,
  trustedKeys = { [UPDATE_KEY_ID]: UPDATE_PUBLIC_KEY }
) {
  const manifestBytes = await readFile(join(directory, UPDATE_MANIFEST_NAME))
  const signatureText = await readFile(join(directory, UPDATE_SIGNATURE_NAME), 'utf8')
  assert.match(signatureText, /^[A-Za-z0-9+/]{86}==\n$/)
  const manifest = JSON.parse(manifestBytes.toString('utf8'))
  assert.equal(
    canonicalManifest(manifest),
    manifestBytes.toString('utf8'),
    'Manifest is not canonical'
  )
  assert.equal(manifest.schemaVersion, 1)
  assert.equal(manifest.version, expectedVersion)
  assert.equal(manifest.releaseCommit, expectedCommit)
  assert.ok(trustedKeys[manifest.keyId], `Untrusted update key ID: ${manifest.keyId}`)
  assert.equal(
    ed25519Verify(
      null,
      manifestBytes,
      createPublicKey(trustedKeys[manifest.keyId]),
      Buffer.from(signatureText.trim(), 'base64')
    ),
    true,
    'Manifest signature is invalid'
  )
  assert.ok(Array.isArray(manifest.artifacts) && manifest.artifacts.length > 0)
  assert.deepEqual(
    manifest.artifacts.map(({ name }) => name),
    manifest.artifacts.map(({ name }) => name).sort(),
    'Manifest artifacts are not sorted'
  )
  for (const artifact of manifest.artifacts) {
    assert.equal(basename(artifact.name), artifact.name)
    const details = await stat(join(directory, artifact.name))
    assert.equal(details.size, artifact.size, `${artifact.name} size differs from manifest`)
    assert.equal(
      await sha512(join(directory, artifact.name)),
      artifact.sha512,
      `${artifact.name} SHA-512 differs from manifest`
    )
  }
}

async function main() {
  const [command, directory, version, releaseCommit] = process.argv.slice(2)
  if (!['sign', 'verify'].includes(command) || !directory || !version || !releaseCommit) {
    throw new Error(
      'Usage: update-signing.mjs <sign|verify> <directory> <version> <release-commit>'
    )
  }
  if (command === 'sign') {
    const privateKeyPem = process.env.UPDATE_SIGNING_PRIVATE_KEY
    const passphrase = process.env.UPDATE_SIGNING_KEY_PASSPHRASE
    assert.ok(privateKeyPem, 'UPDATE_SIGNING_PRIVATE_KEY is required')
    assert.ok(passphrase, 'UPDATE_SIGNING_KEY_PASSPHRASE is required')
    await writeSignedUpdateManifest(directory, version, releaseCommit, privateKeyPem, passphrase)
  }
  await verifySignedReleaseDirectory(directory, version, releaseCommit)
  console.log(`Verified signed update manifest for ${version} at ${releaseCommit}`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await main()
}

import { createHash, generateKeyPairSync, sign } from 'node:crypto'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, test } from 'vitest'
import {
  canonicalUpdateManifest,
  fetchSignedUpdateManifest,
  parseAndVerifyUpdateManifest,
  requireSignedAppImage,
  verifyDownloadedUpdateArtifact,
  type SignedUpdateManifest
} from '@main/services/signed-update'

const temporaryDirectories: string[] = []
const releaseCommit = '0123456789abcdef0123456789abcdef01234567'

function keyPair(): ReturnType<typeof generateKeyPairSync> {
  return generateKeyPairSync('ed25519')
}

function signedManifest(overrides: Partial<SignedUpdateManifest> = {}): ReturnType<
  typeof keyPair
> & {
  manifest: SignedUpdateManifest
  bytes: Buffer
  signature: Buffer
} {
  const keys = keyPair()
  const artifactBytes = Buffer.from('verified AppImage')
  const manifest: SignedUpdateManifest = {
    schemaVersion: 1,
    version: '4.1.0',
    releaseCommit,
    keyId: 'test-key',
    artifacts: [
      {
        name: 'streamdeck-deej-4.1.0.AppImage',
        size: artifactBytes.length,
        sha512: createHash('sha512').update(artifactBytes).digest('base64')
      }
    ],
    ...overrides
  }
  const bytes = Buffer.from(canonicalUpdateManifest(manifest))
  return { ...keys, manifest, bytes, signature: sign(null, bytes, keys.privateKey) }
}

function signatureAsset(signature: Buffer): Buffer {
  return Buffer.from(`${signature.toString('base64')}\n`)
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

test('accepts a canonical Ed25519-signed manifest and matching updater metadata', () => {
  const fixture = signedManifest()
  const manifest = parseAndVerifyUpdateManifest(fixture.bytes, signatureAsset(fixture.signature), {
    'test-key': fixture.publicKey.export({ type: 'spki', format: 'pem' }).toString()
  })

  expect(manifest).toEqual(fixture.manifest)
  expect(
    requireSignedAppImage(manifest, {
      version: manifest.version,
      files: manifest.artifacts.map((artifact) => ({
        url: artifact.name,
        size: artifact.size,
        sha512: artifact.sha512
      }))
    })
  ).toEqual(manifest.artifacts[0])
})

describe('fails closed for untrusted or altered manifests', () => {
  test('rejects an absent signature', () => {
    const fixture = signedManifest()
    expect(() => parseAndVerifyUpdateManifest(fixture.bytes, undefined, {})).toThrow(/missing/)
  })

  test('rejects altered manifest and signature bytes', () => {
    const fixture = signedManifest()
    const keys = {
      'test-key': fixture.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    }
    const alteredManifest = Buffer.from(fixture.bytes)
    alteredManifest[alteredManifest.indexOf('4.1.0')] = '5'.charCodeAt(0)
    expect(() =>
      parseAndVerifyUpdateManifest(alteredManifest, signatureAsset(fixture.signature), keys)
    ).toThrow(/signature/)

    const alteredSignature = Buffer.from(fixture.signature)
    alteredSignature[0] ^= 1
    expect(() =>
      parseAndVerifyUpdateManifest(fixture.bytes, signatureAsset(alteredSignature), keys)
    ).toThrow(/signature/)
  })

  test('rejects a wrong key and an unknown signed key ID', () => {
    const fixture = signedManifest()
    const wrong = keyPair()
    expect(() =>
      parseAndVerifyUpdateManifest(fixture.bytes, signatureAsset(fixture.signature), {
        'test-key': wrong.publicKey.export({ type: 'spki', format: 'pem' }).toString()
      })
    ).toThrow(/signature/)

    expect(() =>
      parseAndVerifyUpdateManifest(fixture.bytes, signatureAsset(fixture.signature), {
        'different-key': fixture.publicKey.export({ type: 'spki', format: 'pem' }).toString()
      })
    ).toThrow(/key ID/)
  })

  test('rejects non-canonical and invalid metadata', () => {
    const fixture = signedManifest()
    const publicKey = fixture.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const nonCanonical = Buffer.from(JSON.stringify(fixture.manifest, null, 2))
    expect(() =>
      parseAndVerifyUpdateManifest(
        nonCanonical,
        signatureAsset(sign(null, nonCanonical, fixture.privateKey)),
        {
          'test-key': publicKey
        }
      )
    ).toThrow(/canonical/)

    const invalid = signedManifest({ releaseCommit: '../not-a-commit' })
    expect(() =>
      parseAndVerifyUpdateManifest(invalid.bytes, signatureAsset(invalid.signature), {
        'test-key': invalid.publicKey.export({ type: 'spki', format: 'pem' }).toString()
      })
    ).toThrow(/metadata/)
  })

  test('rejects updater metadata that differs from the signed artifact', () => {
    const fixture = signedManifest()
    expect(() =>
      requireSignedAppImage(fixture.manifest, {
        version: '4.1.0',
        files: [
          {
            url: fixture.manifest.artifacts[0].name,
            size: fixture.manifest.artifacts[0].size + 1,
            sha512: fixture.manifest.artifacts[0].sha512
          }
        ]
      })
    ).toThrow(/does not match/)
  })
})

test('fetches both fixed release assets and rejects a missing signature asset', async () => {
  const fixture = signedManifest()
  const urls: string[] = []
  const fetcher = async (url: string): Promise<Response> => {
    urls.push(url)
    return url.endsWith('.sig')
      ? new Response(null, { status: 404 })
      : new Response(fixture.bytes.toString('utf8'))
  }
  await expect(
    fetchSignedUpdateManifest('4.1.0', fetcher, {
      'test-key': fixture.publicKey.export({ type: 'spki', format: 'pem' }).toString()
    })
  ).rejects.toThrow(/signature.*404/i)
  expect(urls).toEqual([
    'https://github.com/lachaux-remi/StreamDeckDeeJ-App/releases/download/v4.1.0/update-manifest-v1.json',
    'https://github.com/lachaux-remi/StreamDeckDeeJ-App/releases/download/v4.1.0/update-manifest-v1.sig'
  ])
})

test('verifies artifact name, size, and SHA-512 and detects later tampering', async () => {
  const fixture = signedManifest()
  const directory = await mkdtemp(join(tmpdir(), 'signed-update-'))
  temporaryDirectories.push(directory)
  const path = join(directory, fixture.manifest.artifacts[0].name)
  await writeFile(path, 'verified AppImage')
  await expect(
    verifyDownloadedUpdateArtifact(path, fixture.manifest.artifacts[0])
  ).resolves.toBeUndefined()

  await writeFile(path, 'tampered AppImage')
  await expect(verifyDownloadedUpdateArtifact(path, fixture.manifest.artifacts[0])).rejects.toThrow(
    /SHA-512/
  )
  await writeFile(path, 'short')
  await expect(verifyDownloadedUpdateArtifact(path, fixture.manifest.artifacts[0])).rejects.toThrow(
    /size/
  )
  expect(await readFile(path, 'utf8')).toBe('short')
})

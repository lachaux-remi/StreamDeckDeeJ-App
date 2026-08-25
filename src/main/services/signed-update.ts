import { createHash, createPublicKey, verify } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { basename } from 'node:path'
import { valid } from 'semver'

export const UPDATE_MANIFEST_NAME = 'update-manifest-v1.json'
export const UPDATE_SIGNATURE_NAME = 'update-manifest-v1.sig'
const RELEASE_DOWNLOAD_BASE = 'https://github.com/lachaux-remi/StreamDeckDeeJ-App/releases/download'
const MAX_MANIFEST_BYTES = 64 * 1024
const MAX_SIGNATURE_BYTES = 1024

export const TRUSTED_UPDATE_KEYS: Readonly<Record<string, string>> = Object.freeze({
  'ed25519-2026-f259170f': `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAk2JDC7gjc/OWs/mQqeexlFuIlx4rXaHBwXcdWFO0/ak=
-----END PUBLIC KEY-----`
})

export interface SignedUpdateArtifact {
  name: string
  size: number
  sha512: string
}

export interface SignedUpdateManifest {
  schemaVersion: 1
  version: string
  releaseCommit: string
  keyId: string
  artifacts: SignedUpdateArtifact[]
}

interface UpdateMetadata {
  version: string
  files: Array<{ url: string; size?: number; sha512: string }>
}

type Fetch = (url: string) => Promise<Response>

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).sort().join('\0') === [...keys].sort().join('\0')
}

function isCanonicalBase64Sha512(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value)) {
    return false
  }
  return Buffer.from(value, 'base64').toString('base64') === value
}

function parseArtifact(value: unknown): SignedUpdateArtifact {
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Update manifest artifact must be an object')
  }
  const artifact = value as Record<string, unknown>
  if (
    !hasExactKeys(artifact, ['name', 'size', 'sha512']) ||
    typeof artifact.name !== 'string' ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(artifact.name) ||
    basename(artifact.name) !== artifact.name ||
    !Number.isSafeInteger(artifact.size) ||
    (artifact.size as number) <= 0 ||
    !isCanonicalBase64Sha512(artifact.sha512)
  ) {
    throw new TypeError('Update manifest artifact metadata is invalid')
  }
  return {
    name: artifact.name,
    size: artifact.size as number,
    sha512: artifact.sha512
  }
}

export function canonicalUpdateManifest(manifest: SignedUpdateManifest): string {
  return `${JSON.stringify({
    schemaVersion: manifest.schemaVersion,
    version: manifest.version,
    releaseCommit: manifest.releaseCommit,
    keyId: manifest.keyId,
    artifacts: manifest.artifacts.map(({ name, size, sha512 }) => ({ name, size, sha512 }))
  })}\n`
}

export function parseAndVerifyUpdateManifest(
  manifestBytes: Uint8Array,
  signatureBytes: Uint8Array | undefined,
  trustedKeys: Readonly<Record<string, string>> = TRUSTED_UPDATE_KEYS
): SignedUpdateManifest {
  if (!signatureBytes) {
    throw new Error('Update signature is missing')
  }
  if (manifestBytes.byteLength === 0 || manifestBytes.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error('Update manifest size is invalid')
  }
  if (signatureBytes.byteLength === 0 || signatureBytes.byteLength > MAX_SIGNATURE_BYTES) {
    throw new Error('Update signature size is invalid')
  }

  const decoder = new TextDecoder('utf-8', { fatal: true })
  const manifestText = decoder.decode(manifestBytes)
  const signatureText = decoder.decode(signatureBytes)
  if (!/^[A-Za-z0-9+/]{86}==\n$/.test(signatureText)) {
    throw new Error('Update signature encoding is invalid')
  }
  const signature = Buffer.from(signatureText.slice(0, -1), 'base64')
  if (signature.byteLength !== 64) {
    throw new Error('Update signature length is invalid')
  }

  const value: unknown = JSON.parse(manifestText)
  if (typeof value !== 'object' || value === null) {
    throw new TypeError('Update manifest must be an object')
  }
  const candidate = value as Record<string, unknown>
  if (
    !hasExactKeys(candidate, ['schemaVersion', 'version', 'releaseCommit', 'keyId', 'artifacts']) ||
    candidate.schemaVersion !== 1 ||
    typeof candidate.version !== 'string' ||
    valid(candidate.version) !== candidate.version ||
    typeof candidate.releaseCommit !== 'string' ||
    !/^[0-9a-f]{40}$/.test(candidate.releaseCommit) ||
    typeof candidate.keyId !== 'string' ||
    !/^[a-z0-9][a-z0-9-]{2,63}$/.test(candidate.keyId) ||
    !Array.isArray(candidate.artifacts) ||
    candidate.artifacts.length === 0
  ) {
    throw new TypeError('Update manifest metadata is invalid')
  }

  const artifacts = candidate.artifacts.map(parseArtifact)
  const names = artifacts.map(({ name }) => name)
  if (new Set(names).size !== names.length || names.join('\0') !== [...names].sort().join('\0')) {
    throw new TypeError('Update manifest artifacts must have unique, sorted names')
  }
  const manifest: SignedUpdateManifest = {
    schemaVersion: 1,
    version: candidate.version,
    releaseCommit: candidate.releaseCommit,
    keyId: candidate.keyId,
    artifacts
  }
  if (canonicalUpdateManifest(manifest) !== manifestText) {
    throw new Error('Update manifest is not canonical')
  }

  const publicKeyPem = trustedKeys[manifest.keyId]
  if (!publicKeyPem) {
    throw new Error('Update manifest key ID is not trusted')
  }
  const publicKey = createPublicKey(publicKeyPem)
  if (publicKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('Trusted update key is not Ed25519')
  }
  if (!verify(null, manifestBytes, publicKey, signature)) {
    throw new Error('Update manifest signature is invalid')
  }
  return manifest
}

async function readLimited(response: Response, limit: number, label: string): Promise<Uint8Array> {
  if (!response.ok) {
    throw new Error(`${label} download failed with status ${response.status}`)
  }
  const declaredLength = response.headers.get('content-length')
  if (declaredLength !== null && Number(declaredLength) > limit) {
    throw new Error(`${label} exceeds the size limit`)
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > limit) {
    throw new Error(`${label} exceeds the size limit`)
  }
  return bytes
}

export async function fetchSignedUpdateManifest(
  version: string,
  fetcher: Fetch,
  trustedKeys: Readonly<Record<string, string>> = TRUSTED_UPDATE_KEYS
): Promise<SignedUpdateManifest> {
  if (valid(version) !== version) {
    throw new Error('Update version is invalid')
  }
  const releaseBase = `${RELEASE_DOWNLOAD_BASE}/v${version}`
  const [manifestResponse, signatureResponse] = await Promise.all([
    fetcher(`${releaseBase}/${UPDATE_MANIFEST_NAME}`),
    fetcher(`${releaseBase}/${UPDATE_SIGNATURE_NAME}`)
  ])
  const [manifestBytes, signatureBytes] = await Promise.all([
    readLimited(manifestResponse, MAX_MANIFEST_BYTES, 'Update manifest'),
    readLimited(signatureResponse, MAX_SIGNATURE_BYTES, 'Update signature')
  ])
  const manifest = parseAndVerifyUpdateManifest(manifestBytes, signatureBytes, trustedKeys)
  if (manifest.version !== version) {
    throw new Error('Signed update version does not match update metadata')
  }
  return manifest
}

export function requireSignedAppImage(
  manifest: SignedUpdateManifest,
  metadata: UpdateMetadata
): SignedUpdateArtifact {
  return requireSignedArtifact(
    manifest,
    metadata,
    `streamdeck-deej-${manifest.version}.AppImage`,
    '.AppImage'
  )
}

export function requireSignedWindowsSetup(
  manifest: SignedUpdateManifest,
  metadata: UpdateMetadata
): SignedUpdateArtifact {
  return requireSignedArtifact(
    manifest,
    metadata,
    `streamdeck-deej-${manifest.version}-windows-x64.exe`,
    '-windows-x64.exe'
  )
}

function requireSignedArtifact(
  manifest: SignedUpdateManifest,
  metadata: UpdateMetadata,
  expectedName: string,
  suffix: string
): SignedUpdateArtifact {
  if (metadata.version !== manifest.version || !Array.isArray(metadata.files)) {
    throw new Error('Update metadata does not match signed manifest')
  }
  const artifacts = manifest.artifacts.filter(({ name }) => name.endsWith(suffix))
  if (artifacts.length !== 1 || artifacts[0].name !== expectedName) {
    throw new Error(`Signed manifest does not contain the expected artifact: ${expectedName}`)
  }
  const artifact = artifacts[0]
  const matchingFiles = metadata.files.filter(({ url }) => url === artifact.name)
  if (
    matchingFiles.length !== 1 ||
    matchingFiles[0].size !== artifact.size ||
    matchingFiles[0].sha512 !== artifact.sha512
  ) {
    throw new Error('Updater metadata does not match the signed artifact')
  }
  return artifact
}

export async function verifyDownloadedUpdateArtifact(
  filePath: string,
  artifact: SignedUpdateArtifact
): Promise<void> {
  if (basename(filePath) !== artifact.name) {
    throw new Error('Downloaded update filename does not match signed manifest')
  }
  const before = await stat(filePath)
  if (!before.isFile() || before.size !== artifact.size) {
    throw new Error('Downloaded update size does not match signed manifest')
  }
  const digest = await new Promise<string>((resolve, reject) => {
    const hash = createHash('sha512')
    createReadStream(filePath)
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('base64')))
  })
  const after = await stat(filePath)
  if (
    after.size !== before.size ||
    after.mtimeMs !== before.mtimeMs ||
    digest !== artifact.sha512
  ) {
    throw new Error('Downloaded update SHA-512 does not match signed manifest')
  }
}

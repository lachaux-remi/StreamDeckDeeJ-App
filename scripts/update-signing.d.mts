import type { KeyObject } from 'node:crypto'

export interface UpdateManifestArtifact {
  name: string
  size: number
  sha512: string
}

export interface UpdateManifest {
  schemaVersion: 1
  version: string
  releaseCommit: string
  keyId: string
  artifacts: UpdateManifestArtifact[]
}

export const UPDATE_KEY_ID: string
export const UPDATE_MANIFEST_NAME: string
export const UPDATE_SIGNATURE_NAME: string
export const UPDATE_PUBLIC_KEY: string

export function createUpdateManifest(
  directory: string,
  version: string,
  releaseCommit: string,
  keyId?: string
): Promise<UpdateManifest>
export function encryptedEd25519PrivateKey(privateKeyPem: string, passphrase: string): KeyObject
export function writeSignedUpdateManifest(
  directory: string,
  version: string,
  releaseCommit: string,
  privateKeyPem: string,
  passphrase: string,
  expectedPublicKey?: string,
  keyId?: string
): Promise<void>
export function verifySignedReleaseDirectory(
  directory: string,
  expectedVersion: string,
  expectedCommit: string,
  trustedKeys?: Record<string, string>
): Promise<void>

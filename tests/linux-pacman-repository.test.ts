import { execFile } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterAll, beforeAll, expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const workflow = readFileSync('.github/workflows/pacman-repo.yml', 'utf8')
const releaseWorkflow = readFileSync('.github/workflows/release.yml', 'utf8')
const committedFingerprint = readFileSync(
  'packaging/pacman/streamdeck-deej.fingerprint',
  'utf8'
).trim()
const committedKey = readFileSync('packaging/pacman/streamdeck-deej.asc', 'utf8')

let workspace: string
let gnupgHome: string
let fingerprint: string
let publicKey: string

async function gpg(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('gpg', ['--homedir', gnupgHome, '--batch', ...args])
  return stdout
}

async function signedRepository(
  name: string,
  options: { tamper?: boolean; extraFile?: boolean; version?: string } = {}
): Promise<string> {
  const directory = join(workspace, name)
  const entry = join(directory, 'entry', 'streamdeck-deej-4.2.1-1')
  await mkdir(entry, { recursive: true })
  await writeFile(
    join(entry, 'desc'),
    `%FILENAME%\nstreamdeck-deej-4.2.1.pkg.tar.xz\n\n%NAME%\nstreamdeck-deej\n\n%VERSION%\n${options.version ?? '4.2.1'}-1\n`
  )
  await execFileAsync('tar', [
    '-czf',
    join(directory, 'streamdeck-deej.db'),
    '-C',
    join(directory, 'entry'),
    '.'
  ])
  await execFileAsync('cp', [
    join(directory, 'streamdeck-deej.db'),
    join(directory, 'streamdeck-deej.files')
  ])
  await rm(join(directory, 'entry'), { recursive: true })
  await writeFile(join(directory, 'streamdeck-deej-4.2.1.pkg.tar.xz'), 'package')
  for (const file of [
    'streamdeck-deej-4.2.1.pkg.tar.xz',
    'streamdeck-deej.db',
    'streamdeck-deej.files'
  ]) {
    await gpg(
      '--yes',
      '--detach-sign',
      '--output',
      join(directory, `${file}.sig`),
      join(directory, file)
    )
  }
  if (options.tamper) {
    await writeFile(join(directory, 'streamdeck-deej-4.2.1.pkg.tar.xz'), 'tampered')
  }
  if (options.extraFile) {
    await writeFile(join(directory, 'other.pkg.tar.xz'), 'other')
  }
  return directory
}

async function verify(
  directory: string,
  key = publicKey,
  expectedFingerprint = fingerprint
): Promise<void> {
  await execFileAsync('scripts/verify-pacman-repo.sh', [
    directory,
    '4.2.1',
    key,
    expectedFingerprint
  ])
}

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'pacman-repository-'))
  gnupgHome = join(workspace, 'gnupg')
  await mkdir(gnupgHome)
  await chmod(gnupgHome, 0o700)
  await gpg(
    '--passphrase',
    '',
    '--quick-gen-key',
    'Test Repository <test@example.invalid>',
    'ed25519',
    'sign',
    'never'
  )
  fingerprint =
    (await gpg('--list-keys', '--with-colons')).match(/^fpr:+([0-9A-F]{40}):/m)?.[1] ?? ''
  publicKey = join(workspace, 'public.asc')
  await writeFile(publicKey, await gpg('--armor', '--export', fingerprint))
}, 60_000)

afterAll(async () => {
  await execFileAsync('gpgconf', ['--homedir', gnupgHome, '--kill', 'all']).catch(() => undefined)
  await rm(workspace, { recursive: true, force: true })
})

test('accepts a repository fully signed by the expected key', async () => {
  await expect(verify(await signedRepository('valid'))).resolves.toBeUndefined()
})

test('rejects tampered files, unexpected files, wrong versions and foreign keys', async () => {
  await expect(verify(await signedRepository('tampered', { tamper: true }))).rejects.toThrow()
  await expect(verify(await signedRepository('extra', { extraFile: true }))).rejects.toThrow(
    /Unexpected repository files/
  )
  await expect(verify(await signedRepository('version', { version: '4.2.0' }))).rejects.toThrow()
  await expect(
    verify(await signedRepository('foreign'), publicKey, 'A'.repeat(40))
  ).rejects.toThrow(/foreign signature/)
})

test('commits only the public half of the repository signing key', async () => {
  expect(committedFingerprint).toMatch(/^[0-9A-F]{40}$/)
  expect(committedKey).toContain('-----BEGIN PGP PUBLIC KEY BLOCK-----')
  expect(committedKey).not.toMatch(/PRIVATE KEY/)
  const { stdout } = await execFileAsync('gpg', [
    '--batch',
    '--with-colons',
    '--show-keys',
    'packaging/pacman/streamdeck-deej.asc'
  ])
  expect(stdout.match(/^fpr:+([0-9A-F]{40}):/m)?.[1]).toBe(committedFingerprint)
})

test('keeps signing secrets in the build job and publishes a non-latest prerelease', () => {
  const prepare = workflow.slice(workflow.indexOf('  prepare:'), workflow.indexOf('  build:'))
  const build = workflow.slice(workflow.indexOf('  build:'), workflow.indexOf('  publish:'))
  const publish = workflow.slice(workflow.indexOf('  publish:'), workflow.indexOf('  smoke:'))
  const smoke = workflow.slice(workflow.indexOf('  smoke:'))

  expect(prepare).toContain('releases/latest" --jq .tag_name)" = "$RELEASE_TAG"')
  expect(prepare).toContain('node scripts/update-signing.mjs verify release-artifacts')
  expect(build).toContain('environment: pacman-repo')
  expect(build).toContain('PACMAN_REPO_GPG_PRIVATE_KEY: ${{ secrets.PACMAN_REPO_GPG_PRIVATE_KEY }}')
  expect(build).toMatch(/container: archlinux:base-devel@sha256:[0-9a-f]{64}/)
  expect(build).toContain('scripts/verify-pacman-repo.sh pacman-repository')
  expect(`${prepare}${publish}${smoke}`).not.toContain('secrets.')
  expect(publish).toContain('--prerelease --latest=false')
  expect(publish).toContain("jq -e '.isPrerelease == true and .isDraft == false'")
  expect(smoke).toContain('SigLevel = Required DatabaseRequired')
  expect(smoke).toContain('pacman-key --lsign-key "$fingerprint"')
})

test('the release workflow refreshes the pacman repository after publishing', () => {
  const job = releaseWorkflow.slice(releaseWorkflow.indexOf('  publish-pacman-repository:'))
  expect(job).toContain('needs: [create-release, publish-release]')
  expect(job).toContain('uses: ./.github/workflows/pacman-repo.yml')
  expect(job).toContain('contents: write')
  expect(job).toContain('tag: ${{ needs.create-release.outputs.tag_name }}')
})

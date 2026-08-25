import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, expect, test } from 'vitest'

const execute = promisify(execFile)
const temporaryDirectories: string[] = []
const version = '4.1.0'
const setupName = `streamdeck-deej-${version}-windows-x64.exe`

async function fixture(): Promise<{ dist: string; latest: string }> {
  const dist = await mkdtemp(join(tmpdir(), 'windows-update-metadata-'))
  temporaryDirectories.push(dist)
  await mkdir(join(dist, 'win-unpacked', 'resources'), { recursive: true })
  const setup = Buffer.from('signed NSIS setup fixture')
  const sha512 = createHash('sha512').update(setup).digest('base64')
  const latest = `version: ${version}\nfiles:\n  - url: ${setupName}\n    sha512: ${sha512}\n    size: ${setup.length}\npath: ${setupName}\nsha512: ${sha512}\n`
  await Promise.all([
    writeFile(join(dist, setupName), setup),
    writeFile(join(dist, `${setupName}.blockmap`), 'blockmap'),
    writeFile(join(dist, 'latest.yml'), latest),
    writeFile(
      join(dist, 'win-unpacked', 'resources', 'app-update.yml'),
      'provider: github\nowner: lachaux-remi\nrepo: StreamDeckDeeJ-App\nprivate: false\n'
    )
  ])
  return { dist, latest }
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

test('verifies exact Windows setup metadata, size, SHA-512, and blockmap', async () => {
  const { dist } = await fixture()

  await expect(
    execute(process.execPath, ['scripts/verify-windows-update-metadata.mjs', dist])
  ).resolves.toMatchObject({ stdout: expect.stringContaining(`Verified latest.yml: ${setupName}`) })
})

test('rejects altered Windows setup metadata and content', async () => {
  const { dist, latest } = await fixture()
  await writeFile(join(dist, 'latest.yml'), latest.replace(`size: 25`, `size: 24`))
  await expect(
    execute(process.execPath, ['scripts/verify-windows-update-metadata.mjs', dist])
  ).rejects.toThrow()

  await writeFile(join(dist, 'latest.yml'), latest)
  await writeFile(join(dist, setupName), 'altered NSIS setup fixture')
  await expect(
    execute(process.execPath, ['scripts/verify-windows-update-metadata.mjs', dist])
  ).rejects.toThrow()
})

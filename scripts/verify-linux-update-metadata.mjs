import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { load } from 'js-yaml'

const dist = process.argv[2] || 'dist'
const files = readdirSync(dist)
// JavaScript keeps this release assertion executable without a build step.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
const exactlyOne = (suffix) => {
  const matches = files.filter((file) => file.endsWith(suffix))
  assert.equal(
    matches.length,
    1,
    `Expected exactly one ${suffix} artifact, found ${matches.length}`
  )
  return matches[0]
}

const appImageName = exactlyOne('.AppImage')
const pacmanName = exactlyOne('.pkg.tar.xz')
const metadataName = exactlyOne('latest-linux.yml')
const metadata = load(readFileSync(join(dist, metadataName), 'utf8'))
const updaterConfiguration = load(
  readFileSync(join(dist, 'linux-unpacked', 'resources', 'app-update.yml'), 'utf8')
)

assert.deepEqual(
  {
    provider: updaterConfiguration.provider,
    owner: updaterConfiguration.owner,
    repo: updaterConfiguration.repo,
    private: updaterConfiguration.private
  },
  {
    provider: 'github',
    owner: 'lachaux-remi',
    repo: 'StreamDeckDeeJ-App',
    private: false
  },
  'Packaged updater provider must be the fixed public GitHub repository'
)
assert.equal(
  'token' in updaterConfiguration,
  false,
  'Packaged updater configuration must not contain a token'
)

assert.equal(typeof metadata, 'object')
assert.ok(Array.isArray(metadata.files), 'latest-linux.yml must contain a files list')
assert.deepEqual(
  new Set(metadata.files.map((entry) => entry?.url)),
  new Set([appImageName, pacmanName]),
  'Update metadata must declare exactly the generated Linux artifacts'
)
const appImageEntry = metadata.files.find((entry) => entry?.url === appImageName)
assert.ok(appImageEntry, 'latest-linux.yml must reference the generated AppImage by basename')
assert.ok(
  Number.isSafeInteger(appImageEntry.blockMapSize) && appImageEntry.blockMapSize > 0,
  'AppImage must contain an embedded blockmap'
)

let appImageDigest
for (const entry of metadata.files) {
  assert.equal(
    basename(entry.url),
    entry.url,
    'Update metadata must not contain a remote or nested URL'
  )
  assert.equal(
    entry.size,
    statSync(join(dist, entry.url)).size,
    `Declared size differs for ${entry.url}`
  )
  const digest = await new Promise((resolve, reject) => {
    const hash = createHash('sha512')
    createReadStream(join(dist, entry.url))
      .on('error', reject)
      .on('data', (chunk) => hash.update(chunk))
      .on('end', () => resolve(hash.digest('base64')))
  })
  assert.equal(entry.sha512, digest, `SHA512 in latest-linux.yml does not match ${entry.url}`)
  if (entry.url === appImageName) appImageDigest = digest
}
assert.equal(metadata.path, appImageName, 'Top-level update path must reference the AppImage')
assert.equal(metadata.sha512, appImageDigest, 'Top-level AppImage SHA512 does not match')
assert.equal(metadata.version, JSON.parse(readFileSync('package.json', 'utf8')).version)

console.log(`Verified ${metadataName}: ${appImageName}, SHA512 and embedded blockmap`)

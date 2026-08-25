import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'
import { load } from 'js-yaml'

const dist = process.argv[2] || 'dist'
const version = JSON.parse(readFileSync('package.json', 'utf8')).version
const setupName = `streamdeck-deej-${version}-windows-x64.exe`
const blockmapName = `${setupName}.blockmap`
const metadataName = 'latest.yml'
const metadata = load(readFileSync(join(dist, metadataName), 'utf8'))
const updaterConfiguration = load(
  readFileSync(join(dist, 'win-unpacked', 'resources', 'app-update.yml'), 'utf8')
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
assert.equal(metadata.version, version)
assert.ok(Array.isArray(metadata.files), 'latest.yml must contain a files list')
assert.deepEqual(
  metadata.files.map((entry) => entry?.url),
  [setupName],
  'Windows update metadata must declare exactly the generated x64 setup'
)
const setup = metadata.files[0]
assert.equal(basename(setup.url), setup.url, 'Setup URL must be an exact basename')
assert.equal(setup.size, statSync(join(dist, setupName)).size, 'Declared setup size differs')
assert.ok(statSync(join(dist, blockmapName)).size > 0, 'NSIS blockmap must be non-empty')

const digest = await new Promise((resolve, reject) => {
  const hash = createHash('sha512')
  createReadStream(join(dist, setupName))
    .on('error', reject)
    .on('data', (chunk) => hash.update(chunk))
    .on('end', () => resolve(hash.digest('base64')))
})
assert.equal(setup.sha512, digest, 'SHA512 in latest.yml does not match the setup')
assert.equal(metadata.path, setupName, 'Top-level update path must reference the setup')
assert.equal(metadata.sha512, digest, 'Top-level setup SHA512 does not match')

console.log(`Verified ${metadataName}: ${setupName}, SHA512 and blockmap`)

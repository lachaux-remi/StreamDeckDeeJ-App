import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'
import { load } from 'js-yaml'

interface BuilderConfig {
  appId?: string
  win?: Record<string, unknown>
  nsis?: unknown
  asarUnpack?: string[]
  files?: string[]
}

interface PackageManifest {
  scripts: Record<string, string>
  optionalDependencies?: Record<string, string>
}

test('configures a stable per-user Windows 10/11 x64 NSIS package', async () => {
  const config = load(await readFile('electron-builder.yml', 'utf8')) as BuilderConfig
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as PackageManifest

  expect(config.appId).toBe('fr.remi-lachaux.streamdeck-deej')
  expect(config.win).toMatchObject({
    icon: 'resources/icon.ico',
    artifactName: 'streamdeck-deej-${version}-windows-x64.${ext}',
    target: [{ target: 'nsis', arch: ['x64'] }],
    extraResources: [
      {
        from: 'node_modules/@streamdeck-deej/windows-audio-native',
        to: 'app.asar.unpacked/node_modules/@streamdeck-deej/windows-audio-native'
      }
    ],
    signExecutable: false,
    verifyUpdateCodeSignature: false
  })
  expect(config.win).not.toHaveProperty('publisherName')
  expect(config.nsis).toMatchObject({
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false
  })
  expect(config.asarUnpack).toContain('**/node_modules/**/*.node')
  expect(config.files).toContain('!packages/**/*')
  expect(config.files).toContain('!**/node_modules/@streamdeck-deej/windows-audio-native/**/*')
  expect(pkg.scripts['package:windows']).toContain('electron-builder --win nsis --x64')
  expect(pkg.optionalDependencies?.['@streamdeck-deej/windows-audio-native']).toBe('workspace:*')
  expect(pkg.scripts['verify:update-metadata:windows']).toContain(
    'verify-windows-update-metadata.mjs'
  )
  await expect(readFile('resources/icon.ico')).resolves.toBeInstanceOf(Buffer)
})

test('Windows CI packages and smokes without credentials or hardware', async () => {
  const workflow = await readFile('.github/workflows/ci-windows.yml', 'utf8')

  expect(workflow).toContain('workflow_call:')
  expect(workflow).toContain('checkout_ref:')
  expect(workflow).toContain('artifact_name:')
  expect(workflow).toContain('runs-on: windows-latest')
  expect(workflow).toContain('pnpm install --frozen-lockfile --strict-peer-dependencies')
  expect(workflow).toContain('pnpm test:windows')
  expect(workflow).toContain('pnpm build:windows-audio')
  expect(workflow).toContain('scripts/smoke-windows-audio.cjs')
  expect(workflow).toContain(
    'app.asar.unpacked/node_modules/@streamdeck-deej/windows-audio-native/build/Release/windows_audio.node'
  )
  expect(workflow).toContain('pnpm package:windows')
  expect(workflow).toContain('pnpm verify:update-metadata:windows')
  expect(workflow).toContain('dist/win-unpacked/streamdeck-deej.exe')
  expect(workflow).toContain('windows-x64.exe.blockmap')
  expect(workflow).toContain('dist/latest.yml')
  expect(workflow).toContain('actions/upload-artifact@')
  expect(workflow).toContain('name: ${{ inputs.artifact_name }}')
  expect(workflow).not.toMatch(/secrets\./)
})

test('documents the accepted SmartScreen warning for unsigned Windows packages', async () => {
  const readme = await readFile('README.md', 'utf8')

  expect(readme).toContain('Windows a protégé votre ordinateur')
  expect(readme).toContain('non signé nativement')
  expect(readme).toContain('Ed25519')
})

test('Git checkouts keep Prettier inputs on LF without treating images as text', async () => {
  const attributes = await readFile('.gitattributes', 'utf8')

  expect(attributes).toContain('* text=auto eol=lf')
  expect(attributes).toContain('*.png binary')
  expect(attributes).toContain('*.ico binary')
})

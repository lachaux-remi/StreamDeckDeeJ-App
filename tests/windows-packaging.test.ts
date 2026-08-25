import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'
import { load } from 'js-yaml'

interface BuilderConfig {
  appId?: string
  win?: unknown
  nsis?: unknown
  asarUnpack?: string[]
}

interface PackageManifest {
  scripts: Record<string, string>
}

test('configures a stable per-user Windows 10/11 x64 NSIS package', async () => {
  const config = load(await readFile('electron-builder.yml', 'utf8')) as BuilderConfig
  const pkg = JSON.parse(await readFile('package.json', 'utf8')) as PackageManifest

  expect(config.appId).toBe('fr.remi-lachaux.streamdeck-deej')
  expect(config.win).toMatchObject({
    icon: 'resources/icon.ico',
    artifactName: 'streamdeck-deej-${version}-windows-x64.${ext}',
    target: [{ target: 'nsis', arch: ['x64'] }]
  })
  expect(config.nsis).toMatchObject({
    oneClick: false,
    perMachine: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    deleteAppDataOnUninstall: false
  })
  expect(config.asarUnpack).toContain('**/node_modules/**/*.node')
  expect(pkg.scripts['package:windows']).toContain('electron-builder --win nsis --x64')
  await expect(readFile('resources/icon.ico')).resolves.toBeInstanceOf(Buffer)
})

test('Windows CI packages and smokes without credentials or hardware', async () => {
  const workflow = await readFile('.github/workflows/ci-windows.yml', 'utf8')

  expect(workflow).toContain('runs-on: windows-latest')
  expect(workflow).toContain('pnpm install --frozen-lockfile --strict-peer-dependencies')
  expect(workflow).toContain('pnpm test:coverage')
  expect(workflow).toContain('pnpm package:windows')
  expect(workflow).toContain('dist/win-unpacked/streamdeck-deej.exe')
  expect(workflow).not.toMatch(/secrets\./)
})

test('Git checkouts keep Prettier inputs on LF without treating images as text', async () => {
  const attributes = await readFile('.gitattributes', 'utf8')

  expect(attributes).toContain('* text=auto eol=lf')
  expect(attributes).toContain('*.png binary')
  expect(attributes).toContain('*.ico binary')
})

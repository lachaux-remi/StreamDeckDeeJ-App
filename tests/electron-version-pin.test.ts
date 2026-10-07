import { readFileSync } from 'node:fs'
import { expect, test } from 'vitest'

const app = JSON.parse(readFileSync('package.json', 'utf8')) as {
  devDependencies: Record<string, string>
}
const windowsAudio = JSON.parse(
  readFileSync('packages/windows-audio-native/package.json', 'utf8')
) as { scripts: Record<string, string> }

test('pins Electron to an exact version', () => {
  expect(app.devDependencies.electron).toMatch(/^\d+\.\d+\.\d+$/)
})

test('builds the Windows audio addon against the pinned Electron headers', () => {
  // Dependabot only bumps package.json, so an Electron update must also bump this target.
  expect(windowsAudio.scripts['build:electron']).toContain(
    `--target=${app.devDependencies.electron} `
  )
})

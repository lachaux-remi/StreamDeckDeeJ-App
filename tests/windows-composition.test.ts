import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'

test('keeps Linux-only services behind the lazy platform composition boundary', async () => {
  const [main, platformRuntime, linuxRuntime] = await Promise.all([
    readFile('src/main/index.ts', 'utf8'),
    readFile('src/main/platform-runtime.ts', 'utf8'),
    readFile('src/main/platform-linux.ts', 'utf8')
  ])
  const linuxOnlyModules = [
    'sessions.service',
    'mic.service',
    'hardware-permissions.service',
    'linux-autostart',
    'linux-update.service'
  ]

  for (const module of linuxOnlyModules) {
    expect(main).not.toContain(module)
    expect(linuxRuntime).toContain(module)
  }
  expect(platformRuntime).toContain("await import('./platform-linux')")
  expect(platformRuntime).not.toMatch(/from ['"]\.\/platform-linux['"]/)
  expect(main).not.toContain('windows-audio.service')
  expect(linuxRuntime).not.toContain('windows-audio.service')
  expect(platformRuntime).toContain("await import('./services/windows-audio.service')")
})

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { access, chmod, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { generateLinuxPermissionAssets, UDEV_RULE } from '../../../scripts/linux-permissions.mjs'

const execFileAsync = promisify(execFile)

async function runGeneratedRemoval(afterRemove: string, rulePath: string): Promise<string> {
  const ownershipBlock = afterRemove.match(
    /# BEGIN STREAMDECK DEEJ UDEV OWNERSHIP\n([\s\S]*?)# END STREAMDECK DEEJ UDEV OWNERSHIP/
  )?.[1]
  expect(ownershipBlock).toBeDefined()

  const scriptPath = `${rulePath}.remove-test`
  const script = `#!/bin/sh\nset -eu\n${ownershipBlock!}`
    .replaceAll('/etc/udev/rules.d/70-streamdeck-deej.rules', rulePath)
    .replace('if command -v udevadm >/dev/null 2>&1; then', 'if false; then')
  await writeFile(scriptPath, script, { mode: 0o700 })
  await chmod(scriptPath, 0o700)
  const { stderr } = await execFileAsync(scriptPath)
  return stderr
}

test('generates a minimal uaccess rule and fixed privileged installer', async () => {
  const output = await mkdtemp(join(tmpdir(), 'streamdeck-deej-permissions-'))

  try {
    await generateLinuxPermissionAssets(output)

    expect(UDEV_RULE).toBe(
      [
        'SUBSYSTEM=="hidraw", ATTRS{idVendor}=="5239", ATTRS{idProduct}=="0001", TAG+="uaccess"',
        'SUBSYSTEM=="tty", ATTRS{idVendor}=="5239", ATTRS{idProduct}=="0001", MODE="0660", TAG+="uaccess"',
        ''
      ].join('\n')
    )
    expect(UDEV_RULE).not.toMatch(/GROUP|0666/)

    const installer = await readFile(join(output, 'install-udev-rule'), 'utf8')
    expect(installer).toMatch(/\/etc\/udev\/rules\.d\/70-streamdeck-deej\.rules/)
    expect(installer).toMatch(/sha256sum/)
    expect(installer).toMatch(/install -D -m 0644/)
    expect(installer).not.toMatch(/\$2|eval|sudo/)

    const afterInstall = await readFile(join(output, 'after-install.tpl'), 'utf8')
    const afterRemove = await readFile(join(output, 'after-remove.tpl'), 'utf8')
    expect(afterInstall).toMatch(/install-udev-rule' install/)
    expect(afterRemove).toMatch(/sha256sum '\/etc\/udev\/rules\.d\/70-streamdeck-deej\.rules'/)
    expect(afterRemove).toMatch(/rm -f '\/etc\/udev\/rules\.d\/70-streamdeck-deej\.rules'/)
    expect(afterRemove).toMatch(/preserving modified StreamDeck DeeJ udev rule/)
    expect(afterInstall).toMatch(/update-alternatives/)
    expect(afterRemove).toMatch(/update-alternatives/)
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

test('removes an unchanged packaged rule during uninstall', async () => {
  const output = await mkdtemp(join(tmpdir(), 'streamdeck-deej-remove-canonical-'))
  const rulePath = join(output, 'installed.rules')

  try {
    await generateLinuxPermissionAssets(output)
    const afterRemove = await readFile(join(output, 'after-remove.tpl'), 'utf8')
    await writeFile(rulePath, UDEV_RULE)

    await expect(runGeneratedRemoval(afterRemove, rulePath)).resolves.toBe('')
    await expect(access(rulePath)).rejects.toThrow()
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

test('preserves an administrator-modified rule during uninstall', async () => {
  const output = await mkdtemp(join(tmpdir(), 'streamdeck-deej-remove-modified-'))
  const rulePath = join(output, 'installed.rules')
  const modifiedRule = `${UDEV_RULE}# retained administrator change\n`

  try {
    await generateLinuxPermissionAssets(output)
    const afterRemove = await readFile(join(output, 'after-remove.tpl'), 'utf8')
    await writeFile(rulePath, modifiedRule)

    await expect(runGeneratedRemoval(afterRemove, rulePath)).resolves.toMatch(
      /preserving modified StreamDeck DeeJ udev rule/i
    )
    await expect(readFile(rulePath, 'utf8')).resolves.toBe(modifiedRule)
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

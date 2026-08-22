import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from 'vitest'
import { generateLinuxPermissionAssets, UDEV_RULE } from '../../../scripts/linux-permissions.mjs'

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
    expect(afterRemove).toMatch(/rm -f '\/etc\/udev\/rules\.d\/70-streamdeck-deej\.rules'/)
    expect(afterInstall).toMatch(/update-alternatives/)
    expect(afterRemove).toMatch(/update-alternatives/)
  } finally {
    await rm(output, { recursive: true, force: true })
  }
})

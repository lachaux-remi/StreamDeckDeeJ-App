import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { chmod, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'

const RULE_NAME = '70-streamdeck-deej.rules'
const RULE_DESTINATION = `/etc/udev/rules.d/${RULE_NAME}`
const RULE_SOURCE = new URL(`../resources/linux/${RULE_NAME}`, import.meta.url)
// Executable and /opt directory name, both derived from productName in electron-builder.yml.
export const INSTALL_NAME = 'streamdeck-deej'

export const UDEV_RULE = readFileSync(RULE_SOURCE, 'utf8')

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function electronBuilderTemplate(name) {
  const require = createRequire(import.meta.url)
  const electronBuilderPackage = require.resolve('electron-builder/package.json')
  const nestedRequire = createRequire(electronBuilderPackage)
  const appBuilderPackage = nestedRequire.resolve('app-builder-lib/package.json')
  return join(dirname(appBuilderPackage), 'templates', 'linux', name)
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function reloadRulesScript() {
  return `if command -v udevadm >/dev/null 2>&1; then
  udevadm control --reload-rules
  udevadm trigger --subsystem-match=hidraw || true
  udevadm trigger --subsystem-match=tty || true
fi`
}

// pacman runs post_upgrade, not post_install, when a package is upgraded, so
// replay the install script then: it restores the chrome-sandbox mode, the
// AppArmor profile and the udev rule. electron-builder only renders ${...}
// variables in afterInstall/afterRemove, and this script is passed to fpm
// directly, so render them here.
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function renderUpgradeScript(afterInstallTemplate) {
  const body = afterInstallTemplate
    .replace(/^#!.*\n/, '')
    .replaceAll('${executable}', INSTALL_NAME)
    .replaceAll('${sanitizedProductName}', INSTALL_NAME)
  const unrendered = body.match(/\$\{[A-Za-z_][\w.]*\}/)
  if (unrendered) {
    throw new Error(`Unrendered electron-builder variable in after-upgrade.sh: ${unrendered[0]}`)
  }
  return `#!/bin/bash\n${body}`
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function generateLinuxPermissionAssets(outputDirectory) {
  const ruleHash = createHash('sha256').update(UDEV_RULE).digest('hex')
  const installer = `#!/bin/sh
set -eu

[ "\${1:-}" = install ] && [ "$#" -eq 1 ] || {
  echo 'Usage: install-udev-rule install' >&2
  exit 64
}
[ "$(id -u)" -eq 0 ] || {
  echo 'Administrator privileges are required.' >&2
  exit 77
}

source_rule="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)/${RULE_NAME}"
actual_hash="$(sha256sum "$source_rule" | cut -d ' ' -f 1)"
[ "$actual_hash" = '${ruleHash}' ] || {
  echo 'Bundled udev rule integrity check failed.' >&2
  exit 65
}

install -D -m 0644 "$source_rule" '${RULE_DESTINATION}'
${reloadRulesScript()}
`

  const [defaultAfterInstall, defaultAfterRemove] = await Promise.all([
    readFile(electronBuilderTemplate('after-install.tpl'), 'utf8'),
    readFile(electronBuilderTemplate('after-remove.tpl'), 'utf8')
  ])
  const afterInstall = `${defaultAfterInstall.trimEnd()}

# Grant the active local session access only to StreamDeck DeeJ's HID and serial interfaces.
'/opt/\${sanitizedProductName}/resources/linux/install-udev-rule' install
`
  const afterRemove = `${defaultAfterRemove.trimEnd()}

# Remove the package rule only while its contents remain unchanged.
# BEGIN STREAMDECK DEEJ UDEV OWNERSHIP
if [ -f '${RULE_DESTINATION}' ]; then
  installed_hash="$(sha256sum '${RULE_DESTINATION}' | cut -d ' ' -f 1)"
  if [ "$installed_hash" = '${ruleHash}' ]; then
    rm -f '${RULE_DESTINATION}'
  else
    echo 'Warning: preserving modified StreamDeck DeeJ udev rule during package removal.' >&2
  fi
fi
${reloadRulesScript()}
# END STREAMDECK DEEJ UDEV OWNERSHIP
`

  const afterUpgrade = renderUpgradeScript(afterInstall)

  await mkdir(outputDirectory, { recursive: true })
  await Promise.all([
    copyFile(RULE_SOURCE, join(outputDirectory, RULE_NAME)),
    writeFile(join(outputDirectory, 'install-udev-rule'), installer, { mode: 0o755 }),
    writeFile(join(outputDirectory, 'after-install.tpl'), afterInstall, { mode: 0o755 }),
    writeFile(join(outputDirectory, 'after-remove.tpl'), afterRemove, { mode: 0o755 }),
    writeFile(join(outputDirectory, 'after-upgrade.sh'), afterUpgrade, { mode: 0o755 })
  ])
  await Promise.all([
    chmod(join(outputDirectory, 'install-udev-rule'), 0o755),
    chmod(join(outputDirectory, 'after-install.tpl'), 0o755),
    chmod(join(outputDirectory, 'after-remove.tpl'), 0o755),
    chmod(join(outputDirectory, 'after-upgrade.sh'), 0o755)
  ])
}

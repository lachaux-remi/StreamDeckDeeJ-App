import { constants } from 'node:fs'
import {
  access,
  mkdir,
  readFile,
  realpath,
  rename,
  stat,
  unlink,
  writeFile
} from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { randomUUID } from 'node:crypto'

interface LinuxAutostartOptions {
  enabled: boolean
  appName: string
  autostartFile: string
  executablePath: string
  appImagePath?: string
  packagedIconPath: string
  persistentIconPath: string
}

function escapeDesktopValue(value: string): string {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('\t', '\\t')
}

function quoteExecArgument(value: string): string {
  return `"${value.replaceAll('%', '%%').replaceAll(/([\\`"$])/g, '\\$1')}"`
}

function isInside(parent: string, child: string): boolean {
  const pathFromParent = relative(parent, child)
  return (
    pathFromParent === '' || (!pathFromParent.startsWith(`..${sep}`) && pathFromParent !== '..')
  )
}

async function validatedAppImagePath(appImagePath: string): Promise<string> {
  if (!isAbsolute(appImagePath)) {
    throw new Error('AppImage path must be absolute')
  }

  let canonicalPath: string
  try {
    canonicalPath = await realpath(appImagePath)
    if (isInside(await realpath(tmpdir()), canonicalPath)) {
      throw new Error('AppImage path must be stable')
    }
    if (!(await stat(canonicalPath)).isFile()) {
      throw new Error('AppImage path must reference a file')
    }
    await access(canonicalPath, constants.X_OK)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('AppImage path')) {
      throw error
    }
    throw new Error('AppImage path must reference an executable file', { cause: error })
  }
  return canonicalPath
}

async function atomicWrite(path: string, contents: string | Buffer): Promise<void> {
  const directory = dirname(path)
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const temporaryPath = join(directory, `.${basename(path)}.${process.pid}-${randomUUID()}.tmp`)
  try {
    await writeFile(temporaryPath, contents, { mode: 0o600 })
    await rename(temporaryPath, path)
  } catch (error) {
    try {
      await unlink(temporaryPath)
    } catch {
      // Best-effort cleanup must not hide the original write error.
    }
    throw error
  }
}

async function persistAppImageIcon(sourcePath: string, destinationPath: string): Promise<boolean> {
  try {
    await atomicWrite(destinationPath, await readFile(sourcePath))
    return true
  } catch {
    return false
  }
}

export async function setLinuxAutostart(options: LinuxAutostartOptions): Promise<void> {
  if (!options.enabled) {
    try {
      await unlink(options.autostartFile)
    } catch {
      // Desktop entry removal is best effort.
    }
    try {
      await unlink(options.persistentIconPath)
    } catch {
      // Icon cleanup is best effort when disabling autostart.
    }
    return
  }

  const { appImagePath } = options
  const isAppImage = appImagePath !== undefined
  const executablePath = isAppImage
    ? await validatedAppImagePath(appImagePath)
    : options.executablePath
  const iconPath = isAppImage
    ? (await persistAppImageIcon(options.packagedIconPath, options.persistentIconPath))
      ? options.persistentIconPath
      : undefined
    : options.packagedIconPath
  const desktopEntry = [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${escapeDesktopValue(options.appName)}`,
    `Exec=${quoteExecArgument(executablePath)}`,
    'X-GNOME-Autostart-enabled=true',
    'StartupWMClass=streamdeck-deej',
    ...(iconPath ? [`Icon=${escapeDesktopValue(iconPath)}`] : []),
    ''
  ].join('\n')

  await atomicWrite(options.autostartFile, desktopEntry)
}

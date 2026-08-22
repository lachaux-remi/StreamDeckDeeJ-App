import { chmod, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir, tmpdir } from 'node:os'
import { afterEach, expect, test } from 'vitest'
import { setLinuxAutostart } from '@main/services/linux-autostart'

const testDirectories: string[] = []

async function createTestDirectory(): Promise<string> {
  const directory = await mkdtemp(join(homedir(), '.streamdeck-autostart-test-'))
  testDirectories.push(directory)
  return directory
}

afterEach(async () => {
  await Promise.all(
    testDirectories.splice(0).map((directory) => rm(directory, { recursive: true }))
  )
})

test('uses a validated AppImage and copies its mounted icon to persistent private storage', async () => {
  const directory = await createTestDirectory()
  const appImage = join(directory, 'Stream Deck $DeeJ.AppImage')
  const mountedExecutable = join(tmpdir(), '.mount_streamdeck', 'streamdeck-deej')
  const mountedIcon = join(directory, 'mount', 'logo.png')
  const autostartFile = join(directory, 'config', 'autostart', 'streamdeck-deej.desktop')
  const persistentIcon = join(directory, 'user-data', 'autostart-icon.png')
  await writeFile(appImage, 'appimage')
  await chmod(appImage, 0o700)
  await mkdir(join(directory, 'mount'))
  await writeFile(mountedIcon, 'icon')

  await setLinuxAutostart({
    enabled: true,
    appName: 'Stream Deck DeeJ',
    autostartFile,
    executablePath: mountedExecutable,
    appImagePath: appImage,
    packagedIconPath: mountedIcon,
    persistentIconPath: persistentIcon
  })

  const entry = await readFile(autostartFile, 'utf8')
  expect(entry).toContain(`Exec="${appImage.replace('$', '\\$')}"`)
  expect(entry).toContain(`Icon=${persistentIcon}`)
  expect(entry).not.toContain('.mount_streamdeck')
  expect(await readFile(persistentIcon, 'utf8')).toBe('icon')
  expect((await stat(autostartFile)).mode & 0o777).toBe(0o600)
  expect((await stat(persistentIcon)).mode & 0o777).toBe(0o600)
  expect((await readdir(join(directory, 'config', 'autostart'))).sort()).toEqual([
    'streamdeck-deej.desktop'
  ])
})

test('rejects a relative AppImage path', async () => {
  const directory = await createTestDirectory()

  await expect(
    setLinuxAutostart({
      enabled: true,
      appName: 'StreamDeck DeeJ',
      autostartFile: join(directory, 'autostart', 'streamdeck-deej.desktop'),
      executablePath: '/tmp/.mount_streamdeck/streamdeck-deej',
      appImagePath: 'StreamDeckDeeJ.AppImage',
      packagedIconPath: join(directory, 'missing-icon.png'),
      persistentIconPath: join(directory, 'user-data', 'autostart-icon.png')
    })
  ).rejects.toThrow(/AppImage/)
})

test('rejects an executable AppImage stored in a temporary directory', async () => {
  const directory = await createTestDirectory()
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'streamdeck-appimage-test-'))
  testDirectories.push(temporaryDirectory)
  const appImagePath = join(temporaryDirectory, 'StreamDeckDeeJ.AppImage')
  await writeFile(appImagePath, 'appimage')
  await chmod(appImagePath, 0o700)

  await expect(
    setLinuxAutostart({
      enabled: true,
      appName: 'StreamDeck DeeJ',
      autostartFile: join(directory, 'autostart', 'streamdeck-deej.desktop'),
      executablePath: '/tmp/.mount_streamdeck/streamdeck-deej',
      appImagePath,
      packagedIconPath: join(directory, 'missing-icon.png'),
      persistentIconPath: join(directory, 'user-data', 'autostart-icon.png')
    })
  ).rejects.toThrow(/stable/)
})

test('rejects an AppImage path that references a directory', async () => {
  const directory = await createTestDirectory()
  const appImagePath = join(directory, 'StreamDeckDeeJ.AppImage')
  await mkdir(appImagePath)

  await expect(
    setLinuxAutostart({
      enabled: true,
      appName: 'StreamDeck DeeJ',
      autostartFile: join(directory, 'autostart', 'streamdeck-deej.desktop'),
      executablePath: '/tmp/.mount_streamdeck/streamdeck-deej',
      appImagePath,
      packagedIconPath: join(directory, 'missing-icon.png'),
      persistentIconPath: join(directory, 'user-data', 'autostart-icon.png')
    })
  ).rejects.toThrow(/file/)
})

test('rejects an AppImage that is not executable', async () => {
  const directory = await createTestDirectory()
  const appImage = join(directory, 'StreamDeckDeeJ.AppImage')
  await writeFile(appImage, 'appimage')
  await chmod(appImage, 0o600)

  await expect(
    setLinuxAutostart({
      enabled: true,
      appName: 'StreamDeck DeeJ',
      autostartFile: join(directory, 'autostart', 'streamdeck-deej.desktop'),
      executablePath: '/tmp/.mount_streamdeck/streamdeck-deej',
      appImagePath: appImage,
      packagedIconPath: join(directory, 'missing-icon.png'),
      persistentIconPath: join(directory, 'user-data', 'autostart-icon.png')
    })
  ).rejects.toThrow(/executable/)
})

test('keeps packaged executable and icon paths outside AppImage mode and escapes desktop fields', async () => {
  const directory = await createTestDirectory()
  const autostartFile = join(directory, 'autostart', 'streamdeck-deej.desktop')
  const executablePath = '/usr/lib/stream deck/streamdeck-`deej`"\\$%'
  const iconPath = '/usr/share/icons/stream deck\\logo.png'

  await setLinuxAutostart({
    enabled: true,
    appName: 'StreamDeck\nDeeJ\\Mixer',
    autostartFile,
    executablePath,
    packagedIconPath: iconPath,
    persistentIconPath: join(directory, 'unused.png')
  })

  expect(await readFile(autostartFile, 'utf8')).toBe(
    [
      '[Desktop Entry]',
      'Type=Application',
      'Name=StreamDeck\\nDeeJ\\\\Mixer',
      'Exec="/usr/lib/stream deck/streamdeck-\\`deej\\`\\"\\\\\\$%%"',
      'X-GNOME-Autostart-enabled=true',
      'StartupWMClass=streamdeck-deej',
      'Icon=/usr/share/icons/stream deck\\\\logo.png',
      ''
    ].join('\n')
  )
})

test('omits the AppImage icon when it cannot be persisted', async () => {
  const directory = await createTestDirectory()
  const appImage = join(directory, 'StreamDeckDeeJ.AppImage')
  const autostartFile = join(directory, 'autostart', 'streamdeck-deej.desktop')
  await writeFile(appImage, 'appimage')
  await chmod(appImage, 0o700)

  await setLinuxAutostart({
    enabled: true,
    appName: 'StreamDeck DeeJ',
    autostartFile,
    executablePath: '/tmp/.mount_streamdeck/streamdeck-deej',
    appImagePath: appImage,
    packagedIconPath: join(directory, 'missing-icon.png'),
    persistentIconPath: join(directory, 'user-data', 'autostart-icon.png')
  })

  expect(await readFile(autostartFile, 'utf8')).not.toContain('\nIcon=')
})

test('removes the desktop entry and persistent icon when autostart is disabled', async () => {
  const directory = await createTestDirectory()
  const autostartFile = join(directory, 'autostart', 'streamdeck-deej.desktop')
  const persistentIconPath = join(directory, 'user-data', 'autostart-icon.png')
  await mkdir(join(directory, 'autostart'))
  await mkdir(join(directory, 'user-data'))
  await writeFile(autostartFile, 'old entry')
  await writeFile(persistentIconPath, 'old icon')

  await setLinuxAutostart({
    enabled: false,
    appName: 'StreamDeck DeeJ',
    autostartFile,
    executablePath: '/usr/bin/streamdeck-deej',
    packagedIconPath: '/usr/share/icons/streamdeck-deej.png',
    persistentIconPath
  })

  await expect(stat(autostartFile)).rejects.toThrow()
  await expect(stat(persistentIconPath)).rejects.toThrow()
})

test('cleans up its temporary desktop file when the atomic rename fails', async () => {
  const directory = await createTestDirectory()
  const autostartDirectory = join(directory, 'autostart')
  const autostartFile = join(autostartDirectory, 'streamdeck-deej.desktop')
  await mkdir(autostartFile, { recursive: true })
  await writeFile(join(autostartFile, 'prevent-replacement'), 'content')

  await expect(
    setLinuxAutostart({
      enabled: true,
      appName: 'StreamDeck DeeJ',
      autostartFile,
      executablePath: '/usr/bin/streamdeck-deej',
      packagedIconPath: '/usr/share/icons/streamdeck-deej.png',
      persistentIconPath: join(directory, 'unused.png')
    })
  ).rejects.toThrow()
  expect(await readdir(autostartDirectory)).toEqual(['streamdeck-deej.desktop'])
})

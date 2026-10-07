import { readFileSync } from 'node:fs'
import { load } from 'js-yaml'
import { expect, test } from 'vitest'

const builder = load(readFileSync('electron-builder.yml', 'utf8')) as {
  pacman: { depends: string[] }
}
const ciWorkflow = readFileSync('.github/workflows/ci.yml', 'utf8')

function ciExpectedDependencies(): string[] {
  const match = ciWorkflow.match(/expected_dependencies=\(([^)]*)\)/)
  expect(match).not.toBeNull()
  return (match?.[1] ?? '').trim().split(/\s+/)
}

test('the CI package check expects exactly the declared pacman dependencies', () => {
  expect([...ciExpectedDependencies()].sort()).toEqual([...builder.pacman.depends].sort())
  expect(new Set(builder.pacman.depends).size).toBe(builder.pacman.depends.length)
})

test('declares the libraries and commands the packaged app actually needs', () => {
  expect(builder.pacman.depends).toEqual(
    expect.arrayContaining(['gtk3', 'nss', 'alsa-lib', 'libcups', 'mesa', 'libusb', 'systemd-libs'])
  )
  // pactl, pw-dump, wpctl and dbus-send are run by the audio and media services.
  expect(builder.pacman.depends).toEqual(
    expect.arrayContaining(['libpulse', 'pipewire', 'wireplumber', 'dbus'])
  )
})

test('does not depend on packages Electron bundles or that Arch no longer ships', () => {
  for (const obsolete of [
    'http-parser',
    'c-ares',
    'ffmpeg',
    'libevent',
    'libvpx',
    'libxslt',
    'minizip',
    're2',
    'snappy',
    'libappindicator-gtk3'
  ]) {
    expect(builder.pacman.depends).not.toContain(obsolete)
  }
})

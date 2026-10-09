import { afterEach, expect, test, vi } from 'vitest'
import { linuxXWaylandRelaunchArgs, xwaylandRelaunchArgs } from '@main/linux-display'

const fakes = vi.hoisted(() => ({ existsSync: vi.fn() }))
vi.mock('node:fs', () => ({ existsSync: fakes.existsSync }))

afterEach(() => {
  vi.unstubAllEnvs()
})

const nvidiaWayland = {
  platform: 'linux' as NodeJS.Platform,
  env: { XDG_SESSION_TYPE: 'wayland', DISPLAY: ':0' },
  argv: ['/opt/streamdeck-deej/streamdeck-deej', '--hidden'],
  hasNvidiaDriver: () => true
}

test('relaunches through XWayland on an NVIDIA Wayland session, keeping the arguments', () => {
  expect(xwaylandRelaunchArgs(nvidiaWayland)).toEqual(['--ozone-platform=x11', '--hidden'])
})

test.each([
  ['another platform', { platform: 'win32' as NodeJS.Platform }],
  ['an X11 session', { env: { XDG_SESSION_TYPE: 'x11', DISPLAY: ':0' } }],
  ['no XWayland server', { env: { XDG_SESSION_TYPE: 'wayland' } }],
  [
    'the dev server',
    { env: { XDG_SESSION_TYPE: 'wayland', DISPLAY: ':0', ELECTRON_RENDERER_URL: 'http://x' } }
  ],
  ['an explicit backend', { argv: ['electron', '--ozone-platform=wayland', '.'] }],
  ['an already relaunched process', { argv: ['electron', '--ozone-platform=x11', '.'] }],
  ['another GPU driver', { hasNvidiaDriver: () => false }]
])('starts normally with %s', (_case, override) => {
  expect(xwaylandRelaunchArgs({ ...nvidiaWayland, ...override })).toBeUndefined()
})

test('reads the running process and probes the NVIDIA driver', () => {
  vi.stubEnv('XDG_SESSION_TYPE', 'wayland')
  vi.stubEnv('DISPLAY', ':0')
  vi.stubEnv('ELECTRON_RENDERER_URL', '')
  fakes.existsSync.mockReturnValue(true)

  const args = linuxXWaylandRelaunchArgs()

  if (process.platform === 'linux') {
    expect(args?.[0]).toBe('--ozone-platform=x11')
    expect(fakes.existsSync).toHaveBeenCalledWith('/proc/driver/nvidia/version')
  } else {
    expect(args).toBeUndefined()
  }
})

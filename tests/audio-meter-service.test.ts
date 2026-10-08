import { EventEmitter } from 'node:events'
import type { ChildProcess } from 'node:child_process'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'
import { peakToLevel } from '@main/services/audio-level'

vi.mock('@main/services/logger.service', () => ({
  loggerService: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

const { AudioMeterService, MAX_MONITORS } = await import('@main/services/audio-meter.service')

class FakeChild extends EventEmitter {
  readonly stdout = new EventEmitter()
  readonly stderr = new EventEmitter()
  exitCode: number | null = null
  signalCode: NodeJS.Signals | null = null
  readonly kill = vi.fn((signal: NodeJS.Signals) => {
    this.signalCode = signal
    queueMicrotask(() => this.emit('close'))
    return true
  })

  constructor(
    readonly command: string,
    readonly args: readonly string[]
  ) {
    super()
  }

  sound(peak: number): void {
    const buffer = Buffer.alloc(4)
    buffer.writeInt16LE(Math.round(peak * 32767), 0)
    this.stdout.emit('data', buffer)
  }
}

interface Harness {
  meter: InstanceType<typeof AudioMeterService>
  children: FakeChild[]
  runs: Array<{ file: string; args: readonly string[] }>
  levels: Array<Record<string, number>>
  alive(): FakeChild[]
  find(arg: string): FakeChild | undefined
}

function outputStreams(count = 0): object[] {
  return [
    {
      id: 7,
      type: 'PipeWire:Interface:Client',
      info: { props: { 'application.name': 'Spotify' } }
    },
    {
      id: 77,
      type: 'PipeWire:Interface:Node',
      info: { props: { 'media.class': 'Stream/Output/Audio', 'client.id': 7 } }
    },
    {
      id: 78,
      type: 'PipeWire:Interface:Node',
      info: {
        props: {
          'media.class': 'Stream/Output/Audio',
          'application.name': 'Firefox',
          'application.process.id': '3368'
        }
      }
    },
    ...Array.from({ length: count }, (_, index) => ({
      id: 200 + index,
      type: 'PipeWire:Interface:Node',
      info: {
        props: {
          'media.class': 'Stream/Output/Audio',
          'application.name': `App${index}`,
          'application.process.id': String(9000 + index)
        }
      }
    }))
  ]
}

function harness(
  options: { pwLinkFails?: boolean; extraApps?: number; sinkInputsForAll?: boolean } = {}
): Harness {
  const children: FakeChild[] = []
  const runs: Harness['runs'] = []
  const levels: Harness['levels'] = []
  let nextId = 0
  const sinkInputs = [
    'Sink Input #448\n\tapplication.process.id = "3368"\n',
    ...(options.sinkInputsForAll
      ? Array.from(
          { length: options.extraApps ?? 0 },
          (_, index) => `Sink Input #${600 + index}\n\tapplication.process.id = "${9000 + index}"\n`
        )
      : [])
  ].join('')

  const meter = new AudioMeterService({
    createId: () => `id-${(nextId += 1)}`,
    spawn: (command, args) => {
      const child = new FakeChild(command, args)
      children.push(child)
      return child as unknown as ChildProcess
    },
    runner: {
      async run(file, args) {
        runs.push({ file, args })
        if (file === 'pactl') {
          return sinkInputs
        }
        if (file === 'pw-link') {
          if (options.pwLinkFails) {
            throw new Error('link failed')
          }
          return ''
        }
        const captures = children
          .filter((child) => child.command === 'pw-record' && child.signalCode === null)
          .map((child, index) => ({
            id: 500 + index,
            type: 'PipeWire:Interface:Node',
            info: {
              props: {
                'media.class': 'Stream/Input/Audio',
                'node.name': child.args
                  .find((arg) => arg.startsWith('--prop=node.name='))
                  ?.slice('--prop=node.name='.length)
              }
            }
          }))
        return JSON.stringify([...outputStreams(options.extraApps), ...captures])
      }
    }
  })
  meter.on('levels', (value: Record<string, number>) => levels.push(value))

  return {
    meter,
    children,
    runs,
    levels,
    alive: () => children.filter((child) => child.signalCode === null && child.exitCode === null),
    find: (arg) =>
      children.find(
        (child) => child.signalCode === null && child.exitCode === null && child.args.includes(arg)
      )
  }
}

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

test('meters master, PulseAudio-compatible and PipeWire-native sessions', async () => {
  const h = harness()
  h.meter.updateConfig({ '0': ['master'], '1': ['firefox'], '2': ['Spotify'], '3': [] })
  await vi.advanceTimersByTimeAsync(0)

  const captures = h.alive().map((child) => [child.command, child.args[0], child.args[1]])
  expect(captures).toHaveLength(3)
  expect(captures).toEqual(
    expect.arrayContaining([
      ['parec', '--device=@DEFAULT_MONITOR@', '--raw'],
      ['parec', '--monitor-stream=448', '--raw'],
      ['pw-record', '--prop=node.autoconnect=false', '--prop=node.name=streamdeck-deej-meter-id-1']
    ])
  )

  await vi.advanceTimersByTimeAsync(200)
  expect(h.runs).toContainEqual({ file: 'pw-link', args: ['77', '500'] })
  h.meter.shutdown()
})

test('emits per-slider levels, decays them, and stops sending silence', async () => {
  const h = harness()
  h.meter.updateConfig({ '0': ['firefox'], '1': ['firefox', 'spotify'] })
  await vi.advanceTimersByTimeAsync(0)

  h.find('--monitor-stream=448')?.sound(0.5)
  await vi.advanceTimersByTimeAsync(33)
  expect(h.levels.at(-1)?.['0']).toBeCloseTo(peakToLevel(0.5), 5)
  expect(h.levels.at(-1)?.['1']).toBeCloseTo(peakToLevel(0.5), 5)

  await vi.advanceTimersByTimeAsync(33 * 40)
  const emitted = h.levels.length
  expect(h.levels.at(-1)).toEqual({ '0': 0, '1': 0 })
  await vi.advanceTimersByTimeAsync(33 * 10)
  expect(h.levels).toHaveLength(emitted)
  h.meter.shutdown()
})

test('stops every capture while hidden and resumes when shown again', async () => {
  const h = harness()
  h.meter.updateConfig({ '0': ['master'] })
  await vi.advanceTimersByTimeAsync(0)
  h.find('--device=@DEFAULT_MONITOR@')?.sound(1)
  await vi.advanceTimersByTimeAsync(33)

  h.meter.setActive(false)
  await vi.advanceTimersByTimeAsync(10_000)
  expect(h.alive()).toHaveLength(0)
  expect(h.levels.at(-1)).toEqual({})

  h.meter.setActive(true)
  await vi.advanceTimersByTimeAsync(0)
  expect(h.alive().map((child) => child.args[0])).toEqual(['--device=@DEFAULT_MONITOR@'])
  h.meter.shutdown()
})

test('does nothing without mapped sessions and ignores unchanged configuration', async () => {
  const h = harness()
  h.meter.updateConfig({ '0': [] })
  await vi.advanceTimersByTimeAsync(10_000)
  expect(h.children).toHaveLength(0)
  expect(h.runs).toHaveLength(0)

  h.meter.updateConfig({ '0': ['firefox'] })
  await vi.advanceTimersByTimeAsync(0)
  const runs = h.runs.length
  h.meter.updateConfig({ '0': ['firefox'] })
  await vi.advanceTimersByTimeAsync(0)
  expect(h.runs).toHaveLength(runs)
  h.meter.shutdown()
})

test('follows reconfiguration and app restarts on the next scan', async () => {
  const h = harness()
  h.meter.updateConfig({ '0': ['firefox'] })
  await vi.advanceTimersByTimeAsync(0)
  const firefox = h.find('--monitor-stream=448')

  h.meter.updateConfig({ '0': ['master'] })
  await vi.advanceTimersByTimeAsync(0)
  expect(firefox?.kill).toHaveBeenCalledWith('SIGTERM')
  const master = h.find('--device=@DEFAULT_MONITOR@')
  expect(master).toBeDefined()

  // The capture exits on its own (e.g. PipeWire restarted): it is restarted.
  const spawned = h.children.length
  if (master) {
    master.exitCode = 1
    master.emit('close')
  }
  await vi.advanceTimersByTimeAsync(2_000)
  expect(h.children).toHaveLength(spawned + 1)
  expect(h.find('--device=@DEFAULT_MONITOR@')).not.toBe(master)
  h.meter.shutdown()
})

test('stops an unlinked pw-record when pw-link fails', async () => {
  const h = harness({ pwLinkFails: true })
  h.meter.updateConfig({ '0': ['spotify'] })
  await vi.advanceTimersByTimeAsync(0)
  const recorder = h.find('-')
  expect(recorder?.command).toBe('pw-record')

  await vi.advanceTimersByTimeAsync(200)
  expect(recorder?.kill).toHaveBeenCalledWith('SIGTERM')
  h.meter.shutdown()
})

test('never respawns a missing capture command', async () => {
  const h = harness()
  h.meter.updateConfig({ '0': ['master'] })
  await vi.advanceTimersByTimeAsync(0)
  const parec = h.children[0]
  parec.emit('error', Object.assign(new Error('spawn parec ENOENT'), { code: 'ENOENT' }))
  parec.exitCode = -2
  parec.emit('close')

  await vi.advanceTimersByTimeAsync(20_000)
  expect(h.children).toHaveLength(1)
  h.meter.shutdown()
})

test(`caps concurrent captures at ${MAX_MONITORS}`, async () => {
  const h = harness({ extraApps: 30, sinkInputsForAll: true })
  h.meter.updateConfig(
    Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [String(i), [`app${i}`, `app${i + 16}`]])
    )
  )
  await vi.advanceTimersByTimeAsync(0)
  expect(h.alive()).toHaveLength(MAX_MONITORS)
  h.meter.shutdown()
})

test('kills every capture on shutdown and schedules no further work', async () => {
  const h = harness()
  h.meter.updateConfig({ '0': ['master'], '1': ['firefox'], '2': ['spotify'] })
  await vi.advanceTimersByTimeAsync(0)
  h.meter.shutdown()
  await vi.advanceTimersByTimeAsync(0)
  expect(h.alive()).toHaveLength(0)

  const spawned = h.children.length
  const runs = h.runs.length
  await vi.advanceTimersByTimeAsync(30_000)
  expect(h.children).toHaveLength(spawned)
  expect(h.runs).toHaveLength(runs)
})

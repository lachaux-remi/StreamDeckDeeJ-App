import { EventEmitter } from 'node:events'
import { beforeEach, expect, test, vi } from 'vitest'

interface PortOptions {
  path: string
  baudRate: number
}

class FakeSerialPort extends EventEmitter {
  static instances: FakeSerialPort[] = []
  static list = vi.fn().mockResolvedValue([])
  readonly closeCallbacks: Array<() => void> = []
  readonly options: PortOptions
  openCallback: ((error: Error | null) => void) | undefined
  isOpen = false
  write = vi.fn((_data: string, callback?: (error?: Error) => void) => callback?.())

  constructor(options: PortOptions) {
    super()
    this.options = options
    FakeSerialPort.instances.push(this)
  }

  open(callback: (error: Error | null) => void): void {
    this.openCallback = callback
  }

  close(callback: () => void): void {
    this.closeCallbacks.push(callback)
  }
}

const fakes = vi.hoisted(() => ({
  onUpdated: undefined as ((config: Record<string, unknown>) => void) | undefined,
  error: vi.fn()
}))

vi.mock('serialport', () => ({ SerialPort: FakeSerialPort }))

vi.mock('@main/services/config.service', () => ({
  configService: {
    onUpdated: vi.fn((listener: (config: Record<string, unknown>) => void) => {
      fakes.onUpdated = listener
    })
  }
}))

vi.mock('@main/services/logger.service', () => ({
  loggerService: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: fakes.error
  }
}))

async function settle(): Promise<void> {
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  FakeSerialPort.instances = []
  fakes.onUpdated = undefined
  fakes.error.mockReset()
})

test('coalesces open failure and close into one cancellable reconnect timer', async () => {
  await import('@main/services/serial.service')
  fakes.onUpdated?.({ comPort: '/dev/ttyUSB0', baudRate: 9_600 })
  await settle()
  const port = FakeSerialPort.instances[0]

  port.openCallback?.(new Error('open failed'))
  port.emit('close')

  expect(vi.getTimerCount()).toBe(1)
  await vi.advanceTimersByTimeAsync(999)
  expect(FakeSerialPort.instances).toHaveLength(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(FakeSerialPort.instances).toHaveLength(2)

  const reconnectedPort = FakeSerialPort.instances[1]
  reconnectedPort.isOpen = true
  reconnectedPort.openCallback?.(null)
  expect(vi.getTimerCount()).toBe(1)
  reconnectedPort.emit('error', new Error('connection lost before ready'))
  expect(reconnectedPort.closeCallbacks).toHaveLength(1)
  expect(vi.getTimerCount()).toBe(0)
  reconnectedPort.isOpen = false
  reconnectedPort.closeCallbacks[0]()
  expect(vi.getTimerCount()).toBe(1)
})

test('serializes rapid configuration reloads and opens only the latest epoch', async () => {
  await import('@main/services/serial.service')
  fakes.onUpdated?.({ comPort: '/dev/ttyUSB0', baudRate: 9_600, sliderCount: 4 })
  await settle()
  const firstPort = FakeSerialPort.instances[0]
  firstPort.isOpen = true
  firstPort.openCallback?.(null)
  vi.clearAllTimers()

  fakes.onUpdated?.({ comPort: '/dev/ttyUSB1', baudRate: 57_600, sliderCount: 4 })
  fakes.onUpdated?.({ comPort: '/dev/ttyACM0', baudRate: 115_200, sliderCount: 4 })
  await settle()

  expect(firstPort.closeCallbacks).toHaveLength(1)
  firstPort.isOpen = false
  firstPort.closeCallbacks[0]()
  await settle()

  expect(FakeSerialPort.instances.map(({ options }) => options)).toEqual([
    expect.objectContaining({ path: '/dev/ttyUSB0', baudRate: 9_600 }),
    expect.objectContaining({ path: '/dev/ttyACM0', baudRate: 115_200 })
  ])
})

test('cancels obsolete reconnect and ready timers during reconfiguration and shutdown', async () => {
  const { serialService } = await import('@main/services/serial.service')
  fakes.onUpdated?.({ comPort: '/dev/ttyUSB0', baudRate: 9_600 })
  await settle()
  const firstPort = FakeSerialPort.instances[0]

  firstPort.openCallback?.(new Error('open failed'))
  expect(vi.getTimerCount()).toBe(1)
  fakes.onUpdated?.({ comPort: '/dev/ttyACM0', baudRate: 115_200 })
  await settle()
  expect(vi.getTimerCount()).toBe(0)

  const shutdown = serialService.shutdown()
  await settle()
  FakeSerialPort.instances[1].closeCallbacks[0]()
  await shutdown
  expect(vi.getTimerCount()).toBe(0)
  await vi.advanceTimersByTimeAsync(5_000)
  expect(FakeSerialPort.instances).toHaveLength(2)
})

test('reports official ports first and preserves manufacturer metadata when sysfs is unavailable', async () => {
  FakeSerialPort.list.mockResolvedValueOnce([
    { path: '/dev/ttyUSB0', manufacturer: 'Generic', vendorId: '1234', productId: '5678' },
    { path: '/dev/ttyACM0', manufacturer: 'Official', vendorId: '5239', productId: '0001' }
  ])
  const { serialService } = await import('@main/services/serial.service')

  await expect(serialService.listPorts()).resolves.toEqual([
    {
      path: '/dev/ttyACM0',
      displayName: 'Official (/dev/ttyACM0)',
      manufacturer: 'Official',
      official: true
    },
    {
      path: '/dev/ttyUSB0',
      displayName: 'Generic (/dev/ttyUSB0)',
      manufacturer: 'Generic',
      official: false
    }
  ])
})

test('emits connection status, sends readiness, parses runtime data, and closes cleanly', async () => {
  const { serialService } = await import('@main/services/serial.service')
  const statuses: unknown[] = []
  const deckEvents: unknown[] = []
  serialService.on('status', (status) => statuses.push(status))
  serialService.on('serial:deck', (event) => deckEvents.push(event))
  fakes.onUpdated?.({ comPort: '/dev/ttyACM0', baudRate: 115_200 })
  await settle()
  const port = FakeSerialPort.instances[0]
  port.isOpen = true
  port.openCallback?.(null)

  expect(serialService.getStatus()).toEqual({ connected: true, port: '/dev/ttyACM0' })
  expect(statuses).toEqual([{ connected: true, port: '/dev/ttyACM0' }])
  await vi.advanceTimersByTimeAsync(500)
  expect(port.write).toHaveBeenCalledWith('app:ready\r\n')
  port.emit('data', Buffer.from('{"type":"deck","state":"pressed","value":3}\r\n'))
  expect(deckEvents).toEqual([{ state: 'pressed', value: 3 }])

  const shutdown = serialService.shutdown()
  await settle()
  expect(port.closeCallbacks).toHaveLength(1)
  port.isOpen = false
  port.closeCallbacks[0]()
  await shutdown
  expect(serialService.getStatus()).toEqual({ connected: false, port: '/dev/ttyACM0' })
  expect(vi.getTimerCount()).toBe(0)
})

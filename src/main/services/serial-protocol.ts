export const MAX_SERIAL_FRAME_BYTES = 512
export const MAX_SERIAL_FRAMES_PER_SECOND = 200

const MAX_DECK_INDEX = 63
const MAX_SLIDER_INDEX = 15
const IR_ECHO_TTL_MS = 5_000
const MAX_PENDING_IR_ECHOES = 16

export type SerialRejectionReason =
  | 'frame too large'
  | 'frame rate exceeded'
  | 'invalid JSON'
  | 'invalid message shape'
  | 'unknown message type'

export interface DeejSerialMessage {
  type: 'deej'
  value: Record<string, number>
}

export interface DeckSerialMessage {
  type: 'deck'
  state: 'pressed' | 'hold' | 'released'
  value: number
}

export type SerialMessage = DeejSerialMessage | DeckSerialMessage

interface DecoderResult {
  frames: Buffer[]
  rejections: SerialRejectionReason[]
}

interface PendingIrEcho {
  payload: string
  expiresAt: number
}

export class ExpectedIrEchoTracker {
  private pending: PendingIrEcho[] = []

  public recordCommand(command: string, now = Date.now()): void {
    const normalized = command.replace(/\r?\n$/, '')
    if (!normalized.startsWith('ir:')) {
      return
    }

    const payload = normalized.slice(3)
    if (!/^\d+(?:,\d+)*$/.test(payload)) {
      return
    }

    this.pending.push({ payload, expiresAt: now + IR_ECHO_TTL_MS })
    if (this.pending.length > MAX_PENDING_IR_ECHOES) {
      this.pending.shift()
    }
  }

  public consume(frame: Buffer, now = Date.now()): boolean {
    this.pending = this.pending.filter((echo) => echo.expiresAt >= now)
    const index = this.pending.findIndex((echo) => echo.payload === frame.toString('utf8'))
    if (index === -1) {
      return false
    }

    this.pending.splice(index, 1)
    return true
  }

  public clear(): void {
    this.pending = []
  }
}

export class BoundedSerialFrameDecoder {
  private readonly buffer: number[] = []
  private readonly maxFrameBytes: number
  private readonly maxFramesPerSecond: number
  private pendingCarriageReturn = false
  private discardingOversizedFrame = false
  private windowStartedAt = 0
  private framesInWindow = 0

  public constructor(
    maxFrameBytes = MAX_SERIAL_FRAME_BYTES,
    maxFramesPerSecond = MAX_SERIAL_FRAMES_PER_SECOND
  ) {
    this.maxFrameBytes = maxFrameBytes
    this.maxFramesPerSecond = maxFramesPerSecond
  }

  public write(chunk: Buffer, now = Date.now()): DecoderResult {
    const result: DecoderResult = { frames: [], rejections: [] }

    for (const byte of chunk) {
      if (this.pendingCarriageReturn) {
        this.pendingCarriageReturn = false
        if (byte === 0x0a) {
          this.finishFrame(now, result)
          continue
        }
        this.appendByte(0x0d, result)
      }

      if (byte === 0x0d) {
        this.pendingCarriageReturn = true
      } else {
        this.appendByte(byte, result)
      }
    }

    return result
  }

  public get bufferedByteLength(): number {
    return this.buffer.length + (this.pendingCarriageReturn ? 1 : 0)
  }

  private appendByte(byte: number, result: DecoderResult): void {
    if (this.discardingOversizedFrame) {
      return
    }

    if (this.buffer.length >= this.maxFrameBytes) {
      this.buffer.length = 0
      this.discardingOversizedFrame = true
      result.rejections.push('frame too large')
      return
    }

    this.buffer.push(byte)
  }

  private finishFrame(now: number, result: DecoderResult): void {
    if (this.discardingOversizedFrame) {
      this.discardingOversizedFrame = false
      this.buffer.length = 0
      return
    }

    if (now < this.windowStartedAt || now - this.windowStartedAt >= 1_000) {
      this.windowStartedAt = now
      this.framesInWindow = 0
    }

    this.framesInWindow += 1
    if (this.framesInWindow > this.maxFramesPerSecond) {
      this.buffer.length = 0
      result.rejections.push('frame rate exceeded')
      return
    }

    result.frames.push(Buffer.from(this.buffer))
    this.buffer.length = 0
  }
}

export function parseSerialFrame(
  frame: Buffer
): { message: SerialMessage } | { rejection: SerialRejectionReason } {
  let value: unknown
  try {
    value = JSON.parse(frame.toString('utf8'))
  } catch {
    return { rejection: 'invalid JSON' }
  }

  if (!isRecord(value) || typeof value.type !== 'string') {
    return { rejection: 'invalid message shape' }
  }

  if (value.type === 'deej') {
    return isDeejMessage(value) ? { message: value } : { rejection: 'invalid message shape' }
  }

  if (value.type === 'deck') {
    return isDeckMessage(value) ? { message: value } : { rejection: 'invalid message shape' }
  }

  return { rejection: 'unknown message type' }
}

function isDeejMessage(
  value: Record<string, unknown>
): value is Record<string, unknown> & DeejSerialMessage {
  if (!hasExactKeys(value, ['type', 'value']) || !isRecord(value.value)) {
    return false
  }

  const entries = Object.entries(value.value)
  if (entries.length === 0 || entries.length > MAX_SLIDER_INDEX + 1) {
    return false
  }

  return entries.every(([index, sliderValue]) => {
    const numericIndex = Number(index)
    return (
      /^(0|[1-9]\d*)$/.test(index) &&
      Number.isInteger(numericIndex) &&
      numericIndex <= MAX_SLIDER_INDEX &&
      typeof sliderValue === 'number' &&
      Number.isInteger(sliderValue) &&
      sliderValue >= 0 &&
      sliderValue <= 1023
    )
  })
}

function isDeckMessage(
  value: Record<string, unknown>
): value is Record<string, unknown> & DeckSerialMessage {
  return (
    hasExactKeys(value, ['type', 'state', 'value']) &&
    (value.state === 'pressed' || value.state === 'hold' || value.state === 'released') &&
    typeof value.value === 'number' &&
    Number.isInteger(value.value) &&
    value.value >= 0 &&
    value.value <= MAX_DECK_INDEX
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: Record<string, unknown>, expected: string[]): boolean {
  const keys = Object.keys(value)
  return keys.length === expected.length && expected.every((key) => keys.includes(key))
}

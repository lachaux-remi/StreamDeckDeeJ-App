export const MAX_DISCORD_RPC_FRAME_BYTES = 1024 * 1024
export const MAX_DISCORD_RPC_BUFFER_BYTES = MAX_DISCORD_RPC_FRAME_BYTES + 8

export interface DiscordRpcFrame {
  op: number
  payload: string
}

export class DiscordRpcFrameReader {
  private buffer = Buffer.alloc(0)
  private rejected = false

  constructor(private readonly destroyConnection: () => void) {}

  get bufferedBytes(): number {
    return this.buffer.length
  }

  reset(): void {
    this.buffer = Buffer.alloc(0)
    this.rejected = false
  }

  push(data: Buffer): DiscordRpcFrame[] {
    if (this.rejected) {
      return []
    }
    const frames: DiscordRpcFrame[] = []
    let offset = 0
    while (offset < data.length) {
      if (this.buffer.length < 8) {
        const headerBytes = Math.min(8 - this.buffer.length, data.length - offset)
        this.buffer = Buffer.concat([this.buffer, data.subarray(offset, offset + headerBytes)])
        offset += headerBytes
        if (this.buffer.length < 8) {
          break
        }
      }

      const payloadLength = this.buffer.readUInt32LE(4)
      if (payloadLength > MAX_DISCORD_RPC_FRAME_BYTES) {
        this.rejectConnection()
        return []
      }
      const frameLength = 8 + payloadLength
      const payloadBytes = Math.min(frameLength - this.buffer.length, data.length - offset)
      this.buffer = Buffer.concat([this.buffer, data.subarray(offset, offset + payloadBytes)])
      offset += payloadBytes
      if (this.buffer.length < frameLength) {
        break
      }
      frames.push({
        op: this.buffer.readUInt32LE(0),
        payload: this.buffer.subarray(8, frameLength).toString('utf8')
      })
      this.buffer = Buffer.alloc(0)
    }
    return frames
  }

  private rejectConnection(): void {
    this.buffer = Buffer.alloc(0)
    this.rejected = true
    this.destroyConnection()
  }
}

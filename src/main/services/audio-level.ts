/** Levels map -60 dBFS…0 dBFS onto 0…1. */
export const LEVEL_FLOOR_DB = -60

/** Converts a linear peak (0…1) to a meter level (0…1) on a decibel scale. */
export function peakToLevel(peak: number): number {
  if (!(peak > 1e-6)) {
    return 0
  }
  const db = 20 * Math.log10(peak)
  return Math.max(0, Math.min(1, (db - LEVEL_FLOOR_DB) / -LEVEL_FLOOR_DB))
}

/**
 * Reads the peak of a raw signed 16-bit little-endian mono stream. Stream
 * chunks may split a sample, so a trailing odd byte is kept for the next chunk.
 */
export class S16PeakReader {
  private pending: Buffer | null = null

  push(chunk: Buffer): number {
    const data = this.pending ? Buffer.concat([this.pending, chunk]) : chunk
    const usable = data.length - (data.length % 2)
    this.pending = usable < data.length ? data.subarray(usable) : null

    let peak = 0
    for (let offset = 0; offset < usable; offset += 2) {
      const sample = Math.abs(data.readInt16LE(offset)) / 32768
      if (sample > peak) {
        peak = sample
      }
    }
    return peak
  }
}

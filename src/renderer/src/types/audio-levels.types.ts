/** Maximum DeeJ sliders, mirroring the sliderCount bound of the settings schema. */
const MAX_SLIDERS = 16

/** Validates the per-slider audio levels (0…1) pushed by the main process. */
export function isAudioLevels(value: unknown): value is Record<string, number> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  const entries = Object.entries(value)
  return (
    entries.length <= MAX_SLIDERS &&
    entries.every(
      ([key, level]) =>
        /^\d{1,2}$/.test(key) &&
        typeof level === 'number' &&
        Number.isFinite(level) &&
        level >= 0 &&
        level <= 1
    )
  )
}

import type {
  LedColor,
  LedConditionEffect,
  LedPressEffect,
  LedProfile
} from '@main/types/settings.types'

// OpenLinkHub-style 5-segment piecewise rainbow (Red→Yellow→Green→Cyan→Blue→Red)
function rainbowColor(position: number): LedColor {
  position = ((position % 1) + 1) % 1
  const seg = (
    r1: number,
    g1: number,
    b1: number,
    r2: number,
    g2: number,
    b2: number,
    t: number
  ): LedColor => ({
    r: Math.round((r1 + (r2 - r1) * t) * 255),
    g: Math.round((g1 + (g2 - g1) * t) * 255),
    b: Math.round((b1 + (b2 - b1) * t) * 255)
  })
  if (position < 0.2) {
    return seg(1, 0, 0, 1, 1, 0, position / 0.2)
  }
  if (position < 0.4) {
    return seg(1, 1, 0, 0, 1, 0, (position - 0.2) / 0.2)
  }
  if (position < 0.6) {
    return seg(0, 1, 0, 0, 1, 1, (position - 0.4) / 0.2)
  }
  if (position < 0.8) {
    return seg(0, 1, 1, 0, 0, 1, (position - 0.6) / 0.2)
  }
  return seg(0, 0, 1, 1, 0, 0, (position - 0.8) / 0.2)
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.max(0, Math.min(1, t))
}

function interpolateColor(c1: LedColor, c2: LedColor, t: number): LedColor {
  return {
    r: Math.round(lerp(c1.r, c2.r, t)),
    g: Math.round(lerp(c1.g, c2.g, t)),
    b: Math.round(lerp(c1.b, c2.b, t))
  }
}

export function applyBrightness(c: LedColor, brightness: number): LedColor {
  const b = Math.max(0, Math.min(1, brightness / 100))
  return { r: Math.round(c.r * b), g: Math.round(c.g * b), b: Math.round(c.b * b) }
}

// speed 1-100 → ms per cycle: speed=100 → 300ms, speed=50 → ~2500ms, speed=1 → 20000ms
function speedToMs(speed: number): number {
  const t = Math.max(1, Math.min(100, speed)) / 100
  return Math.round(300 * Math.pow(20000 / 300, 1 - t))
}

const BLACK: LedColor = { r: 0, g: 0, b: 0 }

// Deterministic 0-1 pseudo-random value per (a, b, c), so random-looking
// effects need no state and give the same frame for the same time.
function hash(a: number, b: number, c = 0): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263) ^ Math.imul(c | 0, 2147483647)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
}

// Smoothly interpolated noise along time for one LED.
function valueNoise(seed: number, x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const smooth = f * f * (3 - 2 * f)
  return lerp(hash(seed, i, 7), hash(seed, i + 1, 7), smooth)
}

// Black → startColor → endColor as heat rises from 0 to 1.
function heatColor(heat: number, cool: LedColor, hot: LedColor): LedColor {
  return heat < 0.5
    ? interpolateColor(BLACK, cool, heat * 2)
    : interpolateColor(cool, hot, (heat - 0.5) * 2)
}

const FLASH_MS = 400
const RIPPLE_MS_PER_KEY = 90
const RIPPLE_WIDTH = 0.9
const BLINK_MS = 500
const CONDITION_PULSE_MS = 1500

/** Key presses still drawing feedback, by LED index and press time. */
export interface LedPress {
  index: number
  at: number
}

/** How long a press effect lasts on a grid, so finished presses can be dropped. */
export function pressEffectDuration(
  effect: LedPressEffect,
  ledCount: number,
  gridCols: number
): number {
  if (effect.type === 'flash') {
    return FLASH_MS
  }
  const gridRows = Math.ceil(ledCount / gridCols)
  return (Math.hypot(gridCols, gridRows) + RIPPLE_WIDTH) * RIPPLE_MS_PER_KEY
}

/**
 * Draws press feedback over the frame: a flash fades out on the pressed key,
 * a ripple is a ring growing from it across the grid.
 */
export function applyPressEffect(
  colors: LedColor[],
  effect: LedPressEffect,
  presses: LedPress[],
  gridCols: number,
  brightness: number,
  t: number
): LedColor[] {
  const color = applyBrightness(effect.color, brightness)
  return colors.map((base, i) => {
    let amount = 0
    for (const press of presses) {
      const age = t - press.at
      if (age < 0) {
        continue
      }
      if (effect.type === 'flash') {
        if (press.index === i) {
          amount = Math.max(amount, 1 - age / FLASH_MS)
        }
        continue
      }
      const distance = Math.hypot(
        (i % gridCols) - (press.index % gridCols),
        Math.floor(i / gridCols) - Math.floor(press.index / gridCols)
      )
      const radius = age / RIPPLE_MS_PER_KEY
      const ring = 1 - Math.abs(distance - radius) / RIPPLE_WIDTH
      const fade = 1 - radius / (Math.hypot(gridCols, Math.ceil(colors.length / gridCols)) + 1)
      amount = Math.max(amount, ring * fade)
    }
    return amount > 0 ? interpolateColor(base, color, amount) : base
  })
}

/** Intensity 0-1 of an active condition color at time t. */
export function conditionIntensity(effect: LedConditionEffect | undefined, t: number): number {
  if (effect === 'blink') {
    return Math.floor(t / BLINK_MS) % 2 === 0 ? 1 : 0
  }
  if (effect === 'pulse') {
    // Never fully dark, so the key stays readable between beats.
    return 0.15 + 0.85 * ((Math.cos((2 * Math.PI * t) / CONDITION_PULSE_MS) + 1) / 2)
  }
  return 1
}

export function scaleColor(c: LedColor, intensity: number): LedColor {
  return interpolateColor(BLACK, c, intensity)
}

export class LedEngine {
  compute(profile: LedProfile, ledCount: number, gridCols: number, t: number): LedColor[] {
    const { mode, speed, brightness, startColor, endColor, direction } = profile
    const elapsedMs = t
    const elapsedSeconds = t / 1000
    const cycleMs = speedToMs(speed)
    const cycleSeconds = cycleMs / 1000
    const gridRows = Math.ceil(ledCount / gridCols)
    const spatialCount =
      direction === 'horizontal'
        ? gridCols
        : direction === 'vertical'
          ? gridRows
          : gridCols + gridRows - 1 // diagonal: col+row ranges 0 → (cols+rows-2)

    const getSpatialIndex = (i: number): number => {
      const col = i % gridCols
      const row = Math.floor(i / gridCols)
      if (direction === 'horizontal') {
        return col
      }
      if (direction === 'vertical') {
        return row
      }
      return col + row
    }

    switch (mode) {
      case 'static':
        return Array.from({ length: ledCount }, () => applyBrightness(startColor, brightness))

      case 'rainbow': {
        // OpenLinkHub: position = (i / channels) + elapsed / cycleSeconds
        const timePos = elapsedSeconds / cycleSeconds
        return Array.from({ length: ledCount }, (_, i) => {
          const position = i / ledCount + timePos
          return applyBrightness(rainbowColor(position), brightness)
        })
      }

      case 'wave': {
        // One full wave passes across the grid every cycleMs milliseconds.
        // spatialFraction 0→1 spans the grid; the wave moves forward continuously.
        const T = cycleMs
        return Array.from({ length: ledCount }, (_, i) => {
          const spatialIndex = getSpatialIndex(i)
          const spatialFraction = spatialIndex / Math.max(1, spatialCount - 1)
          const phase = 2 * Math.PI * (spatialFraction - elapsedMs / T)
          const intensity = (Math.sin(phase) + 1) / 2
          const base = interpolateColor(startColor, endColor, intensity)
          // Double-apply intensity like OpenLinkHub: bright peaks, dark troughs
          const brt = brightness / 100
          return {
            r: Math.round(base.r * intensity * brt),
            g: Math.round(base.g * intensity * brt),
            b: Math.round(base.b * intensity * brt)
          }
        })
      }

      case 'pulse': {
        // Sine breathing: all LEDs breathe between black and startColor
        const progress = (elapsedMs % cycleMs) / cycleMs
        const intensity = (Math.sin(progress * 2 * Math.PI) + 1) / 2
        const color = applyBrightness(interpolateColor(BLACK, startColor, intensity), brightness)
        return Array.from({ length: ledCount }, () => ({ ...color }))
      }

      case 'colorshift': {
        // OpenLinkHub: even cycles start→end, odd cycles end→start (linear, no sine)
        const totalProgress = elapsedMs / cycleMs
        const cycleProgress = totalProgress % 1.0
        const cycleCount = Math.floor(totalProgress)
        const color =
          cycleCount % 2 === 0
            ? applyBrightness(interpolateColor(startColor, endColor, cycleProgress), brightness)
            : applyBrightness(interpolateColor(endColor, startColor, cycleProgress), brightness)
        return Array.from({ length: ledCount }, () => ({ ...color }))
      }

      case 'visor': {
        // Gaussian beam ping-pong: sweeps left→right then right→left (no jump)
        const progress = (elapsedMs % cycleMs) / cycleMs
        const pingpong = progress < 0.5 ? progress * 2 : (1 - progress) * 2
        const activePos = pingpong * (spatialCount - 1)
        return Array.from({ length: ledCount }, (_, i) => {
          const spatialIndex = getSpatialIndex(i)
          const distance = Math.abs(spatialIndex - activePos)
          const intensity = Math.exp(-0.5 * Math.pow(distance / 1.2, 2))
          return applyBrightness(interpolateColor(BLACK, startColor, intensity), brightness)
        })
      }

      case 'sequential': {
        // OpenLinkHub: fills LEDs 0→step with currentColor, rest with prevColor
        // Alternates colors each cycle (even: start fills over end, odd: end fills over start)
        const totalProgress = elapsedMs / cycleMs
        const cycleProgress = totalProgress % 1.0
        const cycleCount = Math.floor(totalProgress)
        const step = Math.floor(cycleProgress * ledCount)
        const currentColor = applyBrightness(
          cycleCount % 2 === 0 ? startColor : endColor,
          brightness
        )
        const prevColor = applyBrightness(cycleCount % 2 === 0 ? endColor : startColor, brightness)
        return Array.from({ length: ledCount }, (_, i) => (i <= step ? currentColor : prevColor))
      }

      case 'spinner': {
        // Single bright spot that travels across LEDs with soft gaussian glow
        const progress = (elapsedMs % cycleMs) / cycleMs
        const activePos = progress * ledCount
        return Array.from({ length: ledCount }, (_, i) => {
          const dist = Math.abs(i - activePos)
          const wrappedDist = Math.min(dist, ledCount - dist)
          const intensity = Math.exp(-0.5 * Math.pow(wrappedDist / 1.2, 2))
          return applyBrightness(interpolateColor(BLACK, startColor, intensity), brightness)
        })
      }

      case 'twinkle': {
        // Each LED gets its own phase; in every cycle a third of them light up
        // with a random mix of the two colors and fade in and out.
        return Array.from({ length: ledCount }, (_, i) => {
          const local = elapsedMs / cycleMs + hash(i, 0, 1)
          const cycle = Math.floor(local)
          if (hash(i, cycle, 2) > 0.35) {
            return { ...BLACK }
          }
          const intensity = Math.sin(Math.PI * (local - cycle))
          const color = interpolateColor(startColor, endColor, hash(i, cycle, 3))
          return applyBrightness(scaleColor(color, intensity), brightness)
        })
      }

      case 'fire': {
        // Bottom row is hottest; each LED flickers with its own noise.
        return Array.from({ length: ledCount }, (_, i) => {
          const row = Math.floor(i / gridCols)
          const height = gridRows > 1 ? (gridRows - 1 - row) / (gridRows - 1) : 0
          const flicker = valueNoise(i, (elapsedMs / cycleMs) * 4)
          const heat = Math.max(0, Math.min(1, 0.9 - height * 0.6 + (flicker - 0.5) * 0.6))
          return applyBrightness(heatColor(heat, startColor, endColor), brightness)
        })
      }

      case 'gradient':
        return Array.from({ length: ledCount }, (_, i) => {
          const fraction = getSpatialIndex(i) / Math.max(1, spatialCount - 1)
          return applyBrightness(interpolateColor(startColor, endColor, fraction), brightness)
        })

      case 'rainbow-wave': {
        // The whole spectrum spans the grid along the direction and scrolls.
        const timePos = elapsedSeconds / cycleSeconds
        return Array.from({ length: ledCount }, (_, i) => {
          const position = getSpatialIndex(i) / spatialCount - timePos
          return applyBrightness(rainbowColor(position), brightness)
        })
      }

      default:
        return Array.from({ length: ledCount }, () => ({ ...BLACK }))
    }
  }
}

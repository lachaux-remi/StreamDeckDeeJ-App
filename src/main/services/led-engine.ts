import type { LedColor, LedProfile } from '@main/types/settings.types'

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
  if (position < 0.2) return seg(1, 0, 0, 1, 1, 0, position / 0.2)
  if (position < 0.4) return seg(1, 1, 0, 0, 1, 0, (position - 0.2) / 0.2)
  if (position < 0.6) return seg(0, 1, 0, 0, 1, 1, (position - 0.4) / 0.2)
  if (position < 0.8) return seg(0, 1, 1, 0, 0, 1, (position - 0.6) / 0.2)
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
      if (direction === 'horizontal') return col
      if (direction === 'vertical') return row
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

      default:
        return Array.from({ length: ledCount }, () => ({ ...BLACK }))
    }
  }
}

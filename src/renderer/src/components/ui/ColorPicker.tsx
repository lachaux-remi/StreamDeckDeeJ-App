import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@renderer/lib/utils'
import type { LedColor } from '@renderer/types/settings.types'

function hsvToRgb(h: number, s: number, v: number): LedColor {
  s /= 100
  v /= 100
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0, g = 0, b = 0
  if (h < 60)       { r = c; g = x }
  else if (h < 120) { r = x; g = c }
  else if (h < 180) {        g = c; b = x }
  else if (h < 240) {        g = x; b = c }
  else if (h < 300) { r = x;        b = c }
  else              { r = c;        b = x }
  return {
    r: Math.round((r + m) * 255),
    g: Math.round((g + m) * 255),
    b: Math.round((b + m) * 255)
  }
}

function rgbToHsv({ r, g, b }: LedColor): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  let h = 0
  const s = max === 0 ? 0 : d / max
  const v = max
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h = Math.round(h * 60)
    if (h < 0) h += 360
  }
  return [h, Math.round(s * 100), Math.round(v * 100)]
}

function toHex({ r, g, b }: LedColor): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function parseHex(raw: string): LedColor | null {
  const clean = raw.replace('#', '')
  if (!/^[0-9a-f]{6}$/i.test(clean)) return null
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16)
  }
}

interface ColorPickerProps {
  value: LedColor
  onChange: (color: LedColor) => void
  className?: string
  compact?: boolean
}

export default function ColorPicker({ value, onChange, className, compact }: ColorPickerProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [hsv, setHsv] = useState<[number, number, number]>(() => rgbToHsv(value))
  const [hexInput, setHexInput] = useState(() => toHex(value).slice(1))
  const [panelPos, setPanelPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const PANEL_W = 228
  const PANEL_H = 252

  useEffect(() => {
    setHsv(rgbToHsv(value))
    setHexInput(toHex(value).slice(1))
  }, [value.r, value.g, value.b])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: MouseEvent): void => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) setIsOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [isOpen])

  const handleToggle = useCallback(() => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - rect.bottom
      const top = spaceBelow > PANEL_H + 8 ? rect.bottom + 6 : rect.top - PANEL_H - 6
      const left = Math.min(rect.left, window.innerWidth - PANEL_W - 8)
      setPanelPos({ top, left })
    }
    setIsOpen((v) => !v)
  }, [isOpen])

  const [h, s, v] = hsv
  const hueRgb = hsvToRgb(h, 100, 100)
  const current = hsvToRgb(h, s, v)
  const hex = toHex(current)

  const applyHsv = useCallback((next: [number, number, number]) => {
    setHsv(next)
    const c = hsvToRgb(...next)
    setHexInput(toHex(c).slice(1))
    onChange(c)
  }, [onChange])

  const handleGradient = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    applyHsv([h, Math.round(x * 100), Math.round((1 - y) * 100)])
  }, [h, applyHsv])

  return (
    <div className={cn('relative', className)}>
      {/* Trigger */}
      {compact ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          className="h-7 w-7 flex-shrink-0 rounded-md border border-white/10 transition-transform hover:scale-110 active:scale-95"
          style={{ background: hex, boxShadow: `0 0 8px ${hex}80` }}
          title={hex}
        />
      ) : (
        <button
          ref={triggerRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-lg border bg-surface-2 px-3 py-2 text-sm transition-colors',
            isOpen ? 'border-border bg-surface-3' : 'border-border/40 hover:border-border'
          )}
        >
          <div
            className="h-5 w-5 flex-shrink-0 rounded border border-white/10"
            style={{ background: hex, boxShadow: `0 0 6px ${hex}80` }}
          />
          <span className="font-mono text-xs uppercase text-muted-foreground/80">{hex}</span>
        </button>
      )}

      {/* Floating panel — portaled to body to escape transform/overflow-clip ancestors */}
      {isOpen && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[300] rounded-xl border border-border/60 bg-surface-1 p-3 shadow-2xl shadow-black/70 animate-fade-in"
          style={{ top: panelPos.top, left: panelPos.left, width: PANEL_W }}
        >
          {/* 2D saturation/value */}
          <div
            className="relative mb-3 h-36 w-full cursor-crosshair select-none overflow-hidden rounded-lg"
            style={{ backgroundColor: `rgb(${hueRgb.r},${hueRgb.g},${hueRgb.b})` }}
            onPointerDown={(e) => {
              isDragging.current = true
              e.currentTarget.setPointerCapture(e.pointerId)
              handleGradient(e)
            }}
            onPointerMove={(e) => isDragging.current && handleGradient(e)}
            onPointerUp={() => { isDragging.current = false }}
          >
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
            {/* Cursor */}
            <div
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(0,0,0,0.9)]"
              style={{ left: `${s}%`, top: `${100 - v}%` }}
            />
          </div>

          {/* Hue slider */}
          <div className="mb-3 px-0.5">
            <input
              type="range"
              min={0}
              max={360}
              value={h}
              onChange={(e) => applyHsv([parseInt(e.target.value), s, v])}
              className="h-3 w-full cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-white/30 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-[0_1px_6px_rgba(0,0,0,0.8)]"
              style={{ background: 'linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)' }}
            />
          </div>

          {/* Hex input + preview swatch */}
          <div className="flex items-center gap-2">
            <div
              className="h-8 w-8 flex-shrink-0 rounded-lg border border-white/10"
              style={{ background: hex, boxShadow: `0 0 10px ${hex}70` }}
            />
            <div
              className="flex items-center rounded-lg border border-border/40 bg-surface-2 px-2.5 py-1.5 font-mono text-xs transition-colors focus-within:border-border focus-within:bg-surface-3"
              style={{ width: 'calc(100% - 32px - (var(--spacing) * 2))' }}
            >
              <span className="select-none text-muted-foreground/40">#</span>
              <input
                type="text"
                value={hexInput}
                onChange={(e) => {
                  const raw = e.target.value.replace(/[^0-9a-f]/gi, '').slice(0, 6)
                  setHexInput(raw)
                  const rgb = parseHex(raw)
                  if (rgb) {
                    setHsv(rgbToHsv(rgb))
                    onChange(rgb)
                  }
                }}
                onBlur={() => setHexInput(toHex(current).slice(1))}
                maxLength={6}
                spellCheck={false}
                className="flex-1 bg-transparent uppercase text-foreground outline-none"
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

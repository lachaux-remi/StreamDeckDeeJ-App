import { useMemo } from 'react'
import { cn } from '@renderer/lib/utils'

interface DeejSliderProps {
  index: string
  value: number
  name?: string
  sessions: string[]
  onClick: () => void
  animationDelay?: number
  isDragSource?: boolean
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragEnd?: () => void
}

const SEGMENT_COUNT = 20

// Smooth linear interpolation between 3 colors: blue → purple → pink
const COLORS = [
  [56, 189, 248], // #38bdf8 blue
  [168, 85, 247], // #a855f7 purple
  [244, 114, 182] // #f472b6 pink
] as const

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function getSegmentColor(segIndex: number, total: number): { active: string; glow: string } {
  const t = segIndex / (total - 1)
  const segment = t < 0.5 ? 0 : 1
  const localT = t < 0.5 ? t * 2 : (t - 0.5) * 2
  const from = COLORS[segment]
  const to = COLORS[segment + 1]
  const r = lerp(from[0], to[0], localT)
  const g = lerp(from[1], to[1], localT)
  const b = lerp(from[2], to[2], localT)
  return {
    active: `rgb(${r}, ${g}, ${b})`,
    glow: `rgba(${r}, ${g}, ${b}, 0.5)`
  }
}

export default function DeejSlider({
  index,
  value,
  name,
  sessions,
  onClick,
  animationDelay,
  isDragSource,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}: DeejSliderProps): React.JSX.Element {
  const percent = Math.round(value * 100)
  const label = name || (sessions.length > 0 ? sessions.join(', ') : `S${parseInt(index) + 1}`)
  const hasConfig = name || sessions.length > 0
  const activeSegments = Math.round(value * SEGMENT_COUNT)

  const segments = useMemo(
    () =>
      Array.from({ length: SEGMENT_COUNT }, (_, i) => {
        const segIndex = SEGMENT_COUNT - 1 - i
        const isActive = segIndex < activeSegments
        const { active, glow } = getSegmentColor(segIndex, SEGMENT_COUNT)
        return { segIndex, isActive, active, glow }
      }),
    [activeSegments]
  )

  return (
    <div
      draggable={!!hasConfig}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'flex h-full flex-1 min-w-0 flex-col items-center gap-2.5 py-1 rounded-xl transition-all duration-300',
        animationDelay !== undefined && 'animate-scale-in',
        isDragSource && 'opacity-40 scale-95',
        isDragOver && 'bg-neon-blue/10 ring-2 ring-neon-blue/50'
      )}
      style={{
        ...(animationDelay !== undefined ? { animationDelay: `${animationDelay}ms` } : {}),
        ...(isDragOver
          ? {
              boxShadow: '0 0 20px rgba(56, 189, 248, 0.2), inset 0 0 12px rgba(56, 189, 248, 0.08)'
            }
          : {})
      }}
    >
      {/* Percentage */}
      <div className="shrink-0 relative">
        <span
          className="font-mono text-sm font-bold tabular-nums"
          style={{
            color: getSegmentColor(activeSegments, SEGMENT_COUNT).active,
            textShadow: `0 0 12px ${getSegmentColor(activeSegments, SEGMENT_COUNT).glow}`
          }}
        >
          {percent}
          <span className="text-[10px] opacity-60">%</span>
        </span>
      </div>

      {/* VU Meter track */}
      <div
        onClick={onClick}
        className="group/track relative min-h-0 w-3/5 max-w-20 flex-1 cursor-pointer rounded-lg bg-surface-0 border border-border/40 p-1 overflow-hidden transition-all duration-300 hover:scale-[1.04] active:scale-95"
      >
        {/* Inner shadow for depth */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none"
          style={{
            boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.5), inset 0 -1px 4px rgba(0, 0, 0, 0.3)'
          }}
        />

        {/* Hover glow overlay */}
        <div
          className="absolute inset-0 rounded-lg pointer-events-none opacity-0 group-hover/track:opacity-100 transition-opacity duration-300"
          style={{
            border: '2px solid rgba(56, 189, 248, 0.4)',
            boxShadow: '0 0 20px rgba(56, 189, 248, 0.2), inset 0 0 12px rgba(56, 189, 248, 0.08)'
          }}
        />

        {/* Segments */}
        <div className="relative flex h-full flex-col gap-[2px]">
          {segments.map(({ segIndex, isActive, active, glow }) => (
            <div
              key={segIndex}
              className="flex-1 rounded-sm transition-all duration-75"
              style={
                isActive
                  ? {
                      backgroundColor: active,
                      boxShadow: `0 0 6px ${glow}, inset 0 1px 0 rgba(255,255,255,0.15)`,
                      opacity: 0.9 + (segIndex / SEGMENT_COUNT) * 0.1
                    }
                  : {
                      backgroundColor: 'hsl(230 12% 14%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
                      opacity: 0.5
                    }
              }
            />
          ))}
        </div>

        {/* Glass reflection */}
        <div className="absolute inset-y-0 left-0 w-[40%] rounded-lg bg-gradient-to-r from-white/[0.03] to-transparent pointer-events-none" />
      </div>

      {/* Label */}
      <span
        className={cn(
          'shrink-0 max-w-[88px] truncate rounded-md px-2.5 py-1 text-[11px] font-medium',
          hasConfig
            ? 'text-neon-blue/80 border border-neon-blue/15 bg-neon-blue/5'
            : 'text-muted-foreground/50 border border-transparent'
        )}
        title={
          name
            ? `${name} (${sessions.join(', ') || 'aucune session'})`
            : sessions.join(', ') || `Slider ${parseInt(index) + 1}`
        }
      >
        {label}
      </span>
    </div>
  )
}

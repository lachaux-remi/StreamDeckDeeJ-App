import { cn } from '@renderer/lib/utils'
import type { LedColor, StreamdeckInputConfig } from '@renderer/types/settings.types'

interface StreamdeckButtonProps {
  index: string
  config?: StreamdeckInputConfig
  /** Live color of the key's LED, mirrored from the device. */
  ledColor?: LedColor
  cellSize: number
  onClick: () => void
  animationDelay?: number
  isDragSource?: boolean
  isDragOver?: boolean
  onDragStart?: (e: React.DragEvent<HTMLButtonElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLButtonElement>) => void
  onDragLeave?: (e: React.DragEvent<HTMLButtonElement>) => void
  onDrop?: (e: React.DragEvent<HTMLButtonElement>) => void
  onDragEnd?: () => void
}

// A LED looks much brighter than the same low value on a screen, so the
// preview lifts dim channels the way the eye perceives them on the device.
function ledScreenColor({ r, g, b }: LedColor): string {
  const lift = (channel: number): number => Math.round(255 * Math.pow(channel / 255, 0.45))
  return `${lift(r)} ${lift(g)} ${lift(b)}`
}

const maskStyle = (src: string): React.CSSProperties => ({
  maskImage: `url(${src})`,
  maskSize: 'contain',
  maskRepeat: 'no-repeat',
  maskPosition: 'center',
  WebkitMaskImage: `url(${src})`,
  WebkitMaskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center'
})

export default function StreamdeckButton({
  index,
  config,
  ledColor,
  cellSize,
  onClick,
  animationDelay,
  isDragSource,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd
}: StreamdeckButtonProps): React.JSX.Element {
  const hasActions = config && (config.pressed?.module || config.hold?.module)
  const mainIcon = config?.icon
  const pressIcon = config?.pressed?.icon
  const holdIcon = config?.hold?.icon
  const hasActionIcons = pressIcon || holdIcon

  const mainIconSize = Math.round(cellSize * 0.45)
  const actionIconSize = Math.max(10, Math.min(22, Math.round(cellSize * 0.12)))

  const ledLit = ledColor && ledColor.r + ledColor.g + ledColor.b > 0

  return (
    <button
      draggable={!!config}
      onClick={onClick}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        'group relative h-full w-full rounded-xl overflow-hidden',
        'flex flex-col items-center justify-center',
        'transition-all duration-300 cursor-pointer select-none',
        !isDragSource && 'hover:scale-[1.04] active:scale-95',
        hasActions ? 'bg-surface-2/60 backdrop-blur-sm' : 'bg-surface-2/40',
        animationDelay !== undefined && 'animate-scale-in',
        isDragSource && 'opacity-40 scale-95',
        isDragOver && 'ring-2 ring-neon-purple/70 bg-neon-purple/10'
      )}
      style={{
        boxShadow: isDragOver
          ? '0 0 20px rgba(168, 85, 247, 0.3), inset 0 0 12px rgba(168, 85, 247, 0.1)'
          : hasActions
            ? 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.3)'
            : 'inset 0 1px 0 rgba(255,255,255,0.02), 0 1px 4px rgba(0,0,0,0.2)',
        border: isDragOver
          ? '1px solid rgba(168, 85, 247, 0.5)'
          : hasActions
            ? '1px solid rgba(168, 85, 247, 0.2)'
            : '1px solid rgba(255,255,255,0.04)',
        ...(animationDelay !== undefined && { animationDelay: `${animationDelay}ms` })
      }}
    >
      {/* LED light bar along the top; updated every frame so it has no transition */}
      {ledLit && (
        <div
          className="pointer-events-none absolute rounded-full"
          style={{
            top: Math.round(cellSize * 0.1),
            left: Math.round(cellSize * 0.25),
            right: Math.round(cellSize * 0.25),
            height: Math.max(3, Math.round(cellSize * 0.05)),
            backgroundColor: `rgb(${ledScreenColor(ledColor)})`,
            boxShadow: `0 0 ${Math.max(6, Math.round(cellSize * 0.1))}px rgb(${ledScreenColor(ledColor)} / 0.8)`
          }}
        />
      )}

      {/* Glass reflection - diagonal shine */}
      <div
        className="absolute inset-0 pointer-events-none opacity-100 group-hover:opacity-0 transition-opacity duration-300"
        style={{
          background:
            'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, transparent 50%, transparent 100%)'
        }}
      />

      {/* Hover glow overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
        style={{
          background:
            'radial-gradient(ellipse at center, rgba(168, 85, 247, 0.08) 0%, transparent 70%)',
          boxShadow: '0 0 20px rgba(168, 85, 247, 0.15), inset 0 0 20px rgba(168, 85, 247, 0.05)'
        }}
      />

      {/* Neon border glow on hover */}
      <div
        className="absolute inset-0 rounded-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          border: '1px solid rgba(168, 85, 247, 0.35)',
          boxShadow: 'inset 0 0 12px rgba(168, 85, 247, 0.06)'
        }}
      />

      {/* Top edge highlight */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/6 to-transparent" />

      {/* Main icon */}
      {mainIcon ? (
        <div
          className="relative bg-[rgba(200,190,230,0.55)] drop-shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:bg-[rgba(200,190,230,0.8)]"
          style={{
            ...maskStyle(mainIcon),
            width: mainIconSize,
            height: mainIconSize
          }}
        />
      ) : (
        <span className="font-mono text-base font-medium text-muted-foreground/15 transition-colors duration-300 group-hover:text-muted-foreground/40">
          {parseInt(index) + 1}
        </span>
      )}

      {/* Bottom action indicators */}
      {(hasActions || hasActionIcons) && (
        <div className="absolute bottom-[5%] flex items-center gap-[4%]">
          {(config.pressed?.module || pressIcon) && (
            <div className="flex items-center" title="Press">
              {pressIcon ? (
                <div
                  className="bg-neon-purple"
                  style={{
                    ...maskStyle(pressIcon),
                    width: actionIconSize,
                    height: actionIconSize,
                    filter: 'drop-shadow(0 0 4px rgba(168, 85, 247, 0.5))'
                  }}
                />
              ) : (
                <div
                  className="h-1 rounded-full bg-neon-purple/70"
                  style={{
                    width: Math.max(12, actionIconSize),
                    boxShadow: '0 0 6px rgba(168, 85, 247, 0.4)'
                  }}
                />
              )}
            </div>
          )}
          {(config.hold?.module || holdIcon) && (
            <div className="flex items-center" title="Hold">
              {holdIcon ? (
                <div
                  className="bg-neon-blue"
                  style={{
                    ...maskStyle(holdIcon),
                    width: actionIconSize,
                    height: actionIconSize,
                    filter: 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.5))'
                  }}
                />
              ) : (
                <div
                  className="h-1 rounded-full bg-neon-blue/70"
                  style={{
                    width: Math.max(12, actionIconSize),
                    boxShadow: '0 0 6px rgba(56, 189, 248, 0.4)'
                  }}
                />
              )}
            </div>
          )}
        </div>
      )}
    </button>
  )
}

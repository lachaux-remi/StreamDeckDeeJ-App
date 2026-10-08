import { useSerialStore } from '@renderer/stores/serial.store'

interface DeejLevelMeterProps {
  index: string
}

// Subscribes to its own slider level so ~30 Hz updates only re-render this bar.
export default function DeejLevelMeter({ index }: DeejLevelMeterProps): React.JSX.Element | null {
  const available = useSerialStore((s) => s.levelMeterAvailable)
  const level = useSerialStore((s) => s.levels[index] ?? 0)
  const audible = level > 0.01

  if (!available) {
    return null
  }

  return (
    <div
      className="relative flex h-full w-[18%] shrink-0 flex-col justify-end overflow-hidden rounded-sm bg-surface-3/50"
      aria-hidden="true"
    >
      <div
        className="w-full rounded-sm bg-neon-green transition-[height,opacity] duration-75"
        style={{
          height: `${level * 100}%`,
          opacity: audible ? 1 : 0,
          boxShadow: audible
            ? '0 0 8px rgba(74, 222, 128, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.2)'
            : 'none'
        }}
      />
    </div>
  )
}

import { cn } from '@renderer/lib/utils'
import { useSerialStore } from '@renderer/stores/serial.store'

export default function ConnectionStatus(): React.JSX.Element {
  const { serialStatus, serialPorts } = useSerialStore()
  const connected = serialStatus.connected
  const portEntry = serialPorts.find((p) => p.path === serialStatus.port)
  const displayName = portEntry
    ? portEntry.displayName.replace(/\s*\(.*\)$/, '')
    : serialStatus.port

  return (
    <div
      className={cn(
        'flex items-center gap-2.5 rounded-full px-3.5 py-1.5 transition-all duration-300',
        connected ? 'bg-neon-green/8 border border-neon-green/20' : 'bg-surface-2 border border-border'
      )}
    >
      <div className="relative flex items-center justify-center">
        <div
          className={cn(
            'h-2 w-2 rounded-full transition-all duration-500',
            connected ? 'bg-neon-green' : 'bg-neon-red/60'
          )}
        />
        {connected && (
          <div className="absolute inset-0 h-2 w-2 rounded-full bg-neon-green animate-pulse-glow" />
        )}
      </div>
<span className="font-mono text-xs tracking-wide text-muted-foreground">
        {connected ? displayName : 'Déconnecté'}
      </span>
    </div>
  )
}

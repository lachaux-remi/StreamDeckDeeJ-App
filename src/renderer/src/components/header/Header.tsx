import { Settings } from 'lucide-react'
import ConnectionStatus from './ConnectionStatus'

interface HeaderProps {
  onOpenSettings: () => void
}

export default function Header({ onOpenSettings }: HeaderProps): React.JSX.Element {
  return (
    <header className="grid grid-cols-[1fr_auto_1fr] items-center bg-surface-1/80 px-5 py-2.5">
      <div className="flex items-baseline gap-0.5 font-display text-xl font-bold tracking-tight select-none">
        <span className="bg-[linear-gradient(to_right,#f472b6,#a855f7)] bg-clip-text text-transparent">
          StreamDeck
        </span>
        <span className="ml-1.5 text-neon-blue">
          DeeJ
        </span>
      </div>

      <ConnectionStatus />

      <div className="flex items-center justify-end gap-1">
        <button
          onClick={onOpenSettings}
          className="group rounded-lg p-2 text-muted-foreground transition-all duration-200 hover:text-foreground hover:bg-surface-3"
        >
          <Settings className="h-[18px] w-[18px] transition-transform duration-300 group-hover:rotate-90" />
        </button>
      </div>
    </header>
  )
}

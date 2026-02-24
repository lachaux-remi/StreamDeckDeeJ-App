import { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Code, Terminal, Trash2 } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSerialStore } from '@renderer/stores/serial.store'
import LogEntry from './LogEntry'

export default function ConsolePanel(): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const logs = useSerialStore((s) => s.logs)
  const clearLogs = useSerialStore((s) => s.clearLogs)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [logs, isOpen])

  return (
    <div className="border-t border-border/50 bg-surface-1/60">
      {/* Toggle bar */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full cursor-pointer items-center justify-between px-4 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
      >
        <div className="flex items-center gap-2">
          {isOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronUp className="h-3.5 w-3.5" />
          )}
          <Terminal className="h-3.5 w-3.5 text-neon-green/50" />
          <span className="font-display text-xs font-semibold uppercase tracking-wider bg-gradient-to-r from-neon-green to-neon-cyan bg-clip-text text-transparent">
            Console
          </span>
          {logs.length > 0 && (
            <span className="rounded-full bg-surface-3 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
              {logs.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                window.api.app.toggleDevTools()
              }}
              className="rounded p-1 text-muted-foreground/30 hover:text-neon-cyan hover:bg-neon-cyan/10 transition-colors"
              title="Ouvrir les DevTools"
            >
              <Code className="h-3 w-3" />
            </button>
          )}
          {isOpen && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                clearLogs()
              }}
              className="rounded p-1 text-muted-foreground/50 hover:text-neon-red hover:bg-neon-red/10 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Log content */}
      <div
        ref={scrollRef}
        className={cn(
          'overflow-y-auto transition-all duration-250 ease-out',
          isOpen ? 'h-44' : 'h-0'
        )}
      >
        {logs.length === 0 ? (
          <p className="px-4 py-3 font-mono text-xs text-muted-foreground/40">
            En attente de logs...
          </p>
        ) : (
          logs.map((log, i) => <LogEntry key={i} log={log} />)
        )}
      </div>
    </div>
  )
}

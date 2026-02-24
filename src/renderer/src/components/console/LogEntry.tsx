import { useCallback, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import type { LogEntry as LogEntryType } from '@renderer/types/serial.types'

const levelStyle: Record<string, { text: string; dot: string }> = {
  debug: { text: 'text-muted-foreground/60', dot: 'bg-muted-foreground/40' },
  info: { text: 'text-neon-blue/80', dot: 'bg-neon-blue' },
  warn: { text: 'text-neon-orange/80', dot: 'bg-neon-orange' },
  error: { text: 'text-neon-red/80', dot: 'bg-neon-red' }
}

export default function LogEntry({ log }: { log: LogEntryType }): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const time = new Date(log.timestamp).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })

  const style = levelStyle[log.level] || { text: 'text-foreground', dot: 'bg-foreground' }

  const handleCopy = useCallback(() => {
    const text = `[${time}] ${log.level.toUpperCase()} ${log.service ? `${log.service} ` : ''}${log.msg}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [time, log])

  return (
    <div className="group flex items-start gap-2 px-4 py-[3px] font-mono text-[11px] leading-relaxed hover:bg-surface-2/50 animate-slide-in-left">
      <span className="shrink-0 text-muted-foreground/40 tabular-nums">{time}</span>
      <div className={cn('mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full', style.dot)} />
      <span className={cn('shrink-0 w-10 uppercase font-semibold', style.text)}>
        {log.level}
      </span>
      {log.service && (
        <span className="shrink-0 text-neon-purple/40">{log.service}</span>
      )}
      <span className="text-foreground/60 group-hover:text-foreground/80 transition-colors flex-1">
        {log.msg}
      </span>
      <button
        onClick={handleCopy}
        className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded text-muted-foreground/30 hover:text-foreground"
      >
        {copied ? (
          <Check className="h-3 w-3 text-neon-green" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>
    </div>
  )
}

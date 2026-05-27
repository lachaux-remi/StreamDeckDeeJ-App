import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export interface SelectOption {
  value: string
  label: string
  description?: string
}

interface CustomSelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  accent?: 'purple' | 'blue' | 'pink'
}

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  className,
  accent = 'purple'
}: CustomSelectProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setIsOpen(false)
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex w-full items-center justify-between rounded-lg border bg-surface-2 pl-3 pr-2.5 py-2 text-sm transition-colors cursor-pointer',
          isOpen
            ? accent === 'blue'
              ? 'border-neon-blue/50 bg-surface-3'
              : accent === 'pink'
              ? 'border-neon-pink/50 bg-surface-3'
              : 'border-neon-purple/50 bg-surface-3'
            : 'border-border/40 hover:border-border'
        )}
      >
        <span className={selected ? 'text-foreground' : 'text-muted-foreground/40'}>
          {selected?.label || placeholder}
        </span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-muted-foreground/50 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border/50 bg-surface-2 py-1 shadow-xl animate-fade-in">
          {options.map((option) => {
            const isActive = option.value === value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value)
                  setIsOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors',
                  isActive
                    ? accent === 'blue'
                      ? 'bg-neon-blue/10 text-neon-blue'
                      : accent === 'pink'
                      ? 'bg-neon-pink/10 text-neon-pink'
                      : 'bg-neon-purple/10 text-neon-purple'
                    : 'text-foreground/80 hover:bg-surface-3 hover:text-foreground'
                )}
              >
                <Check
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isActive ? 'opacity-100' : 'opacity-0'
                  )}
                />
                <div className="min-w-0 text-left">
                  <span className="block truncate">{option.label}</span>
                  {option.description && (
                    <span className="block truncate text-[11px] text-muted-foreground/40">
                      {option.description}
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

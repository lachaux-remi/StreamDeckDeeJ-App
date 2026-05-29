import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent): void => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) setIsOpen(false)
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

  const handleToggle = (): void => {
    if (!isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect()
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
    setIsOpen((v) => !v)
  }

  return (
    <div className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
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

      {isOpen && createPortal(
        <div
          ref={panelRef}
          className="fixed z-[300] overflow-hidden rounded-lg border border-border/50 bg-surface-2 py-1 shadow-xl animate-fade-in"
          style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
        >
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
        </div>,
        document.body
      )}
    </div>
  )
}

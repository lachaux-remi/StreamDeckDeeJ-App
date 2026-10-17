import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@renderer/lib/utils'

export interface SelectOption {
  value: string
  label: string
  description?: string
}

interface DropdownPosition {
  top?: number
  bottom?: number
  left: number
  width: number
  maxHeight: number
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
  const [dropdownPos, setDropdownPos] = useState<DropdownPosition>({
    left: 0,
    width: 0,
    maxHeight: 0
  })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const selected = options.find((o) => o.value === value)

  // The panel is fixed in a portal, so it follows the trigger whenever the
  // window is resized or a container scrolls.
  const updatePosition = useCallback((): void => {
    if (!triggerRef.current) {
      return
    }
    const rect = triggerRef.current.getBoundingClientRect()
    const estimatedH = options.length * 48
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    // Open upward only when the list does not fit below and there is more room above;
    // past the available room the panel scrolls.
    const openAbove = spaceBelow < estimatedH && spaceAbove > spaceBelow
    setDropdownPos({
      ...(openAbove ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(0, openAbove ? spaceAbove : spaceBelow)
    })
  }, [options.length])

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleClickOutside = (e: MouseEvent): void => {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !panelRef.current?.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    const handleEscape = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    panelRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' })

    const handleScroll = (e: Event): void => {
      if (!panelRef.current?.contains(e.target as Node)) {
        updatePosition()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [isOpen, updatePosition])

  const handleToggle = (): void => {
    if (!isOpen) {
      updatePosition()
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

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-[300] overflow-y-auto overscroll-contain rounded-lg border border-border/50 bg-surface-2 py-1 shadow-xl animate-fade-in"
            style={dropdownPos}
          >
            {options.map((option) => {
              const isActive = option.value === value
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-selected={isActive}
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
                    className={cn('h-3.5 w-3.5 shrink-0', isActive ? 'opacity-100' : 'opacity-0')}
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

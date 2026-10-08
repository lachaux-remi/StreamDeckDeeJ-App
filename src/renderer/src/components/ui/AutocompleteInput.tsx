import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { filterSuggestions, type AutocompleteSuggestion } from '@renderer/lib/autocomplete'
import { cn } from '@renderer/lib/utils'

interface AutocompleteInputProps {
  value: string
  onChange: (value: string) => void
  loadSuggestions: () => Promise<AutocompleteSuggestion[]>
  placeholder?: string
  className?: string
  accent?: 'purple' | 'blue'
  emptyText?: string
  maxResults?: number
}

export default function AutocompleteInput({
  value,
  onChange,
  loadSuggestions,
  placeholder,
  className,
  accent = 'purple',
  emptyText = 'Aucune suggestion',
  maxResults = 50
}: AutocompleteInputProps): React.JSX.Element {
  const listId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<AutocompleteSuggestion[]>([])
  const [highlighted, setHighlighted] = useState(-1)
  // Empty until the user types: a filled field still lists every suggestion.
  const [query, setQuery] = useState('')
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 })

  const matches = useMemo(
    () => filterSuggestions(suggestions, query, maxResults),
    [suggestions, query, maxResults]
  )

  const place = useCallback((): void => {
    const rect = inputRef.current?.getBoundingClientRect()
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width })
    }
  }, [])

  const openList = (): void => {
    place()
    setOpen(true)
    setHighlighted(-1)
    setQuery('')
    setLoading(true)
    void loadSuggestions()
      .then(setSuggestions)
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    if (!open) {
      return
    }
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  const select = (suggestion: AutocompleteSuggestion): void => {
    onChange(suggestion.value)
    setOpen(false)
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (!open) {
      if (event.key === 'ArrowDown') {
        openList()
      }
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setHighlighted((current) =>
        matches.length === 0 ? -1 : (current + step + matches.length) % matches.length
      )
    } else if (event.key === 'Enter' && matches[highlighted]) {
      event.preventDefault()
      select(matches[highlighted])
    } else if (event.key === 'Escape') {
      // Close the list without closing the surrounding dialog.
      event.stopPropagation()
      setOpen(false)
    }
  }

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={highlighted >= 0 ? `${listId}-${highlighted}` : undefined}
          autoComplete="off"
          spellCheck={false}
          value={value}
          placeholder={placeholder}
          onFocus={openList}
          onBlur={() => setOpen(false)}
          onChange={(event) => {
            onChange(event.target.value)
            if (!open) {
              openList()
            }
            setQuery(event.target.value)
            setHighlighted(-1)
          }}
          onKeyDown={onKeyDown}
          className={cn(className, loading && 'pr-8')}
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground/40" />
        )}
      </div>

      {open &&
        !loading &&
        createPortal(
          <div
            id={listId}
            role="listbox"
            className="fixed z-[300] max-h-60 overflow-y-auto rounded-lg border border-border/50 bg-surface-2 py-1 shadow-xl animate-fade-in"
            style={position}
            // Keep focus in the input so a click selects before the blur closes the list.
            onMouseDown={(event) => event.preventDefault()}
          >
            {matches.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground/50">{emptyText}</div>
            ) : (
              matches.map((suggestion, index) => (
                <div
                  key={suggestion.value}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === highlighted}
                  onClick={() => select(suggestion)}
                  onMouseEnter={() => setHighlighted(index)}
                  className={cn(
                    'cursor-pointer px-3 py-1.5 text-sm transition-colors',
                    index === highlighted
                      ? accent === 'blue'
                        ? 'bg-neon-blue/10 text-neon-blue'
                        : 'bg-neon-purple/10 text-neon-purple'
                      : 'text-foreground/80'
                  )}
                >
                  <span className="block truncate font-mono text-[13px]">{suggestion.value}</span>
                  {(suggestion.label || suggestion.detail) && (
                    <span className="block truncate text-[11px] text-muted-foreground/50">
                      {[suggestion.label, suggestion.detail].filter(Boolean).join(' · ')}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>,
          document.body
        )}
    </>
  )
}

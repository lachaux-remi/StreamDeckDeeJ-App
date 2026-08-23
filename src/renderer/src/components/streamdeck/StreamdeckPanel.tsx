import { useCallback, useEffect, useRef, useState } from 'react'
import { Gamepad2 } from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings.store'
import StreamdeckButton from './StreamdeckButton'

interface StreamdeckPanelProps {
  onButtonClick: (index: string) => void
}

const GAP = 8

export default function StreamdeckPanel({
  onButtonClick
}: StreamdeckPanelProps): React.JSX.Element {
  const { gridCols, gridRows, streamdeck } = useSettingsStore((s) => s.settings)
  const swapStreamdeckButtons = useSettingsStore((s) => s.swapStreamdeckButtons)
  const containerRef = useRef<HTMLDivElement>(null)
  const [cellSize, setCellSize] = useState(0)
  const [dragSourceIndex, setDragSourceIndex] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<string | null>(null)
  const didDrag = useRef(false)

  const totalButtons = gridCols * gridRows
  const buttons = Array.from({ length: totalButtons }, (_, i) => i.toString())

  useEffect(() => {
    const el = containerRef.current
    if (!el) {
      return
    }
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      const maxCellW = (width - (gridCols - 1) * GAP) / gridCols
      const maxCellH = (height - (gridRows - 1) * GAP) / gridRows
      setCellSize(Math.floor(Math.min(maxCellW, maxCellH)))
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [gridCols, gridRows])

  const handleDragStart = useCallback((index: string, e: React.DragEvent) => {
    didDrag.current = true
    setDragSourceIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index)
  }, [])

  const handleDragOver = useCallback((index: string, e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }, [])

  const handleDragLeave = useCallback((_index: string, e: React.DragEvent) => {
    const relatedTarget = e.relatedTarget as Node | null
    if (!e.currentTarget.contains(relatedTarget)) {
      setDragOverIndex(null)
    }
  }, [])

  const handleDrop = useCallback(
    (targetIndex: string, e: React.DragEvent) => {
      e.preventDefault()
      if (dragSourceIndex !== null && dragSourceIndex !== targetIndex) {
        swapStreamdeckButtons(dragSourceIndex, targetIndex)
      }
      setDragSourceIndex(null)
      setDragOverIndex(null)
    },
    [dragSourceIndex, swapStreamdeckButtons]
  )

  const handleDragEnd = useCallback(() => {
    setDragSourceIndex(null)
    setDragOverIndex(null)
    setTimeout(() => {
      didDrag.current = false
    }, 0)
  }, [])

  const gridW = cellSize * gridCols + (gridCols - 1) * GAP
  const gridH = cellSize * gridRows + (gridRows - 1) * GAP

  return (
    <div className="flex h-full flex-col p-5">
      {/* Section title */}
      <div className="mb-4 flex items-center gap-2 shrink-0">
        <Gamepad2 className="h-4 w-4 text-neon-purple/60" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-neon-purple/70">
          StreamDeck
        </h2>
        <div className="ml-2 flex-1 gradient-line-h" />
      </div>

      {/* Grid container */}
      <div ref={containerRef} className="flex flex-1 items-center justify-center min-h-0">
        {cellSize > 0 && (
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${gridCols}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${gridRows}, ${cellSize}px)`,
              gap: `${GAP}px`,
              width: `${gridW}px`,
              height: `${gridH}px`
            }}
          >
            {buttons.map((index, i) => (
              <StreamdeckButton
                key={index}
                index={index}
                config={streamdeck[index]}
                cellSize={cellSize}
                onClick={() => {
                  if (!didDrag.current) {
                    onButtonClick(index)
                  }
                }}
                animationDelay={i * 30}
                isDragSource={dragSourceIndex === index}
                isDragOver={dragOverIndex === index && dragSourceIndex !== index}
                onDragStart={(e) => handleDragStart(index, e)}
                onDragOver={(e) => handleDragOver(index, e)}
                onDragLeave={(e) => handleDragLeave(index, e)}
                onDrop={(e) => handleDrop(index, e)}
                onDragEnd={handleDragEnd}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

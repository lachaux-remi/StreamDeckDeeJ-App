import { useCallback, useRef, useState } from 'react'
import { SlidersHorizontal } from 'lucide-react'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useSerialStore } from '@renderer/stores/serial.store'
import DeejSlider from './DeejSlider'

interface DeejPanelProps {
  onSliderClick: (index: string) => void
}

export default function DeejPanel({ onSliderClick }: DeejPanelProps): React.JSX.Element {
  const { sliderCount, deej, deejNames } = useSettingsStore((s) => s.settings)
  const swapSliders = useSettingsStore((s) => s.swapSliders)
  const sliders = useSerialStore((s) => s.sliders)
  const [dragSourceIndex, setDragSourceIndex] = useState<string | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<string | null>(null)
  const didDrag = useRef(false)

  const sliderIndices = Array.from({ length: sliderCount }, (_, i) => i.toString())

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
        swapSliders(dragSourceIndex, targetIndex)
      }
      setDragSourceIndex(null)
      setDragOverIndex(null)
    },
    [dragSourceIndex, swapSliders]
  )

  const handleDragEnd = useCallback(() => {
    setDragSourceIndex(null)
    setDragOverIndex(null)
    setTimeout(() => {
      didDrag.current = false
    }, 0)
  }, [])

  return (
    <div className="flex h-full flex-col p-5">
      {/* Section title */}
      <div className="mb-4 flex items-center gap-2 shrink-0">
        <div className="flex-1 gradient-line-h" />
        <SlidersHorizontal className="h-4 w-4 text-neon-blue/60" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-widest text-neon-blue/70">
          DeeJ
        </h2>
      </div>

      {/* Sliders */}
      <div className="flex flex-1 items-stretch justify-evenly gap-1 px-2">
        {sliderIndices.map((index, i) => (
          <DeejSlider
            key={index}
            index={index}
            value={sliders[index] || 0}
            name={(deejNames || {})[index]}
            sessions={deej[index] || []}
            onClick={() => {
              if (!didDrag.current) onSliderClick(index)
            }}
            animationDelay={i * 50}
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
    </div>
  )
}

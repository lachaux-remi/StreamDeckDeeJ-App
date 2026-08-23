import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useSerialStore } from '@renderer/stores/serial.store'

interface DeejConfigDialogProps {
  sliderIndex: string | null
  onClose: () => void
}

export default function DeejConfigDialog({
  sliderIndex,
  onClose
}: DeejConfigDialogProps): React.JSX.Element | null {
  const { deej } = useSettingsStore((s) => s.settings)
  const updateSlider = useSettingsStore((s) => s.updateSlider)
  const sessions = useSerialStore((s) => s.sessions)
  const setSessions = useSerialStore((s) => s.setSessions)

  const deejNames = useSettingsStore((s) => s.settings.deejNames)

  const [name, setName] = useState('')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [assigned, setAssigned] = useState<string[]>([])
  const [selectedAvailable, setSelectedAvailable] = useState<string | null>(null)
  const [selectedAssigned, setSelectedAssigned] = useState<string | null>(null)
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false)

  useEffect(() => {
    if (sliderIndex !== null) {
      setName(deejNames[sliderIndex] || '')
      setAssigned([...(deej[sliderIndex] || [])])
      setSelectedAvailable(null)
      setSelectedAssigned(null)
      setShowDiscardPrompt(false)
    }
  }, [sliderIndex, deej, deejNames])

  const hasChanges = useMemo(() => {
    if (sliderIndex === null) return false
    const originalName = deejNames[sliderIndex] || ''
    const originalAssigned = deej[sliderIndex] || []
    return name !== originalName || JSON.stringify(assigned) !== JSON.stringify(originalAssigned)
  }, [sliderIndex, deej, deejNames, name, assigned])

  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowDiscardPrompt(true)
    } else {
      onClose()
    }
  }, [hasChanges, onClose])

  const handleDiscard = useCallback(() => {
    setShowDiscardPrompt(false)
    onClose()
  }, [onClose])

  const refreshSessions = useCallback(async () => {
    setIsRefreshing(true)
    const freshSessions = await window.api.deej.getSessions()
    setSessions(freshSessions)
    setTimeout(() => setIsRefreshing(false), 500)
  }, [setSessions])

  const originalAssigned = useMemo(
    () => (sliderIndex !== null ? deej[sliderIndex] || [] : []),
    [sliderIndex, deej]
  )

  const otherSlidersAssigned = useMemo(() => {
    const others: string[] = []
    for (const [key, sessions] of Object.entries(deej)) {
      if (key !== sliderIndex && sessions) others.push(...sessions)
    }
    return others
  }, [deej, sliderIndex])

  const allKnown = useMemo(
    () => [...new Set([...sessions, ...originalAssigned])],
    [sessions, originalAssigned]
  )

  const available = allKnown.filter(
    (s) => !assigned.includes(s) && !otherSlidersAssigned.includes(s)
  )

  const handleAssign = useCallback(() => {
    if (selectedAvailable) {
      setAssigned((prev) => [...prev, selectedAvailable])
      setSelectedAvailable(null)
    }
  }, [selectedAvailable])

  const handleUnassign = useCallback(() => {
    if (selectedAssigned) {
      setAssigned((prev) => prev.filter((s) => s !== selectedAssigned))
      setSelectedAssigned(null)
    }
  }, [selectedAssigned])

  const handleSave = useCallback(() => {
    if (sliderIndex === null) return
    updateSlider(sliderIndex, assigned, name.trim() || undefined)
    onClose()
  }, [sliderIndex, assigned, name, updateSlider, onClose])

  if (sliderIndex === null) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-lg rounded-2xl border border-border/50 bg-surface-1 p-6 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            Slider <span className="text-neon-blue">{parseInt(sliderIndex) + 1}</span>
          </h3>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Slider name */}
        <div className="mb-4">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Nom
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Slider ${sliderIndex !== null ? parseInt(sliderIndex) + 1 : ''}`}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-neon-blue/50 transition-colors"
          />
        </div>

        {/* Transfer lists */}
        <div className="flex gap-3">
          {/* Available */}
          <div className="flex-1">
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Disponibles
              </label>
              <button
                onClick={refreshSessions}
                className="rounded p-1 text-muted-foreground/40 hover:text-neon-blue transition-colors"
                title="Rafraîchir les sessions"
              >
                <RefreshCw className={cn('h-3 w-3', isRefreshing && 'animate-spin')} />
              </button>
            </div>
            <div className="h-48 overflow-y-auto rounded-xl border border-border/30 bg-surface-2 p-1.5">
              {available.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground/40">Aucune session</p>
              ) : (
                available.map((session) => (
                  <button
                    key={session}
                    onClick={() => setSelectedAvailable(session)}
                    onDoubleClick={() => {
                      setAssigned((prev) => [...prev, session])
                      setSelectedAvailable(null)
                    }}
                    className={cn(
                      'w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-all',
                      selectedAvailable === session
                        ? 'bg-neon-purple/15 text-foreground border border-neon-purple/20'
                        : 'text-muted-foreground border border-transparent hover:bg-surface-3'
                    )}
                  >
                    {session}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Transfer buttons */}
          <div className="flex flex-col items-center justify-center gap-2">
            <button
              onClick={handleAssign}
              disabled={!selectedAvailable}
              className="rounded-lg border border-border/40 bg-surface-2 p-2 text-muted-foreground transition-all hover:text-neon-blue hover:border-neon-blue/30 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              onClick={handleUnassign}
              disabled={!selectedAssigned}
              className="rounded-lg border border-border/40 bg-surface-2 p-2 text-muted-foreground transition-all hover:text-neon-purple hover:border-neon-purple/30 disabled:opacity-20 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Assigned */}
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              Assignées
            </label>
            <div className="h-48 overflow-y-auto rounded-xl border border-border/30 bg-surface-2 p-1.5">
              {assigned.length === 0 ? (
                <p className="p-3 text-center text-xs text-muted-foreground/40">
                  Aucune session assignée
                </p>
              ) : (
                assigned.map((session) => (
                  <button
                    key={session}
                    onClick={() => setSelectedAssigned(session)}
                    onDoubleClick={() => {
                      setAssigned((prev) => prev.filter((s) => s !== session))
                      setSelectedAssigned(null)
                    }}
                    className={cn(
                      'w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-all',
                      selectedAssigned === session
                        ? 'bg-neon-blue/15 text-foreground border border-neon-blue/20'
                        : 'text-muted-foreground border border-transparent hover:bg-surface-3'
                    )}
                  >
                    {session}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Discard confirmation */}
        {showDiscardPrompt && (
          <div className="mt-4 rounded-lg border border-neon-orange/20 bg-neon-orange/5 px-4 py-3 animate-slide-up">
            <div className="flex items-center gap-2 mb-2.5">
              <AlertTriangle className="h-3.5 w-3.5 text-neon-orange" />
              <span className="text-xs font-semibold text-neon-orange">
                Modifications non sauvegardées
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDiscardPrompt(false)}
                className="flex-1 rounded-lg border border-border/40 bg-surface-2 py-2 text-xs font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-surface-3"
              >
                Continuer
              </button>
              <button
                onClick={handleDiscard}
                className="flex-1 rounded-lg border border-neon-red/30 bg-neon-red/10 py-2 text-xs font-semibold text-neon-red transition-all hover:bg-neon-red/20"
              >
                Abandonner
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-5 flex justify-end gap-2 border-t border-border/30 pt-4">
          <button
            onClick={handleClose}
            className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleSave}
            className="rounded-lg bg-neon-blue px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-neon-blue/80 hover:glow-blue"
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  )
}

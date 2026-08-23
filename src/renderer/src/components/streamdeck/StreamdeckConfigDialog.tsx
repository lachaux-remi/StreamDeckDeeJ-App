import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Eye,
  EyeOff,
  GripVertical,
  ImagePlus,
  Plus,
  Trash2,
  WifiOff,
  X
} from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { ICON_FILE_ACCEPT, readIconFile } from '@renderer/lib/icon-file'
import { useSettingsStore } from '@renderer/stores/settings.store'
import CustomSelect from '@renderer/components/ui/CustomSelect'
import ColorPicker from '@renderer/components/ui/ColorPicker'
import type {
  ConditionsState,
  LedColor,
  LedCondition,
  LedConditionType,
  StreamdeckInputConfig,
  StreamdeckInputKey
} from '@renderer/types/settings.types'

interface StreamdeckConfigDialogProps {
  buttonIndex: string | null
  onClose: () => void
}

const MODULES = [
  { value: 'home-assistant', label: 'Home Assistant' },
  { value: 'ir', label: 'Télécommande IR' },
  { value: 'macro', label: 'Macro' }
]

const CONDITION_OPTIONS: { value: LedConditionType; label: string; description?: string }[] = [
  { value: 'mic-mute', label: 'Micro muet', description: 'Système' },
  { value: 'discord-mute', label: 'Muet', description: 'Discord' },
  { value: 'discord-deafen', label: 'Sourd', description: 'Discord' },
  { value: 'discord-stream', label: 'Stream', description: 'Discord' },
  { value: 'ha-on', label: 'Actif', description: 'Home Assistant' },
  { value: 'ha-off', label: 'Inactif', description: 'Home Assistant' }
]

const DEFAULT_CONDITIONS_STATE: ConditionsState = {
  micMuted: false,
  discordMuted: false,
  discordDeafened: false,
  discordStreaming: false,
  discordConnected: false
}

interface ModuleParam {
  label: string
  placeholder: string
  type: 'text' | 'textarea' | 'password'
}

const MODULE_PARAMS: Record<string, ModuleParam[]> = {
  'home-assistant': [
    { label: 'Service', placeholder: 'ex : light.turn_on', type: 'text' },
    { label: "ID de l'entité", placeholder: 'ex : light.living_room', type: 'text' },
    { label: 'Pas brightness (%)', placeholder: 'ex : 25  (optionnel)', type: 'text' }
  ],
  ir: [{ label: 'Code infrarouge', placeholder: 'ex : 0xFFA25D', type: 'textarea' }],
  macro: [{ label: 'Code Arduino', placeholder: 'ex : open_browser', type: 'text' }]
}

function IconUpload({
  icon,
  onUpload,
  onRemove,
  size = 'md'
}: {
  icon?: string
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemove: () => void
  size?: 'md' | 'sm'
}): React.JSX.Element {
  const boxSize = size === 'md' ? 'h-16 w-16' : 'h-11 w-11'
  const imgSize = size === 'md' ? 'h-12 w-12' : 'h-8 w-8'
  const iconSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4'

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-xl border border-dashed bg-surface-2',
          boxSize,
          icon ? 'border-neon-purple/30' : 'border-border'
        )}
      >
        {icon ? (
          <div
            className={cn(imgSize, 'bg-foreground')}
            style={{
              maskImage: `url(${icon})`,
              maskSize: 'contain',
              maskRepeat: 'no-repeat',
              maskPosition: 'center',
              WebkitMaskImage: `url(${icon})`,
              WebkitMaskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center'
            }}
          />
        ) : (
          <ImagePlus className={cn(iconSize, 'text-muted-foreground/30')} />
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="cursor-pointer rounded-lg bg-surface-3 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground hover:bg-surface-4">
          Choisir un fichier
          <input type="file" accept={ICON_FILE_ACCEPT} onChange={onUpload} className="hidden" />
        </label>
        {icon && (
          <button
            onClick={onRemove}
            className="text-[11px] text-neon-red/60 hover:text-neon-red transition-colors"
          >
            Supprimer
          </button>
        )}
      </div>
    </div>
  )
}

export default function StreamdeckConfigDialog({
  buttonIndex,
  onClose
}: StreamdeckConfigDialogProps): React.JSX.Element | null {
  const { streamdeck } = useSettingsStore((s) => s.settings)
  const { updateStreamdeckButton, removeStreamdeckButton } = useSettingsStore()

  const [pressed, setPressed] = useState<StreamdeckInputKey | undefined>()
  const [hold, setHold] = useState<StreamdeckInputKey | undefined>()
  const [mainIcon, setMainIcon] = useState<string | undefined>()
  const [ledOverrideEnabled, setLedOverrideEnabled] = useState(false)
  const [ledColor, setLedColor] = useState<LedColor>({ r: 255, g: 0, b: 255 })
  const [ledConditions, setLedConditions] = useState<LedCondition[]>([])
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)
  const [conditionsState, setConditionsState] = useState<ConditionsState>(DEFAULT_CONDITIONS_STATE)
  const [activeTab, setActiveTab] = useState<'pressed' | 'hold'>('pressed')
  const [tabDirection, setTabDirection] = useState<'left' | 'right'>('right')
  const hasTabSwitched = useRef(false)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false)

  useEffect(() => {
    if (buttonIndex !== null) {
      const config = streamdeck[buttonIndex]
      setPressed(config?.pressed)
      setHold(config?.hold)
      setMainIcon(config?.icon)
      setLedOverrideEnabled(!!config?.color)
      setLedColor(config?.color ?? { r: 255, g: 0, b: 255 })
      setLedConditions(config?.ledConditions ?? [])
      setActiveTab('pressed')
      setShowDiscardPrompt(false)
      hasTabSwitched.current = false

      void window.api.conditions.getState().then(setConditionsState)
    }
  }, [buttonIndex, streamdeck])

  useEffect(() => {
    if (buttonIndex === null) return
    return window.api.conditions.onChange((partial) => {
      setConditionsState((prev) => ({ ...prev, ...partial }))
    })
  }, [buttonIndex])

  const hasChanges = useMemo(() => {
    if (buttonIndex === null) return false
    const original = streamdeck[buttonIndex]
    return (
      JSON.stringify(pressed) !== JSON.stringify(original?.pressed) ||
      JSON.stringify(hold) !== JSON.stringify(original?.hold) ||
      mainIcon !== original?.icon ||
      JSON.stringify(original?.color ?? null) !==
        JSON.stringify(ledOverrideEnabled ? ledColor : null) ||
      JSON.stringify(original?.ledConditions ?? []) !== JSON.stringify(ledConditions)
    )
  }, [
    buttonIndex,
    streamdeck,
    pressed,
    hold,
    mainIcon,
    ledOverrideEnabled,
    ledColor,
    ledConditions
  ])

  const sendLedPreview = useCallback(
    (enabled: boolean, color: LedColor) => {
      if (buttonIndex === null) return
      void window.api.streamdeck.setLedOverride(streamdeck, buttonIndex, enabled ? color : null)
    },
    [buttonIndex, streamdeck]
  )

  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowDiscardPrompt(true)
    } else {
      onClose()
    }
  }, [hasChanges, onClose])

  const handleDiscard = useCallback(() => {
    setShowDiscardPrompt(false)
    if (buttonIndex !== null) {
      const original = streamdeck[buttonIndex]
      sendLedPreview(!!original?.color, original?.color ?? { r: 255, g: 0, b: 255 })
    }
    onClose()
  }, [onClose, buttonIndex, streamdeck, sendLedPreview])

  const handleSave = useCallback(() => {
    if (buttonIndex === null) return
    const config: StreamdeckInputConfig = {}
    if (mainIcon) config.icon = mainIcon
    if (ledOverrideEnabled) config.color = ledColor
    if (ledConditions.length > 0) config.ledConditions = ledConditions
    if (pressed?.module || pressed?.icon) config.pressed = pressed
    if (hold?.module || hold?.icon) config.hold = hold
    updateStreamdeckButton(buttonIndex, config)
    onClose()
  }, [
    buttonIndex,
    mainIcon,
    ledOverrideEnabled,
    ledColor,
    ledConditions,
    pressed,
    hold,
    updateStreamdeckButton,
    onClose
  ])

  const handleDelete = useCallback(() => {
    if (buttonIndex === null) return
    removeStreamdeckButton(buttonIndex)
    onClose()
  }, [buttonIndex, removeStreamdeckButton, onClose])

  const currentAction = activeTab === 'pressed' ? pressed : hold
  const setCurrentAction = activeTab === 'pressed' ? setPressed : setHold

  const handleMainIconUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    void readIconFile(file).then((iconData) => {
      if (iconData) setMainIcon(iconData)
    })
  }, [])

  const handleActionIconUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return
      void readIconFile(file).then((iconData) => {
        if (!iconData) return
        setCurrentAction((prev) =>
          prev ? { ...prev, icon: iconData } : { module: '', params: [''], icon: iconData }
        )
      })
    },
    [setCurrentAction]
  )

  if (buttonIndex === null) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative w-full max-w-2xl overflow-x-clip rounded-2xl border border-border/50 bg-surface-1 p-6 shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold">
            Bouton <span className="text-neon-purple">{parseInt(buttonIndex) + 1}</span>
          </h3>
          <button
            onClick={handleClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Two-column body */}
        <div className="grid grid-cols-2 items-start divide-x divide-border/20">
          {/* Left column : LED */}
          <div className="space-y-5 pr-6">
            {/* Main icon */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Icône principale
              </label>
              <IconUpload
                icon={mainIcon}
                onUpload={handleMainIconUpload}
                onRemove={() => setMainIcon(undefined)}
                size="md"
              />
            </div>

            {/* LED override */}
            <div>
              <label className="group flex cursor-pointer items-center justify-between gap-3 text-muted-foreground hover:text-foreground transition-colors">
                <div>
                  <span className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 group-hover:text-muted-foreground/80 transition-colors">
                    Couleur LED
                  </span>
                  {!ledOverrideEnabled && (
                    <p className="text-[11px] text-muted-foreground/30">
                      Suit l{"'"}animation globale
                    </p>
                  )}
                </div>
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={ledOverrideEnabled}
                    onChange={(e) => {
                      const enabled = e.target.checked
                      setLedOverrideEnabled(enabled)
                      sendLedPreview(enabled, ledColor)
                    }}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full border border-border/50 bg-surface-3 transition-all duration-300 peer-checked:border-neon-pink/40 peer-checked:bg-neon-pink/20 peer-checked:shadow-[0_0_8px_#f472b64d]" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-muted-foreground/40 shadow-sm transition-all duration-300 peer-checked:left-[22px] peer-checked:bg-neon-pink peer-checked:shadow-[0_0_6px_#f472b680]" />
                </div>
              </label>

              {ledOverrideEnabled && (
                <div className="mt-3 animate-fade-in">
                  <ColorPicker
                    value={ledColor}
                    onChange={(c) => {
                      setLedColor(c)
                      sendLedPreview(true, c)
                    }}
                  />
                </div>
              )}
            </div>

            {/* LED conditions */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Conditions LED
                </span>
                <button
                  onClick={() =>
                    setLedConditions((prev) => [
                      ...prev,
                      { type: 'mic-mute', color: { r: 255, g: 0, b: 0 } }
                    ])
                  }
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground/50 hover:text-neon-pink hover:bg-neon-pink/10 transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Ajouter
                </button>
              </div>

              {ledConditions.some((c) => c.type.startsWith('discord')) &&
                !conditionsState.discordConnected && (
                  <div className="mb-2 flex items-center gap-2 rounded-lg border border-neon-orange/20 bg-neon-orange/5 px-3 py-2">
                    <WifiOff className="h-3 w-3 shrink-0 text-neon-orange/70" />
                    <span className="text-[11px] text-neon-orange/70">Discord non connecté</span>
                  </div>
                )}

              {ledConditions.length === 0 ? (
                <p className="text-[11px] text-muted-foreground/30">Aucune condition configurée</p>
              ) : (
                <div className="space-y-2">
                  {ledConditions.map((cond, idx) => (
                    <div
                      key={idx}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = 'move'
                        setDragIndex(idx)
                      }}
                      onDragOver={(e) => {
                        e.preventDefault()
                        e.dataTransfer.dropEffect = 'move'
                        if (dragOverIndex !== idx) setDragOverIndex(idx)
                      }}
                      onDragLeave={() => setDragOverIndex(null)}
                      onDrop={(e) => {
                        e.preventDefault()
                        if (dragIndex !== null && dragIndex !== idx) {
                          setLedConditions((prev) => {
                            const next = [...prev]
                            const [item] = next.splice(dragIndex, 1)
                            next.splice(idx, 0, item)
                            return next
                          })
                        }
                        setDragIndex(null)
                        setDragOverIndex(null)
                      }}
                      onDragEnd={() => {
                        setDragIndex(null)
                        setDragOverIndex(null)
                      }}
                      className={cn(
                        'flex items-center gap-2 rounded-lg border bg-surface-2/50 px-2 py-2 transition-colors',
                        dragOverIndex === idx
                          ? 'border-neon-pink/50 bg-neon-pink/5'
                          : dragIndex === idx
                            ? 'border-border/30 opacity-40'
                            : 'border-border/30'
                      )}
                    >
                      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/20 active:cursor-grabbing" />

                      <div className="flex-1 min-w-0">
                        <CustomSelect
                          value={cond.type}
                          onChange={(val) => {
                            setLedConditions((prev) =>
                              prev.map((c, i) =>
                                i === idx ? { ...c, type: val as LedConditionType } : c
                              )
                            )
                          }}
                          options={CONDITION_OPTIONS}
                          accent="pink"
                        />
                      </div>

                      <div className="shrink-0 flex items-center">
                        <ColorPicker
                          value={cond.color}
                          onChange={(c) => {
                            setLedConditions((prev) =>
                              prev.map((item, i) => (i === idx ? { ...item, color: c } : item))
                            )
                          }}
                          compact
                        />
                      </div>

                      <button
                        onClick={() => setLedConditions((prev) => prev.filter((_, i) => i !== idx))}
                        className="shrink-0 rounded p-1 text-muted-foreground/30 hover:text-neon-red transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column : Actions */}
          <div className="space-y-4 overflow-hidden pl-6">
            {/* Tabs */}
            <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
              {(['pressed', 'hold'] as const).map((tab) => {
                const tabAction = tab === 'pressed' ? pressed : hold
                return (
                  <button
                    key={tab}
                    onClick={() => {
                      hasTabSwitched.current = true
                      setTabDirection(tab === 'hold' ? 'right' : 'left')
                      setActiveTab(tab)
                    }}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all duration-200',
                      activeTab === tab
                        ? tab === 'pressed'
                          ? 'bg-neon-purple/20 text-neon-purple border border-neon-purple/20'
                          : 'bg-neon-blue/20 text-neon-blue border border-neon-blue/20'
                        : 'text-muted-foreground/50 border border-transparent hover:text-muted-foreground'
                    )}
                  >
                    {tabAction?.icon && (
                      <div
                        className="h-4 w-4 bg-current"
                        style={{
                          maskImage: `url(${tabAction.icon})`,
                          maskSize: 'contain',
                          maskRepeat: 'no-repeat',
                          maskPosition: 'center',
                          WebkitMaskImage: `url(${tabAction.icon})`,
                          WebkitMaskSize: 'contain',
                          WebkitMaskRepeat: 'no-repeat',
                          WebkitMaskPosition: 'center'
                        }}
                      />
                    )}
                    {tab === 'pressed' ? 'Appui' : 'Maintien'}
                  </button>
                )
              })}
            </div>

            {/* Action config */}
            <div
              key={activeTab}
              className={cn(
                'space-y-3',
                hasTabSwitched.current &&
                  (tabDirection === 'right' ? 'animate-slide-tab-right' : 'animate-slide-tab-left')
              )}
            >
              {/* Action icon */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Icône d{"'"}action
                </label>
                <IconUpload
                  icon={currentAction?.icon}
                  onUpload={handleActionIconUpload}
                  onRemove={() =>
                    setCurrentAction((prev) => (prev ? { ...prev, icon: undefined } : undefined))
                  }
                  size="sm"
                />
              </div>

              {/* Module */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                  Module
                </label>
                <CustomSelect
                  value={currentAction?.module || ''}
                  onChange={(mod) => {
                    const paramDefs = MODULE_PARAMS[mod]
                    setCurrentAction((prev) =>
                      mod
                        ? {
                            module: mod,
                            params: paramDefs
                              ? paramDefs.map((_, i) => prev?.params?.[i] || '')
                              : [''],
                            icon: prev?.icon
                          }
                        : prev?.icon
                          ? { module: '', params: [''], icon: prev.icon }
                          : undefined
                    )
                  }}
                  options={[
                    { value: '', label: 'Aucun' },
                    ...MODULES.map((m) => ({ value: m.value, label: m.label }))
                  ]}
                  placeholder="Aucun"
                  accent={activeTab === 'hold' ? 'blue' : 'purple'}
                />
              </div>

              {/* Parameters */}
              {currentAction?.module && MODULE_PARAMS[currentAction.module] && (
                <div className="space-y-2">
                  {MODULE_PARAMS[currentAction.module].map((paramDef, i) => {
                    const inputClass = cn(
                      'w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none transition-colors',
                      activeTab === 'hold'
                        ? 'focus:border-neon-blue/50'
                        : 'focus:border-neon-purple/50'
                    )
                    const value = currentAction.params?.[i] || ''
                    const onChange = (
                      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
                    ): void => {
                      const params = [...(currentAction.params || [])]
                      params[i] = e.target.value
                      setCurrentAction((prev) => (prev ? { ...prev, params } : prev))
                    }

                    return (
                      <div key={paramDef.label}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                          {paramDef.label}
                        </label>
                        {paramDef.type === 'textarea' ? (
                          <textarea
                            value={value}
                            onChange={onChange}
                            placeholder={paramDef.placeholder}
                            rows={3}
                            className={cn(inputClass, 'resize-none')}
                          />
                        ) : paramDef.type === 'password' ? (
                          <div className="relative">
                            <input
                              type={showPasswords[paramDef.label] ? 'text' : 'password'}
                              value={value}
                              onChange={onChange}
                              placeholder={paramDef.placeholder}
                              className={cn(inputClass, 'pr-10')}
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setShowPasswords((prev) => ({
                                  ...prev,
                                  [paramDef.label]: !prev[paramDef.label]
                                }))
                              }
                              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground/40 hover:text-foreground transition-colors"
                            >
                              {showPasswords[paramDef.label] ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <input
                            type="text"
                            value={value}
                            onChange={onChange}
                            placeholder={paramDef.placeholder}
                            className={inputClass}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
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

        {/* Footer */}
        <div className="mt-6 flex items-center justify-between border-t border-border/30 pt-4">
          <button
            onClick={handleDelete}
            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs text-neon-red/60 hover:text-neon-red hover:bg-neon-red/10 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Supprimer
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleClose}
              className="rounded-lg px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleSave}
              className="rounded-lg bg-neon-purple px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-neon-purple/80 hover:glow-purple"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

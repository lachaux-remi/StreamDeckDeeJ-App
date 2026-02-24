import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Cpu, Grid3X3, Home, Info, Monitor, RefreshCw, Settings, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useSerialStore } from '@renderer/stores/serial.store'
import CustomSelect from '@renderer/components/ui/CustomSelect'

interface SettingsSheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsSheet({
  isOpen,
  onClose
}: SettingsSheetProps): React.JSX.Element | null {
  const settings = useSettingsStore((s) => s.settings)
  const updateConfig = useSettingsStore((s) => s.updateConfig)
  const serialPorts = useSerialStore((s) => s.serialPorts)
  const setSerialPorts = useSerialStore((s) => s.setSerialPorts)
  const versions = useSerialStore((s) => s.versions)

  const [localSettings, setLocalSettings] = useState(settings)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false)

  const hasChanges = useMemo(
    () => JSON.stringify(localSettings) !== JSON.stringify(settings),
    [localSettings, settings]
  )

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings)
      setShowDiscardPrompt(false)
    }
  }, [isOpen, settings])

  const handleClose = useCallback(() => {
    if (hasChanges) {
      setShowDiscardPrompt(true)
    } else {
      onClose()
    }
  }, [hasChanges, onClose])

  const handleDiscard = useCallback(() => {
    setShowDiscardPrompt(false)
    setLocalSettings(settings)
    onClose()
  }, [settings, onClose])

  const refreshPorts = useCallback(async () => {
    setIsRefreshing(true)
    const ports = await window.api.serial.list()
    setSerialPorts(ports)
    setTimeout(() => setIsRefreshing(false), 500)
  }, [setSerialPorts])

  const handleSave = useCallback(() => {
    updateConfig(localSettings)
    onClose()
  }, [localSettings, updateConfig, onClose])

  if (!isOpen) return null

  const inputClass =
    'w-full rounded-lg border border-border/40 bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-neon-purple/50 focus:bg-surface-3'


  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      {/* Sheet */}
      <div className="fixed inset-y-0 right-0 z-50 w-[380px] border-l border-border/30 bg-surface-0 shadow-2xl animate-slide-in-right">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/30 px-6 py-4">
            <div className="flex items-center gap-2.5">
              <Settings className="h-4 w-4 text-neon-purple/70" />
              <h2 className="font-display text-lg font-bold tracking-wide">Paramètres</h2>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-3 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Micro controller */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5 text-neon-purple" />
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neon-purple">
                  Microcontrôleur
                </h3>
<div className="gradient-line-h flex-1" />
              </div>
              <div className="space-y-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                    Port série
                  </label>
                  <div className="flex gap-2">
                    <CustomSelect
                      value={localSettings.comPort}
                      onChange={(val) =>
                        setLocalSettings({ ...localSettings, comPort: val })
                      }
                      options={[
                        ...serialPorts.map((port) => {
                          const name = port.displayName.replace(/\s*\(.*\)$/, '')
                          const details = [port.manufacturer, port.path].filter(Boolean).join(' — ')
                          return {
                            value: port.path,
                            label: name,
                            description: details
                          }
                        }),
                        ...(!serialPorts.some((p) => p.path === localSettings.comPort)
                          ? [{ value: localSettings.comPort, label: localSettings.comPort }]
                          : [])
                      ]}
                      placeholder="Sélectionner un port..."
                      className="flex-1"
                    />
                    <button
                      onClick={refreshPorts}
                      className="rounded-lg border border-border/40 bg-surface-2 p-2.5 text-muted-foreground transition-all hover:text-neon-purple hover:border-neon-purple/30 hover:bg-surface-3"
                    >
                      <RefreshCw
                        className={cn('h-4 w-4 transition-transform', isRefreshing && 'animate-spin')}
                      />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                    Débit en bauds
                  </label>
                  <CustomSelect
                    value={String(localSettings.baudRate)}
                    onChange={(val) =>
                      setLocalSettings({ ...localSettings, baudRate: parseInt(val) })
                    }
                    options={[
                      { value: '9600', label: '9600' },
                      { value: '115200', label: '115200' }
                    ]}
                  />
                </div>
              </div>
            </section>

            {/* Grid & Sliders */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Grid3X3 className="h-3.5 w-3.5 text-neon-blue" />
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neon-blue">
                  Disposition
                </h3>
<div className="gradient-line-h flex-1" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                    Colonnes
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={localSettings.gridCols}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        gridCols: parseInt(e.target.value) || 4
                      })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                    Lignes
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={localSettings.gridRows}
                    onChange={(e) =>
                      setLocalSettings({
                        ...localSettings,
                        gridRows: parseInt(e.target.value) || 4
                      })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                  Nombre de sliders
                </label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={localSettings.sliderCount}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      sliderCount: parseInt(e.target.value) || 4
                    })
                  }
                  className={inputClass}
                />
              </div>
              <label className="group mt-3 flex cursor-pointer items-center gap-3 text-muted-foreground hover:text-foreground transition-colors">
                <div className="relative flex-shrink-0">
                  <input
                    type="checkbox"
                    checked={localSettings.invertSliders}
                    onChange={(e) =>
                      setLocalSettings({ ...localSettings, invertSliders: e.target.checked })
                    }
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full border border-border/50 bg-surface-3 transition-all duration-300 peer-checked:border-neon-blue/40 peer-checked:bg-neon-blue/20 peer-checked:shadow-[0_0_8px_#38bdf84d]" />
                  <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-muted-foreground/40 shadow-sm transition-all duration-300 peer-checked:left-[22px] peer-checked:bg-neon-blue peer-checked:shadow-[0_0_6px_#38bdf880]" />
                </div>
                <div>
                  <span className="block text-xs font-medium">Inverser les sliders</span>
                  <p className="text-[11px] text-muted-foreground/40 whitespace-nowrap">Inverser les valeurs (0-100 → 100-0)</p>
                </div>
              </label>
            </section>

            {/* Home Assistant */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Home className="h-3.5 w-3.5 text-neon-green" />
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neon-green">
                  Home Assistant
                </h3>
<div className="gradient-line-h flex-1" />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                  URL
                </label>
                <input
                  type="text"
                  value={localSettings.homeAssistant.url}
                  onChange={(e) =>
                    setLocalSettings({
                      ...localSettings,
                      homeAssistant: { ...localSettings.homeAssistant, url: e.target.value }
                    })
                  }
                  placeholder="http://homeassistant.local:8123"
                  className={inputClass}
                />
              </div>
            </section>

            {/* App config */}
            <section>
              <div className="mb-3 flex items-center gap-2">
                <Monitor className="h-3.5 w-3.5 text-neon-cyan" />
                <h3 className="font-display text-xs font-bold uppercase tracking-widest text-neon-cyan">
                  Application
                </h3>
<div className="gradient-line-h flex-1" />
              </div>
              <div className="space-y-2.5">
                {[
                  { key: 'runOnStartup' as const, label: 'Lancer au démarrage', desc: "Démarrer l'application avec le système" },
                  { key: 'runInBackground' as const, label: "Démarrer en arrière-plan", desc: "Lancer minimisé en arrière-plan" },
                  { key: 'closeToTray' as const, label: 'Minimiser dans la barre des tâches', desc: 'Minimiser dans la zone de notification' },
                  { key: 'devTools' as const, label: 'Outils de développement', desc: 'Ouvrir les DevTools au lancement' }
                ].map(({ key, label, desc }) => (
                  <label
                    key={key}
                    className="group flex cursor-pointer items-center gap-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <div className="relative flex-shrink-0">
                      <input
                        type="checkbox"
                        checked={localSettings[key]}
                        onChange={(e) =>
                          setLocalSettings({ ...localSettings, [key]: e.target.checked })
                        }
                        className="peer sr-only"
                      />
                      <div className="h-6 w-11 rounded-full border border-border/50 bg-surface-3 transition-all duration-300 peer-checked:border-neon-cyan/40 peer-checked:bg-neon-cyan/20 peer-checked:shadow-[0_0_8px_#22d3ee4d]" />
                      <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-muted-foreground/40 shadow-sm transition-all duration-300 peer-checked:left-[22px] peer-checked:bg-neon-cyan peer-checked:shadow-[0_0_6px_#22d3ee80]" />
                    </div>
                    <div>
                      <span className="block text-xs font-medium">{label}</span>
                      <p className="text-[11px] text-muted-foreground/40">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>

            {/* About */}
            {versions && (
              <section>
                <div className="mb-3 flex items-center gap-2">
                  <Info className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <h3 className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground/50">
                    À propos
                  </h3>
                  <div className="gradient-line-h flex-1" />
                </div>
                <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground/50">
                  <span className="font-semibold text-muted-foreground">StreamDeck DeeJ</span> est un mélangeur de volume mais aussi un Stream Deck pour les PC. Il se compose d{"'"}un client de bureau léger écrit en JavaScript avec Electron et d{"'"}une configuration matérielle basée sur Raspberry Pi Pico simple et peu coûteuse à construire.
                </p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-lg bg-surface-2/50 p-3">
                  {[
                    { label: 'App', value: versions.app },
                    { label: 'Electron', value: versions.electron },
                    { label: 'Node', value: versions.node },
                    { label: 'Chrome', value: versions.chrome }
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground/50">{label}</span>
                      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                        v{value}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Discard confirmation */}
          {showDiscardPrompt && (
            <div className="border-t border-neon-orange/20 bg-neon-orange/5 px-6 py-3 animate-slide-up">
              <div className="flex items-center gap-2 mb-2.5">
                <AlertTriangle className="h-3.5 w-3.5 text-neon-orange" />
                <span className="text-xs font-semibold text-neon-orange">Modifications non sauvegardées</span>
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
          <div className="border-t border-border/30 px-6 py-4">
            <div className="flex gap-2">
              <button
                onClick={handleClose}
                className="flex-1 rounded-lg border border-border/40 bg-surface-2 py-2.5 text-xs font-semibold text-muted-foreground transition-all hover:text-foreground hover:bg-surface-3"
              >
                Annuler
              </button>
              <button
                onClick={handleSave}
                className="flex-1 rounded-lg bg-neon-purple py-2.5 text-xs font-semibold text-white transition-all hover:bg-neon-purple/80 hover:glow-purple"
              >
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

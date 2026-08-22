import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Cpu, Eye, EyeOff, Grid3X3, Headphones, Home, Monitor, RefreshCw, Settings, Sparkles, X } from 'lucide-react'
import { cn } from '@renderer/lib/utils'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useSerialStore } from '@renderer/stores/serial.store'
import CustomSelect from '@renderer/components/ui/CustomSelect'
import ColorPicker from '@renderer/components/ui/ColorPicker'
import type { LedMode, SecretChange } from '@renderer/types/settings.types'

const LED_MODES: { value: LedMode; label: string; description: string }[] = [
  { value: 'static', label: 'Statique', description: 'Couleur fixe uniforme' },
  { value: 'rainbow', label: 'Arc-en-ciel', description: 'Spectre HSV animé' },
  { value: 'wave', label: 'Vague', description: 'Onde sinusoïdale de couleur' },
  { value: 'pulse', label: 'Pulsation', description: 'Respiration entre couleur et noir' },
  { value: 'colorshift', label: 'Transition', description: 'Dégradé entre deux couleurs' },
  { value: 'visor', label: 'Visor', description: 'Faisceau lumineux glissant' },
  { value: 'sequential', label: 'Séquentiel', description: 'Allumage progressif bouton par bouton' },
  { value: 'spinner', label: 'Spinner', description: 'Bouton lumineux tournant' }
]

const MODES_WITH_END_COLOR: LedMode[] = ['wave', 'colorshift', 'visor']
const MODES_WITH_DIRECTION: LedMode[] = ['wave', 'visor']
const MODES_WITH_SPEED: LedMode[] = ['rainbow', 'wave', 'pulse', 'colorshift', 'visor', 'sequential', 'spinner']

type Tab = 'hardware' | 'integrations' | 'rgb'

const TABS: { id: Tab; label: string; icon: React.ReactNode; accent: string }[] = [
  { id: 'hardware', label: 'Système', icon: <Cpu className="h-3.5 w-3.5" />, accent: 'neon-purple' },
  { id: 'integrations', label: 'Intégrations', icon: <Home className="h-3.5 w-3.5" />, accent: 'neon-green' },
  { id: 'rgb', label: 'RGB', icon: <Sparkles className="h-3.5 w-3.5" />, accent: 'neon-pink' }
]

interface SettingsSheetProps {
  isOpen: boolean
  onClose: () => void
}

export default function SettingsSheet({ isOpen, onClose }: SettingsSheetProps): React.JSX.Element | null {
  const settings = useSettingsStore((s) => s.settings)
  const updateConfig = useSettingsStore((s) => s.updateConfig)
  const serialPorts = useSerialStore((s) => s.serialPorts)
  const setSerialPorts = useSerialStore((s) => s.setSerialPorts)
  const versions = useSerialStore((s) => s.versions)

  const [localSettings, setLocalSettings] = useState(settings)
  const [activeTab, setActiveTab] = useState<Tab>('hardware')
  const [tabDirection, setTabDirection] = useState<'left' | 'right'>('right')
  const hasTabSwitched = useRef(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false)
  const [showHAToken, setShowHAToken] = useState(false)
  const [showDiscordSecret, setShowDiscordSecret] = useState(false)
  const [haTokenChange, setHATokenChange] = useState<SecretChange>({ action: 'unchanged' })
  const [discordSecretChange, setDiscordSecretChange] = useState<SecretChange>({
    action: 'unchanged'
  })
  const [clearDiscordTokens, setClearDiscordTokens] = useState(false)

  const hasChanges = useMemo(
    () =>
      JSON.stringify(localSettings) !== JSON.stringify(settings) ||
      haTokenChange.action !== 'unchanged' ||
      discordSecretChange.action !== 'unchanged' ||
      clearDiscordTokens,
    [localSettings, settings, haTokenChange.action, discordSecretChange.action, clearDiscordTokens]
  )

  useEffect(() => {
    if (isOpen) {
      setLocalSettings(settings)
      setShowDiscardPrompt(false)
      setHATokenChange({ action: 'unchanged' })
      setDiscordSecretChange({ action: 'unchanged' })
      setClearDiscordTokens(false)
    }
  }, [isOpen, settings])

  useEffect(() => {
    if (!isOpen) return
    void window.api.streamdeck.setLedProfile(localSettings.ledProfile)
  }, [localSettings.ledProfile, isOpen])

  const handleClose = useCallback(() => {
    if (hasChanges) setShowDiscardPrompt(true)
    else onClose()
  }, [hasChanges, onClose])

  const handleDiscard = useCallback(() => {
    setShowDiscardPrompt(false)
    setLocalSettings(settings)
    setHATokenChange({ action: 'unchanged' })
    setDiscordSecretChange({ action: 'unchanged' })
    setClearDiscordTokens(false)
    onClose()
  }, [settings, onClose])

  const refreshPorts = useCallback(async () => {
    setIsRefreshing(true)
    const ports = await window.api.serial.list()
    setSerialPorts(ports)
    setTimeout(() => setIsRefreshing(false), 500)
  }, [setSerialPorts])

  const handleSave = useCallback(async () => {
    const homeAssistantTokenConfigured = secretConfigured(
      localSettings.homeAssistant.tokenConfigured,
      haTokenChange
    )
    const discordClientSecretConfigured = secretConfigured(
      localSettings.discord.clientSecretConfigured,
      discordSecretChange
    )
    const settingsToSave = {
      ...localSettings,
      homeAssistant: {
        ...localSettings.homeAssistant,
        tokenConfigured: homeAssistantTokenConfigured
      },
      discord: {
        ...localSettings.discord,
        clientSecretConfigured: discordClientSecretConfigured,
        authenticated:
          localSettings.discord.authenticated &&
          !clearDiscordTokens &&
          discordSecretChange.action === 'unchanged'
      }
    }
    await updateConfig(settingsToSave, {
      homeAssistantToken: haTokenChange,
      discordClientSecret: discordSecretChange,
      discordTokens:
        clearDiscordTokens || discordSecretChange.action !== 'unchanged' ? 'clear' : 'unchanged'
    })
    onClose()
  }, [localSettings, haTokenChange, discordSecretChange, clearDiscordTokens, updateConfig, onClose])

  if (!isOpen) return null

  const inputBase = 'w-full rounded-lg border border-border/40 bg-surface-2 px-3 py-2 text-sm text-foreground outline-none transition-colors focus:bg-surface-3'
  const inputBlue  = `${inputBase} focus:border-neon-blue/50`
  const inputGreen = `${inputBase} focus:border-neon-green/50`
  const inputDiscord = `${inputBase} focus:border-[#5865F2]/50`

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 w-[400px] border-l border-border/30 bg-surface-0 shadow-2xl animate-slide-in-right">
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

          {/* Tabs */}
          <div className="flex border-b border-border/20 px-3 pt-3 gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  const currentIdx = TABS.findIndex((t) => t.id === activeTab)
                  const nextIdx = TABS.findIndex((t) => t.id === tab.id)
                  if (nextIdx !== currentIdx) {
                    hasTabSwitched.current = true
                    setTabDirection(nextIdx > currentIdx ? 'right' : 'left')
                    setActiveTab(tab.id)
                  }
                }}
                className={cn(
                  'flex flex-1 items-center justify-center gap-1.5 rounded-t-lg px-2 pb-2.5 pt-2 text-[11px] font-semibold uppercase tracking-wider transition-all',
                  activeTab === tab.id
                    ? `text-${tab.accent} border-b-2 border-${tab.accent}`
                    : 'text-muted-foreground/50 hover:text-muted-foreground border-b-2 border-transparent'
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 py-5">
          <div
            key={activeTab}
            className={cn(
              'space-y-6',
              hasTabSwitched.current && (tabDirection === 'right' ? 'animate-slide-tab-right' : 'animate-slide-tab-left')
            )}
          >
            {/* ── Matériel ── */}
            {activeTab === 'hardware' && (
              <>
                <section>
                  <SectionTitle
                    icon={<Cpu className="h-3.5 w-3.5 text-neon-purple" />}
                    label="Microcontrôleur"
                    color="text-neon-purple"
                  />
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                        Port série
                      </label>
                      <div className="flex gap-2">
                        <CustomSelect
                          value={localSettings.comPort}
                          onChange={(val) => setLocalSettings({ ...localSettings, comPort: val })}
                          options={[
                            ...serialPorts.map((port) => ({
                              value: port.path,
                              label: port.displayName.replace(/\s*\(.*\)$/, ''),
                              description: [port.official ? 'Module officiel' : port.manufacturer, port.path]
                                .filter(Boolean)
                                .join(' — ')
                            })),
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
                            className={cn(
                              'h-4 w-4 transition-transform',
                              isRefreshing && 'animate-spin'
                            )}
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

                <section>
                  <SectionTitle
                    icon={<Grid3X3 className="h-3.5 w-3.5 text-neon-blue" />}
                    label="Disposition"
                    color="text-neon-blue"
                  />
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
                        className={inputBlue}
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
                        className={inputBlue}
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
                      className={inputBlue}
                    />
                  </div>
                  <Toggle
                    checked={localSettings.invertSliders}
                    onChange={(v) => setLocalSettings({ ...localSettings, invertSliders: v })}
                    label="Inverser les sliders"
                    desc="Inverser les valeurs (0-100 → 100-0)"
                    color="neon-blue"
                    className="mt-3"
                  />
                </section>

                <section>
                  <SectionTitle
                    icon={<Monitor className="h-3.5 w-3.5 text-neon-cyan" />}
                    label="Application"
                    color="text-neon-cyan"
                  />
                  <div className="space-y-2.5">
                    {(
                      [
                        {
                          key: 'runOnStartup',
                          label: 'Lancer au démarrage',
                          desc: "Démarrer l'application avec le système"
                        },
                        {
                          key: 'runInBackground',
                          label: 'Démarrer en arrière-plan',
                          desc: 'Lancer minimisé en arrière-plan'
                        },
                        {
                          key: 'closeToTray',
                          label: 'Minimiser dans la barre',
                          desc: 'Minimiser dans la zone de notification'
                        },
                        {
                          key: 'devTools',
                          label: 'Outils de développement',
                          desc: 'Ouvrir les DevTools au lancement'
                        }
                      ] as { key: keyof typeof localSettings; label: string; desc: string }[]
                    ).map(({ key, label, desc }) => (
                      <Toggle
                        key={key}
                        checked={localSettings[key] as boolean}
                        onChange={(v) => setLocalSettings({ ...localSettings, [key]: v })}
                        label={label}
                        desc={desc}
                        color="neon-cyan"
                      />
                    ))}
                  </div>
                </section>
              </>
            )}

            {/* ── Intégrations ── */}
            {activeTab === 'integrations' && (
              <>
                <section>
                  <SectionTitle
                    icon={<Home className="h-3.5 w-3.5 text-neon-green" />}
                    label="Home Assistant"
                    color="text-neon-green"
                  />
                  <div className="mb-3 rounded-lg border border-border/20 bg-surface-2/50 px-3 py-2.5 space-y-1">
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                      Nécessaire pour les actions des boutons et les conditions LED{' '}
                      <span className="text-neon-green">Actif</span> et{' '}
                      <span className="text-neon-green">Inactif</span>{' '}
                      (Home Assistant).
                    </p>
                    <p className="text-[11px] text-muted-foreground/40">
                      Profil HA › Tokens d&apos;accès longue durée › Créer un token
                    </p>
                  </div>
                  <div className="space-y-3">
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
                        className={inputGreen}
                      />
                      {localSettings.homeAssistant.url &&
                        !localSettings.homeAssistant.url.trim().toLowerCase().startsWith('https://') && (
                          <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-neon-orange">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            Cette URL n&apos;utilise pas HTTPS. Le token peut circuler en clair ; HTTP
                            reste autorisé pour les installations locales.
                          </p>
                        )}
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground/70">
                          Token (Long-Lived Access Token)
                        </label>
                        <ConfiguredState
                          configured={secretConfigured(
                            localSettings.homeAssistant.tokenConfigured,
                            haTokenChange
                          )}
                        />
                      </div>
                      <PasswordInput
                        value={secretInputValue(haTokenChange)}
                        onChange={(v) =>
                          setHATokenChange(
                            v ? { action: 'set', value: v } : { action: 'unchanged' }
                          )
                        }
                        show={showHAToken}
                        onToggle={() => setShowHAToken((s) => !s)}
                        className={`${inputGreen} pr-9`}
                      />
                      {(localSettings.homeAssistant.tokenConfigured ||
                        haTokenChange.action !== 'unchanged') && (
                        <button
                          type="button"
                          onClick={() =>
                            setHATokenChange(
                              haTokenChange.action === 'clear'
                                ? { action: 'unchanged' }
                                : { action: 'clear' }
                            )
                          }
                          className="mt-1.5 text-[11px] text-neon-red/60 transition-colors hover:text-neon-red"
                        >
                          {haTokenChange.action === 'clear'
                            ? 'Annuler la suppression'
                            : 'Supprimer le token enregistré'}
                        </button>
                      )}
                    </div>
                  </div>
                </section>

                <section>
                  <SectionTitle
                    icon={<Headphones className="h-3.5 w-3.5 text-[#5865F2]" />}
                    label="Discord"
                    color="text-[#5865F2]"
                  />
                  <div className="mb-3 rounded-lg border border-border/20 bg-surface-2/50 px-3 py-2.5 space-y-1">
                    <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
                      Nécessaire pour les conditions LED{' '}
                      <span className="text-[#5865F2]">Muet</span>,{' '}
                      <span className="text-[#5865F2]">Sourd</span> et{' '}
                      <span className="text-[#5865F2]">Stream</span>{' '}
                      (Discord).
                    </p>
                    <p className="text-[11px] text-muted-foreground/40">
                      discord.com/developers › New Application › OAuth2
                    </p>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                        Client ID
                      </label>
                      <input
                        type="text"
                        value={localSettings.discord.clientId}
                        onChange={(e) =>
                          setLocalSettings({
                            ...localSettings,
                            discord: {
                              ...localSettings.discord,
                              clientId: e.target.value
                            }
                          })
                        }
                        placeholder="123456789012345678"
                        className={inputDiscord}
                      />
                    </div>
                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-medium text-muted-foreground/70">
                          Client Secret
                        </label>
                        <ConfiguredState
                          configured={secretConfigured(
                            localSettings.discord.clientSecretConfigured,
                            discordSecretChange
                          )}
                        />
                      </div>
                      <PasswordInput
                        value={secretInputValue(discordSecretChange)}
                        onChange={(v) =>
                          setDiscordSecretChange(
                            v ? { action: 'set', value: v } : { action: 'unchanged' }
                          )
                        }
                        show={showDiscordSecret}
                        onToggle={() => setShowDiscordSecret((s) => !s)}
                        className={`${inputDiscord} pr-9`}
                      />
                      {(localSettings.discord.clientSecretConfigured ||
                        discordSecretChange.action !== 'unchanged') && (
                        <button
                          type="button"
                          onClick={() =>
                            setDiscordSecretChange(
                              discordSecretChange.action === 'clear'
                                ? { action: 'unchanged' }
                                : { action: 'clear' }
                            )
                          }
                          className="mt-1.5 text-[11px] text-neon-red/60 transition-colors hover:text-neon-red"
                        >
                          {discordSecretChange.action === 'clear'
                            ? 'Annuler la suppression'
                            : 'Supprimer le secret enregistré'}
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <ConfiguredState
                        configured={localSettings.discord.authenticated && !clearDiscordTokens}
                      />
                      {localSettings.discord.authenticated && (
                        <button
                          type="button"
                          onClick={() => setClearDiscordTokens((clear) => !clear)}
                          className="text-[11px] text-neon-red/50 hover:text-neon-red transition-colors"
                        >
                          {clearDiscordTokens ? 'Annuler la réinitialisation' : 'Réinitialiser'}
                        </button>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}

            {/* ── RGB ── */}
            {activeTab === 'rgb' && (
              <section>
                <SectionTitle
                  icon={<Sparkles className="h-3.5 w-3.5 text-neon-pink" />}
                  label="RGB Stream Deck"
                  color="text-neon-pink"
                />
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                      Mode d&apos;effet
                    </label>
                    <CustomSelect
                      value={localSettings.ledProfile.mode}
                      onChange={(val) =>
                        setLocalSettings({
                          ...localSettings,
                          ledProfile: { ...localSettings.ledProfile, mode: val as LedMode }
                        })
                      }
                      options={LED_MODES.map((m) => ({
                        value: m.value,
                        label: m.label,
                        description: m.description
                      }))}
                      accent="pink"
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground/70">
                      <span>Luminosité</span>
                      <span className="tabular-nums text-muted-foreground">
                        {localSettings.ledProfile.brightness}%
                      </span>
                    </label>
                    <Slider
                      value={localSettings.ledProfile.brightness}
                      min={0}
                      max={100}
                      onChange={(v) =>
                        setLocalSettings({
                          ...localSettings,
                          ledProfile: { ...localSettings.ledProfile, brightness: v }
                        })
                      }
                    />
                  </div>

                  {MODES_WITH_SPEED.includes(localSettings.ledProfile.mode) && (
                    <div>
                      <label className="mb-1.5 flex items-center justify-between text-xs font-medium text-muted-foreground/70">
                        <span>Vitesse</span>
                        <span className="tabular-nums text-muted-foreground">
                          {localSettings.ledProfile.speed}%
                        </span>
                      </label>
                      <Slider
                        value={localSettings.ledProfile.speed}
                        min={1}
                        max={100}
                        onChange={(v) =>
                          setLocalSettings({
                            ...localSettings,
                            ledProfile: { ...localSettings.ledProfile, speed: v }
                          })
                        }
                      />
                    </div>
                  )}

                  <div
                    className={cn(
                      'grid gap-3',
                      MODES_WITH_END_COLOR.includes(localSettings.ledProfile.mode)
                        ? 'grid-cols-2'
                        : 'grid-cols-1'
                    )}
                  >
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                        Couleur principale
                      </label>
                      <ColorPicker
                        value={localSettings.ledProfile.startColor}
                        onChange={(c) =>
                          setLocalSettings({
                            ...localSettings,
                            ledProfile: { ...localSettings.ledProfile, startColor: c }
                          })
                        }
                      />
                    </div>
                    {MODES_WITH_END_COLOR.includes(localSettings.ledProfile.mode) && (
                      <div>
                        <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                          Couleur secondaire
                        </label>
                        <ColorPicker
                          value={localSettings.ledProfile.endColor}
                          onChange={(c) =>
                            setLocalSettings({
                              ...localSettings,
                              ledProfile: { ...localSettings.ledProfile, endColor: c }
                            })
                          }
                        />
                      </div>
                    )}
                  </div>

                  {MODES_WITH_DIRECTION.includes(localSettings.ledProfile.mode) && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground/70">
                        Direction
                      </label>
                      <div className="flex gap-2">
                        {(['horizontal', 'vertical', 'diagonal'] as const).map((dir) => (
                          <button
                            key={dir}
                            type="button"
                            onClick={() =>
                              setLocalSettings({
                                ...localSettings,
                                ledProfile: { ...localSettings.ledProfile, direction: dir }
                              })
                            }
                            className={cn(
                              'flex-1 rounded-lg border py-2 text-xs font-semibold uppercase tracking-wider transition-all',
                              localSettings.ledProfile.direction === dir
                                ? 'border-neon-pink/40 bg-neon-pink/15 text-neon-pink'
                                : 'border-border/40 bg-surface-2 text-muted-foreground/50 hover:text-muted-foreground'
                            )}
                          >
                            {dir === 'horizontal'
                              ? 'Horiz.'
                              : dir === 'vertical'
                                ? 'Vert.'
                                : 'Diag.'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}
          </div>
          </div>

          {/* Discard confirmation */}
          {showDiscardPrompt && (
            <div className="border-t border-neon-orange/20 bg-neon-orange/5 px-6 py-3 animate-slide-up">
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
          <div className="border-t border-border/30 px-6 py-4">
            {versions && (
              <div className="mb-3 space-y-1.5">
                <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground/50">
                  <span className="font-semibold text-muted-foreground">StreamDeck DeeJ</span> est
                  un mélangeur de volume mais aussi un Stream Deck pour les PC. Il se compose d{"'"}
                  un client de bureau léger écrit en JavaScript avec Electron et d{"'"}une
                  configuration matérielle basée sur Raspberry Pi Pico simple et peu coûteuse à
                  construire.
                </p>
                <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/50 tabular-nums">
                  <span>App v{versions.app}</span>
                  <span>·</span>
                  <span>Electron v{versions.electron}</span>
                  <span>·</span>
                  <span>Node v{versions.node}</span>
                </div>
              </div>
            )}
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

function secretInputValue(change: SecretChange): string {
  return change.action === 'set' ? change.value : ''
}

function secretConfigured(currentlyConfigured: boolean, change: SecretChange): boolean {
  if (change.action === 'set') return true
  if (change.action === 'clear') return false
  return currentlyConfigured
}

function ConfiguredState({ configured }: { configured: boolean }): React.JSX.Element {
  return (
    <span
      className={cn(
        'text-[11px] font-medium',
        configured ? 'text-neon-green' : 'text-muted-foreground/40'
      )}
    >
      {configured ? '● Configuré' : '○ Non configuré'}
    </span>
  )
}

function SectionTitle({ icon, label, color }: { icon: React.ReactNode; label: string; color: string }): React.JSX.Element {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h3 className={cn('font-display text-xs font-bold uppercase tracking-widest', color)}>{label}</h3>
      <div className="gradient-line-h flex-1" />
    </div>
  )
}

const TOGGLE_VARIANTS: Record<string, { track: string; dot: string }> = {
  'neon-blue': {
    track: 'peer-checked:border-neon-blue/40 peer-checked:bg-neon-blue/20 peer-checked:shadow-[0_0_8px_#38bdf84d]',
    dot:   'peer-checked:left-[22px] peer-checked:bg-neon-blue peer-checked:shadow-[0_0_6px_#38bdf880]'
  },
  'neon-cyan': {
    track: 'peer-checked:border-neon-cyan/40 peer-checked:bg-neon-cyan/20 peer-checked:shadow-[0_0_8px_#22d3ee4d]',
    dot:   'peer-checked:left-[22px] peer-checked:bg-neon-cyan peer-checked:shadow-[0_0_6px_#22d3ee80]'
  },
  'neon-purple': {
    track: 'peer-checked:border-neon-purple/40 peer-checked:bg-neon-purple/20 peer-checked:shadow-[0_0_8px_#a855f74d]',
    dot:   'peer-checked:left-[22px] peer-checked:bg-neon-purple peer-checked:shadow-[0_0_6px_#a855f780]'
  },
  'neon-pink': {
    track: 'peer-checked:border-neon-pink/40 peer-checked:bg-neon-pink/20 peer-checked:shadow-[0_0_8px_#f472b64d]',
    dot:   'peer-checked:left-[22px] peer-checked:bg-neon-pink peer-checked:shadow-[0_0_6px_#f472b680]'
  }
}

function Toggle({ checked, onChange, label, desc, color, className }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  desc: string
  color: string
  className?: string
}): React.JSX.Element {
  const variant = TOGGLE_VARIANTS[color] ?? TOGGLE_VARIANTS['neon-cyan']
  return (
    <label className={cn('group flex cursor-pointer items-center gap-3 text-muted-foreground hover:text-foreground transition-colors', className)}>
      <div className="relative flex-shrink-0">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <div className={cn('h-6 w-11 rounded-full border border-border/50 bg-surface-3 transition-all duration-300', variant.track)} />
        <div className={cn('absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-muted-foreground/40 shadow-sm transition-all duration-300', variant.dot)} />
      </div>
      <div>
        <span className="block text-xs font-medium">{label}</span>
        <p className="text-[11px] text-muted-foreground/40">{desc}</p>
      </div>
    </label>
  )
}

function Slider({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (v: number) => void }): React.JSX.Element {
  return (
    <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(parseInt(e.target.value))}
      className="w-full h-1.5 rounded-full appearance-none bg-surface-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-neon-pink [&::-webkit-slider-thumb]:shadow-[0_0_6px_#f472b680] cursor-pointer" />
  )
}

function PasswordInput({ value, onChange, show, onToggle, className }: {
  value: string
  onChange: (v: string) => void
  show: boolean
  onToggle: () => void
  className?: string
}): React.JSX.Element {
  return (
    <div className="relative">
      <input type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••••••••••••••••••••••••••"
        className={className} />
      <button type="button" onClick={onToggle}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors">
        {show
          ? <EyeOff className="h-3.5 w-3.5" />
          : <Eye className="h-3.5 w-3.5" />}
      </button>
    </div>
  )
}

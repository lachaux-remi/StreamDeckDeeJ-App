import { useState } from 'react'
import ConsolePanel from '@renderer/components/console/ConsolePanel'
import DeejConfigDialog from '@renderer/components/deej/DeejConfigDialog'
import DeejPanel from '@renderer/components/deej/DeejPanel'
import Header from '@renderer/components/header/Header'
import SettingsSheet from '@renderer/components/settings/SettingsSheet'
import StreamdeckConfigDialog from '@renderer/components/streamdeck/StreamdeckConfigDialog'
import StreamdeckPanel from '@renderer/components/streamdeck/StreamdeckPanel'
import LinuxUpdateNotice from '@renderer/components/update/LinuxUpdateNotice'
import { useIpcHydration } from '@renderer/hooks/useIpc'

export default function App(): React.JSX.Element {
  useIpcHydration()

  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedButton, setSelectedButton] = useState<string | null>(null)
  const [selectedSlider, setSelectedSlider] = useState<string | null>(null)

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Header onOpenSettings={() => setSettingsOpen(true)} />
      <LinuxUpdateNotice />

      <div className="gradient-line-h shrink-0" />

      <main className="flex flex-1 overflow-hidden">
        {/* StreamDeck - left */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <StreamdeckPanel onButtonClick={setSelectedButton} />
        </div>

        {/* Separator */}
        <div className="gradient-line-v my-4 shrink-0" />

        {/* DeeJ - right */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <DeejPanel onSliderClick={setSelectedSlider} />
        </div>
      </main>

      <ConsolePanel />

      <StreamdeckConfigDialog
        buttonIndex={selectedButton}
        onClose={() => setSelectedButton(null)}
      />
      <DeejConfigDialog sliderIndex={selectedSlider} onClose={() => setSelectedSlider(null)} />
      <SettingsSheet isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  )
}

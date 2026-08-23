import { useEffect, useState } from 'react'
import { Download, ExternalLink, RefreshCw } from 'lucide-react'
import {
  isLinuxUpdateState,
  type LinuxUpdateCommand,
  type LinuxUpdateState
} from '@renderer/types/update.types'

async function sendCommand(command: LinuxUpdateCommand): Promise<LinuxUpdateState> {
  const state: unknown = await window.api.update.command(command)
  if (!isLinuxUpdateState(state)) {
    throw new TypeError('Invalid update state received from main')
  }
  return state
}

export default function LinuxUpdateNotice(): React.JSX.Element | null {
  const [state, setState] = useState<LinuxUpdateState | null>(null)

  useEffect(() => {
    let active = true
    void window.api.update.getState().then((value) => {
      if (active && isLinuxUpdateState(value)) {
        setState(value)
      }
    })
    const unsubscribe = window.api.update.onStateChanged((value) => {
      if (isLinuxUpdateState(value)) {
        setState(value)
      }
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const execute = async (command: LinuxUpdateCommand): Promise<void> => {
    setState(await sendCommand(command))
  }

  if (
    !state ||
    state.status === 'disabled' ||
    state.status === 'idle' ||
    state.status === 'checking' ||
    state.status === 'up-to-date'
  ) {
    return null
  }

  if (state.status === 'error') {
    return (
      <section className="flex items-center justify-between gap-4 border-b border-neon-red/25 bg-neon-red/5 px-5 py-2 text-sm">
        <span>{state.message}</span>
        <button
          className="flex items-center gap-2 rounded-md border border-neon-red/30 px-3 py-1.5 hover:bg-neon-red/10"
          onClick={() => void execute('check')}
        >
          <RefreshCw className="h-4 w-4" /> Réessayer
        </button>
      </section>
    )
  }

  if (!('version' in state)) {
    return null
  }

  return (
    <>
      <section className="border-b border-neon-blue/25 bg-neon-blue/5 px-5 py-3">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-5">
          <div className="min-w-0">
            <p className="font-semibold text-neon-blue">
              Mise à jour {state.version} disponible — {state.releaseName}
            </p>
            <p className="mt-1 max-h-20 overflow-y-auto whitespace-pre-wrap text-xs text-muted-foreground">
              {state.releaseNotes || 'Aucune note de version fournie.'}
            </p>
            {state.status === 'downloading' && (
              <p className="mt-2 text-xs text-neon-cyan">
                Téléchargement… {Math.round(state.progress ?? 0)} %
              </p>
            )}
          </div>
          <div className="shrink-0">
            {state.mode === 'package-manager' && (
              <button
                className="flex items-center gap-2 rounded-md bg-neon-blue/15 px-3 py-2 text-sm text-neon-blue hover:bg-neon-blue/25"
                onClick={() => void execute('open-release')}
              >
                <ExternalLink className="h-4 w-4" /> Voir la release officielle
              </button>
            )}
            {state.mode === 'appimage' && state.status === 'available' && (
              <button
                className="flex items-center gap-2 rounded-md bg-neon-blue/15 px-3 py-2 text-sm text-neon-blue hover:bg-neon-blue/25"
                onClick={() => void execute('download')}
              >
                <Download className="h-4 w-4" /> Télécharger
              </button>
            )}
            {state.mode === 'appimage' && state.status === 'downloaded' && (
              <button
                className="rounded-md bg-neon-green/15 px-3 py-2 text-sm text-neon-green hover:bg-neon-green/25"
                onClick={() => void execute('install')}
              >
                Installer et redémarrer
              </button>
            )}
          </div>
        </div>
      </section>
    </>
  )
}

import { useEffect } from 'react'
import { useSettingsStore } from '@renderer/stores/settings.store'
import { useSerialStore } from '@renderer/stores/serial.store'
import { isRendererSettings } from '@renderer/types/settings.types'
import type { ApplicationVersions, LogEntry } from '@renderer/types/serial.types'

export function useIpcHydration(): void {
  const hydrate = useSettingsStore((s) => s.hydrate)
  const { setSessions, setSliders, setVersions, setSerialPorts, setSerialStatus, setLogs, addLog } =
    useSerialStore()

  useEffect(() => {
    window.api.settings.hydrate().then((config) => {
      if (!isRendererSettings(config)) throw new TypeError('Invalid settings received from main')
      hydrate(config)
    })
    window.api.app.getVersions().then((v) => setVersions(v as ApplicationVersions))
    window.api.deej.getSliders().then(setSliders)
    window.api.deej.getSessions().then(setSessions)
    window.api.serial.list().then(setSerialPorts)
    window.api.serial.status().then(setSerialStatus)
    window.api.app.getLogs().then((logs) => setLogs(logs as LogEntry[]))

    const unsubSlider = window.api.on.slidersUpdate(setSliders)
    const unsubStatus = window.api.on.serialStatus(setSerialStatus)
    const unsubLog = window.api.on.log((log) => addLog(log as LogEntry))

    return () => {
      unsubSlider()
      unsubStatus()
      unsubLog()
    }
  }, [
    addLog,
    hydrate,
    setLogs,
    setSerialPorts,
    setSerialStatus,
    setSessions,
    setSliders,
    setVersions
  ])
}

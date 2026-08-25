import { BrowserWindow, Menu, Tray, app, protocol, shell } from 'electron'
import { join } from 'path'
import { registerAllHandlers } from '@main/handlers'
import { createPlatformRuntime, type PlatformRuntime } from '@main/platform-runtime'
import { RENDERER_URL, registerRendererProtocol } from '@main/renderer-protocol'
import { conditionService } from '@main/services/condition.service'
import { AppQuitCoordinator } from '@main/services/app-quit-coordinator'
import { configService } from '@main/services/config.service'
import { deckService } from '@main/services/deck.service'
import { discordService } from '@main/services/discord.service'
import { ledService } from '@main/services/led.service'
import { loggerService } from '@main/services/logger.service'
import { serialService } from '@main/services/serial.service'
import { sliderService } from '@main/services/slider.service'
import { createWindowCloseHandler } from '@main/services/window-close-handler'
import { restoreAndFocusWindow } from '@main/services/window-lifecycle'

const APP_ID = 'fr.remi-lachaux.streamdeck-deej'

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'streamdeck-deej',
    privileges: { standard: true, secure: true, supportFetchAPI: true, codeCache: true }
  }
])

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

if (process.platform === 'win32') {
  app.setAppUserModelId(APP_ID)
}

const isDev = !app.isPackaged
const devRendererUrl = isDev ? process.env['ELECTRON_RENDERER_URL'] : undefined

const iconName = process.platform === 'win32' ? 'icon.ico' : 'logo.png'
const APP_ICON = isDev
  ? join(__dirname, `../../resources/${iconName}`)
  : join(process.resourcesPath, iconName)
let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let platformRuntime: PlatformRuntime | null = null
let isQuitting = false
const appQuitCoordinator = new AppQuitCoordinator({
  shutdown: async () => {
    deckService.shutdown()
    tray?.destroy()
    tray = null
    await Promise.all([
      ledService.shutdown(),
      serialService.shutdown(),
      discordService.shutdown(),
      platformRuntime?.shutdown()
    ])
  },
  exit: () => app.exit(),
  shutdownTimeoutMs: 3_000,
  onShutdownTimeout: () =>
    loggerService.warn('Shutdown deadline exceeded; continuing application quit', 'Main')
})

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url)
    return (
      parsedUrl.protocol === 'https:' &&
      !parsedUrl.username &&
      !parsedUrl.password &&
      !parsedUrl.port &&
      ['github.com', 'www.remi-lachaux.fr'].includes(parsedUrl.hostname)
    )
  } catch {
    return false
  }
}

async function setAutostart(enabled: boolean): Promise<void> {
  if (isDev) {
    return
  }
  try {
    await platformRuntime?.setAutostart(enabled)
    if (enabled) {
      loggerService.info('Autostart enabled', 'Main')
    } else {
      loggerService.info('Autostart disabled', 'Main')
    }
  } catch (err) {
    loggerService.error(`Autostart error: ${err}`, 'Main')
  }
}

app.on('second-instance', () => {
  if (mainWindow) {
    restoreAndFocusWindow(mainWindow)
  }
})

app.whenReady().then(async () => {
  if (!devRendererUrl) {
    registerRendererProtocol(join(__dirname, '../renderer'))
  }

  configService.init()
  platformRuntime = await createPlatformRuntime(process.platform, {
    setLoginItemSettings: (settings) => app.setLoginItemSettings(settings)
  })
  const { microphone } = platformRuntime.audio
  await microphone.init()
  await discordService.init()
  conditionService.init(microphone, discordService)
  await ledService.init(microphone)
  platformRuntime.updater.init((quitAndInstall) => appQuitCoordinator.installUpdate(quitAndInstall))

  const config = configService.getConfig()

  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: APP_ICON,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  mainWindow = window

  registerAllHandlers(window.webContents, platformRuntime)
  window.webContents.session.setPermissionCheckHandler(() => false)
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(false)
  )

  window.setMenu(null)

  window.on('ready-to-show', () => {
    if (!config.runInBackground) {
      window.show()
    }
  })

  window.on(
    'close',
    createWindowCloseHandler(
      () => configService.getConfig().closeToTray,
      () => isQuitting,
      () => window.hide()
    )
  )

  // System tray
  tray = new Tray(APP_ICON)
  tray.setToolTip(app.getName())
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        type: 'normal',
        label: 'Afficher / Masquer',
        click: (): void => {
          if (window.isVisible()) {
            window.hide()
          } else {
            window.show()
          }
        }
      },
      { type: 'separator' },
      {
        type: 'normal',
        label: 'Quitter',
        click: (): void => {
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => restoreAndFocusWindow(window))

  // Wire service events to renderer
  const { webContents } = window

  deckService.onUpdated((key, value) => webContents.send('streamdeck:update', key, value))

  // Throttle slider updates to ~20fps to avoid flooding the renderer
  let pendingSliders: Record<string, number> | null = null
  let sliderTimer: ReturnType<typeof setTimeout> | null = null
  sliderService.onUpdated((sliders) => {
    pendingSliders = sliders
    if (!sliderTimer) {
      sliderTimer = setTimeout(() => {
        if (pendingSliders) {
          webContents.send('deej:sliders', { ...pendingSliders })
          pendingSliders = null
        }
        sliderTimer = null
      }, 50)
    }
  })

  serialService.on('status', (status) => webContents.send('serial:status', status))
  loggerService.on('log', (log) => webContents.send('electron:log', log))
  platformRuntime.updater.onStateChanged((state) => webContents.send('update:state', state))

  microphone.on('change', () =>
    webContents.send('conditions:change', { micMuted: microphone.isMuted() })
  )
  discordService.on('change', () =>
    webContents.send('conditions:change', {
      discordMuted: discordService.isMuted(),
      discordDeafened: discordService.isDeafened(),
      discordStreaming: discordService.isStreaming(),
      discordConnected: discordService.isConnected()
    })
  )

  // External links
  webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })
  webContents.on('will-navigate', (event) => event.preventDefault())

  // Open devTools on launch if enabled
  if (config.devTools) {
    window.webContents.openDevTools()
  }

  // Config sync
  let prevDevTools = config.devTools
  let prevDiscordClientId = config.discord?.clientId
  await setAutostart(config.runOnStartup)
  configService.onUpdated((newConfig) => {
    void setAutostart(newConfig.runOnStartup)
    ledService.updateOverrides(newConfig.streamdeck)

    if (newConfig.discord?.clientId !== prevDiscordClientId) {
      prevDiscordClientId = newConfig.discord?.clientId
      discordService.reconnect()
    }

    if (newConfig.devTools !== prevDevTools) {
      prevDevTools = newConfig.devTools
      if (newConfig.devTools) {
        window.webContents.openDevTools()
      } else {
        window.webContents.closeDevTools()
      }
    }
  })

  // Load renderer
  if (devRendererUrl) {
    window.loadURL(devRendererUrl)
  } else {
    window.loadURL(RENDERER_URL)
  }

  loggerService.info('Application started', 'Main')
  void platformRuntime.updater.check()
})

app.on('before-quit', (event) => {
  isQuitting = true
  appQuitCoordinator.handleBeforeQuit(event)
})

app.on('window-all-closed', () => {
  app.quit()
})

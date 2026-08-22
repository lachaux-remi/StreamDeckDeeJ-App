import { BrowserWindow, Menu, Tray, app, protocol, shell } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { registerAllHandlers } from '@main/handlers'
import { RENDERER_URL, registerRendererProtocol } from '@main/renderer-protocol'
import { conditionService } from '@main/services/condition.service'
import { configService } from '@main/services/config.service'
import { deckService } from '@main/services/deck.service'
import { discordService } from '@main/services/discord.service'
import { ledService } from '@main/services/led.service'
import { loggerService } from '@main/services/logger.service'
import { micService } from '@main/services/mic.service'
import { serialService } from '@main/services/serial.service'
import { sliderService } from '@main/services/slider.service'
import '@main/services/sessions.service'

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

const isDev = !app.isPackaged
const devRendererUrl = isDev ? process.env['ELECTRON_RENDERER_URL'] : undefined

const AUTOSTART_DIR = join(homedir(), '.config', 'autostart')
const AUTOSTART_FILE = join(AUTOSTART_DIR, 'streamdeck-deej.desktop')
const APP_ICON = isDev
  ? join(__dirname, '../../resources/logo.png')
  : join(process.resourcesPath, 'logo.png')

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
  if (isDev) return
  try {
    if (enabled) {
      const appPath = process.execPath
      const desktopEntry = [
        '[Desktop Entry]',
        'Type=Application',
        `Name=${app.getName()}`,
        `Exec="${appPath}"`,
        'X-GNOME-Autostart-enabled=true',
        'StartupWMClass=streamdeck-deej',
        `Icon="${APP_ICON}"`,
        ''
      ].join('\n')
      await mkdir(AUTOSTART_DIR, { recursive: true })
      await writeFile(AUTOSTART_FILE, desktopEntry)
      loggerService.info(`Autostart enabled: ${AUTOSTART_FILE}`, 'Main')
    } else {
      await unlink(AUTOSTART_FILE).catch(() => {})
      loggerService.info('Autostart disabled', 'Main')
    }
  } catch (err) {
    loggerService.error(`Autostart error: ${err}`, 'Main')
  }
}

app.whenReady().then(async () => {
  if (!devRendererUrl) {
    registerRendererProtocol(join(__dirname, '../renderer'))
  }

  configService.init()
  await micService.init()
  await discordService.init()
  conditionService.init(micService, discordService)
  await ledService.init()

  const config = configService.getConfig()

  const mainWindow = new BrowserWindow({
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

  registerAllHandlers(mainWindow.webContents)
  mainWindow.webContents.session.setPermissionCheckHandler(() => false)
  mainWindow.webContents.session.setPermissionRequestHandler(
    (_webContents, _permission, callback) => callback(false)
  )

  mainWindow.setMenu(null)

  mainWindow.on('ready-to-show', () => {
    if (!config.runInBackground) {
      mainWindow.show()
    }
  })

  mainWindow.on('close', (event) => {
    if (config.closeToTray) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  // System tray
  const tray = new Tray(APP_ICON)
  tray.setToolTip(app.getName())
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        type: 'normal',
        label: 'Afficher / Masquer',
        click: (): void => {
          if (mainWindow.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
          }
        }
      },
      { type: 'separator' },
      {
        type: 'normal',
        label: 'Quitter',
        click: (): void => {
          app.exit()
        }
      }
    ])
  )
  tray.on('click', () => mainWindow.show())

  // Wire service events to renderer
  const { webContents } = mainWindow

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

  micService.on('change', () =>
    webContents.send('conditions:change', { micMuted: micService.isMuted() })
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
    mainWindow.webContents.openDevTools()
  }

  // Config sync
  let prevDevTools = config.devTools
  let prevDiscordClientId = config.discord?.clientId
  configService.onUpdated((newConfig) => {
    setAutostart(newConfig.runOnStartup)
    ledService.updateOverrides(newConfig.streamdeck)

    if (newConfig.discord?.clientId !== prevDiscordClientId) {
      prevDiscordClientId = newConfig.discord?.clientId
      discordService.reconnect()
    }

    if (newConfig.devTools !== prevDevTools) {
      prevDevTools = newConfig.devTools
      if (newConfig.devTools) {
        mainWindow.webContents.openDevTools()
      } else {
        mainWindow.webContents.closeDevTools()
      }
    }
  })

  // Load renderer
  if (devRendererUrl) {
    mainWindow.loadURL(devRendererUrl)
  } else {
    mainWindow.loadURL(RENDERER_URL)
  }

  loggerService.info('Application started', 'Main')
})

app.on('before-quit', (event) => {
  event.preventDefault()
  ledService
    .shutdown()
    .catch(() => {})
    .finally(() => app.exit())
})

app.on('window-all-closed', () => {
  app.quit()
})

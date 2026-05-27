import { BrowserWindow, Menu, Tray, app, shell } from 'electron'
import { join } from 'path'
import { homedir } from 'os'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { registerAllHandlers } from '@main/handlers'
import { configService } from '@main/services/config.service'
import { deckService } from '@main/services/deck.service'
import { ledService } from '@main/services/led.service'
import { loggerService } from '@main/services/logger.service'
import { serialService } from '@main/services/serial.service'
import { sliderService } from '@main/services/slider.service'
import '@main/services/sessions.service'

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

const isDev = !app.isPackaged

const AUTOSTART_DIR = join(homedir(), '.config', 'autostart')
const AUTOSTART_FILE = join(AUTOSTART_DIR, 'streamdeck-deej.desktop')
const APP_ICON = isDev
  ? join(__dirname, '../../resources/logo.png')
  : join(process.resourcesPath, 'logo.png')

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
  configService.init()
  await ledService.init()
  registerAllHandlers()

  const config = configService.getConfig()

  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    icon: APP_ICON,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

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

  // External links
  webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  // Open devTools on launch if enabled
  if (config.devTools) {
    mainWindow.webContents.openDevTools()
  }

  // Config sync
  let prevDevTools = config.devTools
  configService.onUpdated((newConfig) => {
    setAutostart(newConfig.runOnStartup)
    ledService.updateOverrides(newConfig.streamdeck)

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
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
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

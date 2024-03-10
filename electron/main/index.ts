import { BrowserWindow, Menu, TitleBarOverlay, Tray, app, ipcMain, nativeTheme, shell } from "electron";
import { join } from "node:path";

import ConfigService from "./services/ConfigService";
import DeckService from "./services/DeckService";
import SerialService from "./services/SerialService";
import SessionsService from "./services/SessionsService";
import SliderService from "./services/SliderService";

process.env.DIST_ELECTRON = join(__dirname, "../");
process.env.DIST = join(process.env.DIST_ELECTRON, "../dist");
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, "../public")
  : process.env.DIST;

app.disableHardwareAcceleration();
app.setAppUserModelId(app.getName());
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

const configService = new ConfigService();
configService.whenReady().then(config => {
  const serialService = new SerialService(configService);
  const deckService = new DeckService(configService, serialService);
  const sliderService = new SliderService(configService, serialService);
  new SessionsService(configService, sliderService);

  app.whenReady().then(async () => {
    const backgroundColor = (): string => (nativeTheme.shouldUseDarkColors ? "#121212" : "#ffffff");
    const titleBarOverlay = (): TitleBarOverlay => {
      const useDarkColors = nativeTheme.shouldUseDarkColors;
      return {
        color: useDarkColors ? "#00000000" : "#ffffff00",
        symbolColor: useDarkColors ? "#ffffff" : "rgba(0, 0, 0, 0.87)",
        height: 32
      };
    };

    const tray = new Tray(join(process.env.VITE_PUBLIC, "favicon.ico"));
    const mainWindow = new BrowserWindow({
      icon: join(process.env.VITE_PUBLIC, "favicon.ico"),
      titleBarStyle: "hidden",
      titleBarOverlay: titleBarOverlay(),
      backgroundColor: backgroundColor(),
      width: 650,
      height: 650,
      maximizable: false,
      resizable: false,
      webPreferences: {
        preload: join(__dirname, "../preload/index.js"),
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    mainWindow.setMenu(null);
    mainWindow.on("close", event => {
      if (config.closeToTray) {
        event.preventDefault();
        mainWindow.hide();
      }
    });
    if (config.runInBackground) {
      mainWindow.hide();
    }

    tray.setContextMenu(
      Menu.buildFromTemplate([
        {
          type: "normal",
          label: "Afficher / Masquer la fenêtre",
          click: () => (mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show())
        },
        { type: "separator" },
        { type: "normal", label: "Fermer", click: () => process.exit() }
      ])
    );
    tray.on("double-click", () => mainWindow.show());

    configService.onUpdated(newConfig => app.setLoginItemSettings({ openAtLogin: newConfig.runOnStartup }));
    app.setLoginItemSettings({ openAtLogin: config.runOnStartup || false });
    app.isPackaged
      ? await mainWindow.loadFile(join(process.env.DIST, "index.html"))
      : await mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
    nativeTheme.on("updated", () => mainWindow.setTitleBarOverlay(titleBarOverlay()));

    const webContents = mainWindow.webContents;
    webContents.setWindowOpenHandler(({ url }) => {
      shell.openExternal(url);
      return { action: "deny" };
    });
    webContents.on("before-input-event", (_, input) => {
      if (input.type === "keyDown" && input.key === "F12") {
        webContents.toggleDevTools();
      }
    });
    if (config.devTools) {
      webContents.openDevTools();
    }

    deckService.onUpdated((deckKey, value) => webContents.send(`streamdeck:${deckKey}`, value));
    sliderService.onUpdated((sliderKey, value) => webContents.send(`deej:slider`, sliderKey, value));

    ipcMain.handle("electron:versions", () => {
      return {
        version: app.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node,
        platform: process.platform,
        arch: process.arch,
        chrome: process.versions.chrome
      };
    });
  });
});

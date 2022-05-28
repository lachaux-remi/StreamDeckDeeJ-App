"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const electron_1 = require("electron");
const electron_log_1 = tslib_1.__importDefault(require("electron-log"));
const path_1 = tslib_1.__importDefault(require("path"));
const config_service_1 = require("./services/config.service");
const serial_service_1 = require("./services/serial.service");
const slider_service_1 = require("./services/slider.service");
const sessions_service_1 = require("./services/sessions.service");
electron_1.app.whenReady().then(() => {
    const configService = new config_service_1.ConfigService();
    const serialService = new serial_service_1.SerialService(configService);
    const sliderService = new slider_service_1.SliderService(configService, serialService);
    const sessionsService = new sessions_service_1.SessionsService(configService, sliderService);
    const appIcon = new electron_1.Tray(path_1.default.join(__dirname, "public/favicon.ico"));
    const contextMenu = electron_1.Menu.buildFromTemplate([
        {
            type: "normal", label: "Afficher / Masquer la fenêtre",
            click: () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
        },
        { type: "separator" },
        {
            type: "normal", label: "Editer la configuration",
            icon: electron_1.nativeImage.createFromPath(path_1.default.join(__dirname, "public/images/systray/edit-config.ico"))
                .resize({ width: 16, height: 16 }),
            click: () => electron_1.shell.openPath(path_1.default.join(config_service_1.CONFIG_PATH))
        }, {
            type: "normal", label: "Re-scan des sessions audio",
            icon: electron_1.nativeImage.createFromPath(path_1.default.join(__dirname, "public/images/systray/refresh-sessions.ico"))
                .resize({ width: 16, height: 16 }),
            click: () => sessionsService.refreshSessions("user request")
        },
        { type: "separator" },
        { type: "normal", label: "Version: " + electron_1.app.getVersion(), enabled: false },
        { type: "separator" },
        { type: "normal", label: "Fermer", click: () => process.exit() }
    ]);
    appIcon.setContextMenu(contextMenu);
    const mainWindow = new electron_1.BrowserWindow({
        width: 1184, height: 612,
        minWidth: 1184, minHeight: 612,
        useContentSize: true, resizable: false,
        icon: path_1.default.join(__dirname, "public/favicon.ico"),
        webPreferences: {
            preload: path_1.default.join(__dirname, "public/preload.js")
        },
        show: false
    });
    mainWindow.loadFile(path_1.default.join(__dirname, "public/index.html"));
    mainWindow.setMenu(null);
    // Add default shortcuts
    appIcon.on("double-click", () => {
        mainWindow.show();
    });
    mainWindow.on("close", event => {
        event.preventDefault();
        mainWindow.hide();
    });
    // Open dev tools with ctrl+shift+i
    mainWindow.webContents.on("before-input-event", (_, input) => {
        if (input.type === "keyDown" && (input.key === "I" || input.key === "i") && input.control && input.shift) {
            mainWindow.webContents.toggleDevTools();
        }
    });
    // send values to renderer
    mainWindow.webContents.once("dom-ready", () => {
        setTimeout(() => {
            mainWindow.webContents.send("sliderValues", sliderService.state);
            mainWindow.webContents.send("sessionsChange", sessionsService.stateSubject.sessions, configService.config.slider_mapping);
        }, 100);
        sliderService.on("sliderChange", (key, val) => mainWindow.webContents.send(`sliderChange:${key}`, val));
        sessionsService.on("sessionsChange", (stateSubject) => mainWindow.webContents.send("sessionsChange", stateSubject.sessions, configService.config.slider_mapping));
    });
    // listen for events from renderer
    electron_1.ipcMain.on("sessionsReload", () => sessionsService.refreshSessions("user request"));
    electron_1.ipcMain.on("configUpdate:sliderMapping", (_, arg) => {
        configService.saveConfig({ ...configService.config, ...{ slider_mapping: arg } });
    });
    electron_log_1.default.info("INIT | DeejJS");
});
if (require("electron-squirrel-startup"))
    electron_1.app.quit();
electron_1.app.once("before-quit", () => electron_log_1.default.info("EXIT | DeejJS"));
//# sourceMappingURL=index.js.map
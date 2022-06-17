import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from "electron"
import { join } from "path"
import ConfigService from "./app/services/config/ConfigService"
import SerialService from "./app/services/SerialService"
import SliderService from "./app/services/SliderService"
import DeckService from "./app/services/DeckService"
import SessionsService from "./app/services/SessionsService"
import ConfigType from "./app/services/config/ConfigType"

export const assetsPath = app.isPackaged ? join( __dirname, "../renderer" ) : join( app.getAppPath(), "packages/renderer/public" )

app.whenReady().then( () => {
    const configService = new ConfigService( app.getPath( "userData" ) )
    const serialService = new SerialService( configService )
    const sliderService = new SliderService( configService, serialService )
    new DeckService( configService, serialService )
    const sessionsService = new SessionsService( configService, sliderService )

    const appIcon = new Tray( join( assetsPath, "favicon.ico" ) )
    const contextMenu = Menu.buildFromTemplate( [
        {
            type: "normal", label: "Afficher / Masquer la fenêtre",
            click: () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
        },
        { type: "separator" },
        { // edit configuration
            type: "normal", label: "Éditer la configuration",
            icon: nativeImage.createFromPath( join( assetsPath, "systray/edit-config.ico" ) )
                .resize( { width: 16, height: 16 } ),
            click: () => shell.openPath( configService.getConfigPath() )
        }, { // re-scan session audio
            type: "normal", label: "Re-scan des sessions audio",
            icon: nativeImage.createFromPath( join( assetsPath, "systray/refresh-sessions.ico" ) )
                .resize( { width: 16, height: 16 } ),
            click: () => sessionsService.refreshSessions( "user request" )
        },
        { type: "separator" },
        { type: "normal", label: "Version: " + app.getVersion(), enabled: false }, // version number
        { type: "separator" },
        { type: "normal", label: "Fermer", click: () => process.exit() }
    ] )
    appIcon.setContextMenu( contextMenu )
    appIcon.on( "double-click", () => mainWindow.show() )

    const mainWindow = new BrowserWindow( {
        width: 1184,
        height: 612,
        useContentSize: true,
        resizable: false,
        icon: join( assetsPath, "favicon.ico" ),
        webPreferences: {
            preload: join( __dirname, "../preload/bridge.cjs" )
        },
        show: true
    } )
    app.isPackaged
        ? mainWindow.loadFile( join( __dirname, "../renderer/index.html" ) )
        : mainWindow.loadURL( `http://${ process.env["VITE_DEV_SERVER_HOST"] }:${ process.env["VITE_DEV_SERVER_PORT"] }` )
    mainWindow.setMenu( null )
    mainWindow.on( "close", event => {
        event.preventDefault()
        mainWindow.hide()
    } )

    const webContents = mainWindow.webContents
    if ( process.env.NODE_ENV !== "production" ) webContents.openDevTools()
    webContents.on( "before-input-event", (_, input) => {
        if ( input.type === "keyDown" && ( input.key === "I" || input.key === "i" ) && input.control && input.shift ) {
            webContents.openDevTools()
        }
    } )

    ipcMain.on( "get", (event, type: string) => {
        switch ( type ) {
            case "config":
                event.returnValue = configService.getConfig()
                break
            case "sliders-volume":
                event.returnValue = sliderService.getSlidersVolume()
                break
            case "sessions-not-assigned":
                event.returnValue = sessionsService.getNotAssignedSessions()
                break
        }
    } )
    ipcMain.on( "config", (_, config: ConfigType) => configService.setConfig( config ) )
    configService.on( "config-updated", () => webContents.send( "config", configService.getConfig() ) )
    ipcMain.on( "sessions-reload", () => sessionsService.refreshSessions( "user interface request" ) )
    sessionsService.on( "sessions-updated", () => webContents.send( "sessions-not-assigned", sessionsService.getNotAssignedSessions() ) )
    sliderService.on( "slider-volume-updated", () => webContents.send( "sliders-volume", sliderService.getSlidersVolume() ) )

    console.info( "INIT | DeejJS" )
} )

app.once( "before-quit", () => console.info( "EXIT | DeejJS" ) )

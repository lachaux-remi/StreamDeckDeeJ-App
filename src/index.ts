import { app, BrowserWindow, ipcMain, Menu, nativeImage, shell, Tray } from "electron"
import logger from "electron-log"
import path from "path"
import { CONFIG_PATH, ConfigService } from "./services/config.service"
import { SerialService } from "./services/serial.service"
import { SliderService } from "./services/slider.service"
import { SessionsService } from "./services/sessions.service"

app.whenReady().then( () => {
    const configService = new ConfigService()
    const serialService = new SerialService( configService )
    const sliderService = new SliderService( configService, serialService )
    const sessionsService = new SessionsService( configService, sliderService )

    const appIcon = new Tray( path.join( __dirname, "public/favicon.ico" ) )
    const contextMenu = Menu.buildFromTemplate( [
        {
            type: "normal", label: "Afficher / Masquer la fenêtre",
            click: () => mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
        },
        { type: "separator" },
        { // edit configuration
            type: "normal", label: "Editer la configuration",
            icon: nativeImage.createFromPath( path.join( __dirname, "public/images/systray/edit-config.ico" ) )
                .resize( { width: 16, height: 16 } ),
            click: () => shell.openPath( path.join( CONFIG_PATH ) )
        }, { // re-scan session audio
            type: "normal", label: "Re-scan des sessions audio",
            icon: nativeImage.createFromPath( path.join( __dirname, "public/images/systray/refresh-sessions.ico" ) )
                .resize( { width: 16, height: 16 } ),
            click: () => sessionsService.refreshSessions( "user request" )
        },
        { type: "separator" },
        { type: "normal", label: "Version: " + app.getVersion(), enabled: false }, // version number
        { type: "separator" },
        { type: "normal", label: "Fermer", click: () => process.exit() }
    ] )
    appIcon.setContextMenu( contextMenu )

    const mainWindow = new BrowserWindow( {
        width: 1184, height: 612,
        minWidth: 1184, minHeight: 612,
        useContentSize: true, resizable: false,
        icon: path.join( __dirname, "public/favicon.ico" ),
        webPreferences: {
            preload: path.join( __dirname, "public/preload.js" )
        },
        show: false

    } )
    mainWindow.loadFile( path.join( __dirname, "public/index.html" ) )
    mainWindow.setMenu( null )

    // Add default shortcuts
    appIcon.on( "double-click", () => {
        mainWindow.show()
    } )
    mainWindow.on( "close", event => {
        event.preventDefault()
        mainWindow.hide()
    } )

    // Open dev tools with ctrl+shift+i
    mainWindow.webContents.on( "before-input-event", (_, input) => {
        if ( input.type === "keyDown" && ( input.key === "I" || input.key === "i" ) && input.control && input.shift ) {
            mainWindow.webContents.toggleDevTools()
        }
    } )

    // send values to renderer
    mainWindow.webContents.once( "dom-ready", () => {
        setTimeout( () => {
            mainWindow.webContents.send( "sliderValues", sliderService.state )
            mainWindow.webContents.send( "sessionsChange", sessionsService.stateSubject.sessions, configService.config.slider_mapping )
        }, 100 )

        sliderService.on( "sliderChange", (key, val) => mainWindow.webContents.send( `sliderChange:${ key }`, val ) )
        sessionsService.on( "sessionsChange", (stateSubject) => mainWindow.webContents.send( "sessionsChange", stateSubject.sessions, configService.config.slider_mapping ) )
    } )

    // listen for events from renderer
    ipcMain.on( "sessionsReload", () => sessionsService.refreshSessions( "user request" ) )
    ipcMain.on( "configUpdate:sliderMapping", (_, arg) => {
        configService.saveConfig( { ...configService.config, ...{ slider_mapping: arg } } )
    } )

    logger.info( "INIT | DeejJS" )
} )

if ( require( "electron-squirrel-startup" ) ) app.quit()

app.once( "before-quit", () => logger.info( "EXIT | DeejJS" ) )
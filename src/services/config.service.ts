import logger from "electron-log"
import fs, { readFileSync, watch, writeFileSync } from "fs"
import { parse, stringify } from "yaml"

export const CONFIG_PATH = "./config.yaml"

export interface IConfig {
    com_port: string
    baud_rate: number
    slider_mapping: Record<string, string[] | string>
    invert_sliders: boolean
}

export class ConfigService {
    /**
     * The config object
     */
    config: IConfig

    /**
     * Debounce for config file changes
     * @private
     */
    private debounce: NodeJS.Timeout = null

    constructor() {
        logger.info( `INIT | ConfigService` )

        if ( !fs.existsSync( CONFIG_PATH ) ) {
            this.saveConfig( {
                slider_mapping: {
                    0: [ "master" ],
                    1: [ "brave.exe", "chrome.exe" ],
                    2: [ "wwahost.exe", "spotify.exe", "disneyplus.exe" ],
                    3: [ "steam.exe" ],
                    4: [ "discord.exe" ]
                },
                invert_sliders: false,
                com_port: "COM3",
                baud_rate: 115200
            } )
        }

        // watch config file for changes and reload
        watch( CONFIG_PATH, { encoding: "utf8" }, () => {
            if ( this.debounce !== null ) return

            // create a debounce to prevent multiple reads
            this.debounce = setTimeout( () => {
                logger.info( `CONFIG | Config file changed` )
                this.readConfig()

                // clear debounce
                clearTimeout( this.debounce )
                this.debounce = null
            }, 500 )
        } )
        this.readConfig()
    }

    /**
     * Save the config to the config file
     * @param data new config data
     */
    saveConfig = (data: IConfig) => {
        try {
            writeFileSync( CONFIG_PATH, stringify( data ) )
        } catch {
            logger.error( `CONFIG | Error writing ${ CONFIG_PATH }` )
        }
    }

    /**
     * Read the config file
     * @private
     */
    private readYAML = (): IConfig => {
        try {
            const buff = readFileSync( CONFIG_PATH, "utf-8" )
            return parse( buff )
        } catch ( error ) {
            return undefined
        }
    }

    /**
     * Reads the config file and parses it into a config object
     * @private
     */
    private readConfig = (): void => {
        logger.debug( `CONFIG | Load config file` )
        const config = this.readYAML()
        if ( !config ) {
            logger.verbose( `CONFIG | ${ CONFIG_PATH } not found` )
            logger.error( `CONFIG | Cannot work without config` )
            return process.exit()
        }
        this.config = config
    }
}
import fs from "fs"
import ConfigType from "./ConfigType"
import ConfigDefault from "./ConfigDefault"
import { EventEmitter } from "events"
import { join } from "path"

export default class ConfigService extends EventEmitter {
    private configPath: string = "./config.json"
    private config: ConfigType = ConfigDefault

    private debounce: NodeJS.Timeout | null = null

    constructor(userDataPath: string) {
        super()
        console.info( `INIT | ConfigService` )
        this.configPath = join( userDataPath, "config.json" )

        if ( !fs.existsSync( this.configPath ) ) {
            console.info( `ConfigService | Config file not found, creating default config file` )
            fs.writeFileSync( this.configPath, JSON.stringify( ConfigDefault ) )
        }

        fs.watch( this.configPath, () => {
            if ( this.debounce !== null ) return

            this.debounce = setTimeout( () => {
                console.info( `ConfigService | Config file changed, reloading config` )
                this.loadConfig()

                clearTimeout( this.debounce! )
                this.debounce = null
            }, 1000 )
        } )

        this.loadConfig()
    }

    public getConfigPath = (): string => this.configPath

    public getConfig = (): ConfigType => {
        return this.config
    }

    public setConfig = (config: ConfigType): void => {
        try {
            fs.writeFileSync( this.configPath, JSON.stringify( config, null, 2 ) )
        } catch ( error ) {
            if ( error instanceof Error ) {
                console.error( `ConfigService | Error while saving config: ${ error.message }` )
            }
        }
    }

    private loadConfig = (): void => {
        try {
            console.info( `ConfigService | Loading config` )
            this.config = JSON.parse( fs.readFileSync( this.configPath, "utf8" ) )
            this.emit( "config-updated" )
        } catch ( error ) {
            if ( error instanceof Error ) {
                console.error( `ConfigService | Error while loading config ${ error.message }` )
            }
        }
    }
}

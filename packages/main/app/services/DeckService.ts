import ConfigService from "./config/ConfigService"
import SerialService from "./SerialService"
import TapoModule, { DeviceInfo as TapoDeviceInfo } from "../modules/TapoModule"
import OctopiLedModule, { DeviceInfo as OctopiLedDeviceInfo } from "../modules/OctopiLedModule"
import { DeckConfig, DeckState, DeckStateConfig } from "./config/ConfigType"
import { EventEmitter } from "events"

export default class DeckService extends EventEmitter {
    private keyState: { [key: string]: DeckState } = {}

    constructor(private configService: ConfigService, private serialService: SerialService) {
        super()
        console.info( "INIT | DeckService" )

        serialService.on( "deck", this.deckEvent )
    }

    private deckEvent = async (data: { type: "deck", state: DeckState | "released", value: string }): Promise<void> => {
        const configKey = parseInt( data.value, 16 ).toString().toLowerCase()

        if ( data.state === "released" ) {
            const deckConfig: DeckConfig = this.configService.getConfig().deck_mapping[configKey]
            if ( !deckConfig ) return

            const stateConfig: DeckStateConfig | undefined = deckConfig[this.keyState[configKey]]
            if ( !stateConfig ) return

            console.info( `DECK | Key ${ configKey } ${ this.keyState[configKey] } run action ${ stateConfig.module }: ${ stateConfig.params.join( ", " ) }` )

            if ( stateConfig.module === "macro" || stateConfig.module === "ir" ) {
                this.serialService.stateSubject.serialPort?.write( `${ stateConfig.module }:${ stateConfig.params[0] }` )
            } else if ( stateConfig.module === "tapo" ) {
                const tapoAccount = this.configService.getConfig().tapo_account
                if ( tapoAccount ) {
                    new TapoModule().connectWithHash( stateConfig.params[1], tapoAccount.username, tapoAccount.password )
                        // @ts-ignore
                        .then( tapo => ( tapo[stateConfig.params[0]]() as Promise<TapoDeviceInfo> ).then( info => this.emit( "deck-pressed", configKey, info ) ) )
                        .catch( err => console.error( err ) )
                }
            } else if ( stateConfig.module === "octopi-led" ) {
                // @ts-ignore
                ( new OctopiLedModule().connect( stateConfig.params[1] )[stateConfig.params[0]]() as Promise<OctopiLedDeviceInfo> )
                    .then( info => this.emit( "deck-pressed", configKey, info ) )
                    .catch( err => console.error( err ) )
            }
        } else {
            this.keyState[configKey] = data.state
        }
    }
}

import { ConfigService } from "./config.service"
import { SerialService } from "./serial.service"
import logger from "electron-log"
import EventEmitter from "node:events"

const EXPECTED_LINE_PATTERN = RegExp( /^\d{1,4}(\|\d{1,4})*$/ )

export class SliderService extends EventEmitter {
    /**
     * Slide save value for check significant changes
     */
    public state = {}
    /**
     * Debounce for config file changes
     * @private
     */
    private debounce: NodeJS.Timeout = null

    constructor(private configService: ConfigService, serialService: SerialService) {
        super()
        logger.info( "INIT | SliderService" )

        serialService.on( "serialData", this.sliderChangeEvent )
    }

    /**
     * Event handler for slider change events
     * @param data
     */
    private sliderChangeEvent = (data: string): void => {
        if ( this.debounce !== null ) return

        // create a debounce to prevent multiple
        this.debounce = setTimeout( () => {
            if ( !EXPECTED_LINE_PATTERN.test( data ) ) return

            data.split( "|" )
                .map( str => parseInt( str, 10 ) / 2 ** 10 )
                .map( val => val > 1 ? 1 : val < 0 ? 0 : val )
                .map( val => ( this.configService.config.invert_sliders ? 1 - val : val ) )
                .map( val => {
                    const p = Math.pow( 10, 3 )
                    return Math.round( val * p * ( 1 + Number.EPSILON ) ) / p
                } )
                .forEach( (val, key) => {
                    const pre = this.state[key] ?? undefined
                    const curr = val

                    if ( pre === undefined || Math.abs( pre - curr ) >= 0.009 ) {
                        logger.debug( `SESSIONS | Slider ${ key } change detected: ${ val }` )
                        this.state[key] = curr
                        this.emit( "sliderChange", key, curr )
                    }
                } )

            // clear debounce
            clearTimeout( this.debounce )
            this.debounce = null
        }, 10 )
    }
}
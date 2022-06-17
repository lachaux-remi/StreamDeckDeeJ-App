import ConfigService from "./config/ConfigService"
import SerialService from "./SerialService"
import { EventEmitter } from "events"
import { throttle } from "../helpers"

export interface SlidersVolume {
    [key: string]: number
}

export default class SliderService extends EventEmitter {
    /**
     * Slide save value for check significant changes
     */
    public slidersVolume: SlidersVolume = {}

    private pow: number = Math.pow( 10, 3 )

    constructor(private configService: ConfigService, serialService: SerialService) {
        super()
        console.info( "INIT | SliderService" )

        serialService.on( "deej", throttle( this.deejEvent, 50, false, true, this ) )
    }

    public getSlidersVolume = (): SlidersVolume => {
        return this.slidersVolume
    }

    /**
     * Event handler for slider change events
     * @param data
     */
    private deejEvent = (data: { type: "deej", value: SlidersVolume }): void => {
        for ( const configKey in data.value ) {
            let value = data.value[configKey] / 2 ** 10
            value = value > 1 ? 1 : value < 0 ? 0 : value
            value = ( this.configService.getConfig().invert_sliders ? 1 - value : value )
            value = Math.round( value * this.pow * ( 1 + Number.EPSILON ) ) / this.pow

            const pre = this.slidersVolume[configKey] ?? undefined
            if ( pre === undefined || Math.abs( pre - value ) >= 0.009 ) {
                console.debug( `SESSIONS | Slider ${ configKey } change detected: ${ value }` )
                this.slidersVolume[configKey] = value
                this.emit( "sliderChange", configKey, value )
                this.emit( "slider-volume-updated", configKey, value )
            }
        }
    }
}

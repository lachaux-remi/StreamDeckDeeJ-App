import ConfigService from "./config/ConfigService"
import { ReadlineParser, SerialPort } from "serialport"
import { EventEmitter } from "events"

export interface SerialState {
    status: "connected" | "disconnected";
    serialPort: SerialPort | null;
}

const INITIAL_SERIAL_STATE: SerialState = { status: "disconnected", serialPort: null }

export default class SerialService extends EventEmitter {
    public stateSubject = INITIAL_SERIAL_STATE

    constructor(private configService: ConfigService) {
        super()
        console.info( "INIT | SerialService" )
        this.tryConnection()
    }

    /**
     * Try to connect to the serial port
     */
    private tryConnection = (): void => {
        const { com_port, baud_rate } = this.configService.getConfig()

        console.debug( `SERIAL | Attempting Connection for port ${ com_port } at ${ baud_rate } baud` )

        const prevSerialPort = this.stateSubject.serialPort
        if ( prevSerialPort?.isOpen ) prevSerialPort.close()

        SerialPort.list().then( ports => {
            if ( !ports.find( port => port.path === com_port ) ) {
                console.error( `SERIAL | No device exists at port path ${ com_port }` )
                process.exit()
            }
        } )

        const serialPort = new SerialPort( {
            path: com_port,
            baudRate: baud_rate,
            dataBits: 8,
            parity: "none",
            stopBits: 1,
            autoOpen: false
        } )

        serialPort.open( err => {
            if ( err ) {
                const msg = ( err as unknown as Error | null )?.message
                console.error( `SERIAL | Connection Failed with msg: ${ msg }` )
                process.exit()
            }

            this.stateSubject = { status: "connected", serialPort }
            console.info( `SERIAL | Connection Successful for port ${ com_port } at ${ baud_rate } baud` )

            this.updateSerialPortInfo()
        } )
    }

    /**
     * Add event listeners to the serial port
     */
    private updateSerialPortInfo = (): void => {
        this.stateSubject.serialPort?.pipe( new ReadlineParser( { delimiter: "\r\n" } ) )
            .on( "data", data => {
                try {
                    const json = JSON.parse( data )
                    if ( json.type !== undefined && json.value !== undefined ) {
                        this.emit( json.type, json )
                    }
                } catch ( error ) {
                    console.error( `SERIAL | Error parsing data: ${ data }` )
                }
            } )
            .on( "error", () => {
                console.error( `SERIAL | Missing device at port path ${ this.configService.getConfig().com_port }` )
                process.exit()
            } )
    }

}

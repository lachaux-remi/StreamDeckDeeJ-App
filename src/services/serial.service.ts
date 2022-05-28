import { ConfigService, IConfig } from "./config.service"
import logger from "electron-log"
import { ReadlineParser, SerialPort } from "serialport"
import EventEmitter from "node:events"

export interface SerialState {
    status: "connected" | "disconnected";
    serialPort: SerialPort | null;
}

const INITIAL_SERIAL_STATE: SerialState = { status: "disconnected", serialPort: null }

export class SerialService extends EventEmitter {
    private stateSubject = INITIAL_SERIAL_STATE

    constructor(private configService: ConfigService) {
        super()
        logger.info( "INIT | SerialService" )
        this.tryConnection()
    }

    /**
     * Try to connect to the serial port
     */
    private tryConnection = (): void => {
        const { com_port, baud_rate } = this.config()

        logger.debug( `SERIAL | Attempting Connection for port ${ com_port } at ${ baud_rate } baud` )

        const prevSerialPort = this.stateSubject.serialPort
        if ( prevSerialPort?.isOpen ) prevSerialPort.close()

        SerialPort.list().then( ports => {
            if ( !ports.find( port => port.path === com_port ) ) {
                logger.error( `SERIAL | No device exists at port path ${ com_port }` )
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
                logger.error( `SERIAL | Connection Failed with msg: ${ msg }` )
                process.exit()
            }

            this.stateSubject = { status: "connected", serialPort }
            logger.info( `SERIAL | Connection Successful for port ${ com_port } at ${ baud_rate } baud` )

            this.updateSerialPortInfo()
        } )
    }

    /**
     * Add event listeners to the serial port
     */
    private updateSerialPortInfo = (): void => {
        this.stateSubject.serialPort
            .pipe( new ReadlineParser( { delimiter: "\r\n" } ) )
            .on( "data", data => this.emit( "serialData", data ) )
            .on( "error", () => {
                logger.error( `SERIAL | Missing device at port path ${ this.config().com_port }` )
                process.exit()
            } )
    }

    /**
     * The config object
     */
    private config = (): IConfig => {
        return this.configService.config
    }

}
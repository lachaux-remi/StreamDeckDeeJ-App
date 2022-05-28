"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SerialService = void 0;
const tslib_1 = require("tslib");
const electron_log_1 = tslib_1.__importDefault(require("electron-log"));
const serialport_1 = require("serialport");
const node_events_1 = tslib_1.__importDefault(require("node:events"));
const INITIAL_SERIAL_STATE = { status: "disconnected", serialPort: null };
class SerialService extends node_events_1.default {
    constructor(configService) {
        super();
        this.configService = configService;
        this.stateSubject = INITIAL_SERIAL_STATE;
        /**
         * Try to connect to the serial port
         */
        this.tryConnection = () => {
            const { com_port, baud_rate } = this.config();
            electron_log_1.default.debug(`SERIAL | Attempting Connection for port ${com_port} at ${baud_rate} baud`);
            const prevSerialPort = this.stateSubject.serialPort;
            if (prevSerialPort?.isOpen)
                prevSerialPort.close();
            serialport_1.SerialPort.list().then(ports => {
                if (!ports.find(port => port.path === com_port)) {
                    electron_log_1.default.error(`SERIAL | No device exists at port path ${com_port}`);
                    process.exit();
                }
            });
            const serialPort = new serialport_1.SerialPort({
                path: com_port,
                baudRate: baud_rate,
                dataBits: 8,
                parity: "none",
                stopBits: 1,
                autoOpen: false
            });
            serialPort.open(err => {
                if (err) {
                    const msg = err?.message;
                    electron_log_1.default.error(`SERIAL | Connection Failed with msg: ${msg}`);
                    process.exit();
                }
                this.stateSubject = { status: "connected", serialPort };
                electron_log_1.default.info(`SERIAL | Connection Successful for port ${com_port} at ${baud_rate} baud`);
                this.updateSerialPortInfo();
            });
        };
        /**
         * Add event listeners to the serial port
         */
        this.updateSerialPortInfo = () => {
            this.stateSubject.serialPort
                .pipe(new serialport_1.ReadlineParser({ delimiter: "\r\n" }))
                .on("data", data => this.emit("serialData", data))
                .on("error", () => {
                electron_log_1.default.error(`SERIAL | Missing device at port path ${this.config().com_port}`);
                process.exit();
            });
        };
        /**
         * The config object
         */
        this.config = () => {
            return this.configService.config;
        };
        electron_log_1.default.info("INIT | SerialService");
        this.tryConnection();
    }
}
exports.SerialService = SerialService;
//# sourceMappingURL=serial.service.js.map
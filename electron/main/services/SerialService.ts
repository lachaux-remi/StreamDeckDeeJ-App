import { ipcMain } from "electron";
import { ok } from "node:assert";
import { EventEmitter } from "node:events";
import { Logger } from "pino";
import { ReadlineParser, SerialPort } from "serialport";

import { Settings } from "../types/SettingsType";
import ConfigService from "./ConfigService";
import LoggerService from "./LoggerService";

class SerialService extends EventEmitter {
  private readonly logger: Logger;
  private serialPort: SerialPort | null = null;
  private comPort: string | undefined;
  private baudRate: number | undefined;

  constructor(
    loggerService: LoggerService,
    readonly configService: ConfigService
  ) {
    super();
    this.logger = loggerService.getLogger().child({ service: "SerialService" });
    this.logger.info("INIT");

    configService.onUpdated(this.setConfig);
    this.setConfig(configService.getConfig());

    ipcMain.handle("serial:list", async () => (await SerialPort.list()).map(port => port.path));
  }

  public send = (data: string): void => {
    if (this.serialPort) {
      this.logger.debug(`Sending data: ${data}`);
      this.serialPort.write(data);
    } else {
      this.logger.warn(`Serial port not open, cannot send data: ${data}`);
    }
  };

  private setConfig = (config: Partial<Settings>): void => {
    if (this.comPort !== config.comPort || this.baudRate !== config.baudRate) {
      this.comPort = config.comPort;
      this.baudRate = config.baudRate;

      this.reloadConnection().catch(error => this.logger.error(`Error reloading connection`, error));
    }
  };

  private reloadConnection = async () => {
    if (this.serialPort) {
      this.logger.info("Reloading connection");
      await new Promise(resolve => this.serialPort?.close(resolve));
      this.serialPort = null;
      return;
    }

    if (!this.comPort || !this.baudRate) {
      this.logger.warn("No comPort or baudRate defined");
      return;
    }

    this.serialPort = new SerialPort({
      path: this.comPort,
      baudRate: this.baudRate,
      dataBits: 8,
      parity: "none",
      stopBits: 1,
      autoOpen: false
    });

    this.serialPort
      .on("close", () => {
        this.logger.info("Connection closed");
        this.reconnect();
      })
      .open(err => {
        ok(this.serialPort);

        if (err) {
          const msg = (err as unknown as Error | null)?.message;
          this.logger.error(`Connection failed with msg: ${msg}`);
          this.reconnect();
          return;
        }

        this.logger.info(`Connection Successful on ${this.comPort} at ${this.baudRate} baud`);

        this.serialPort.pipe(new ReadlineParser({ delimiter: "\r\n" })).on("data", data => {
          try {
            const json = JSON.parse(data);
            if (json.type) {
              const type = json.type;

              this.logger.debug(`Received data: ${data}`);

              delete json.type;
              this.emit(`serial:${type}`, json);
            }
          } catch (error) {
            this.logger.error(`Error parsing data: ${error}`, data);
          }
        });
      });
  };

  private reconnect = () => {
    this.serialPort = null;
    setTimeout(this.reloadConnection, 1000);
  };
}

export default SerialService;

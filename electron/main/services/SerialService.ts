import { ipcMain } from "electron";
import { ok } from "node:assert";
import { EventEmitter } from "node:events";
import { ReadlineParser, SerialPort } from "serialport";

import { Settings } from "../types/SettingsType";
import ConfigService from "./ConfigService";

class SerialService extends EventEmitter {
  private serialPort: SerialPort | null = null;
  private comPort: string | undefined;
  private baudRate: number | undefined;

  constructor(readonly configService: ConfigService) {
    super();
    console.debug("SerialService   | INIT");

    configService.onUpdated(this.setConfig);
    this.setConfig(configService.getConfig());

    ipcMain.handle("serial:list", async () => (await SerialPort.list()).map(port => port.path));
  }

  public send = (data: string): void => {
    if (this.serialPort) {
      console.debug(`SerialService   | Sending data: ${data}`);
      this.serialPort.write(data);
    } else {
      console.debug(`SerialService   | Serial port not open, cannot send data: ${data}`);
    }
  };

  private setConfig = (config: Partial<Settings>): void => {
    if (this.comPort !== config.comPort || this.baudRate !== config.baudRate) {
      this.comPort = config.comPort;
      this.baudRate = config.baudRate;

      this.reloadConnection().catch(error => console.debug(`SerialService   | Error reloading connection: ${error}`));
    }
  };

  private reloadConnection = async () => {
    if (this.serialPort) {
      console.debug("SerialService   | Reloading connection");
      await new Promise(resolve => this.serialPort?.close(resolve));
      this.serialPort = null;
      return;
    }

    if (!this.comPort || !this.baudRate) {
      console.debug("SerialService   | No comPort or baudRate defined");
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
        console.debug("SerialService   | Connection closed");
        this.reconnect();
      })
      .open(err => {
        ok(this.serialPort);

        if (err) {
          const msg = (err as unknown as Error | null)?.message;
          console.debug(`SerialService   | Connection failed with msg: ${msg}`);
          this.reconnect();
          return;
        }

        console.debug(`SerialService   | Connection Successful on ${this.comPort} at ${this.baudRate} baud`);

        this.serialPort.pipe(new ReadlineParser({ delimiter: "\r\n" })).on("data", data => {
          try {
            const json = JSON.parse(data);
            if (json.type) {
              const type = json.type;

              if (type !== "deej") {
                console.debug(`SerialService   | Received data: ${data}`);
              }

              delete json.type;
              this.emit(`serial:${type}`, json);
            }
          } catch (error) {
            console.debug(`SerialService   | Error parsing data: ${error}`, data);
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

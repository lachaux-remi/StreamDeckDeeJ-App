import { ipcMain } from "electron";
import { EventEmitter } from "node:events";
import pino, { Logger } from "pino";

class LoggerService extends EventEmitter {
  private readonly logger: Logger;
  private logs: object[] = [];

  constructor() {
    super();

    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;

    this.logger = pino({
      level: "info",
      hooks: {
        logMethod(args, method, level) {
          self.logs.push({ args, level });
          self.emit("log", { args, level });
          return method.apply(this, args);
        }
      }
    });

    ipcMain.handle("electron:logs", () => this.logs);
  }

  public getLogger = (): Logger => {
    return this.logger;
  };

  public onUpdated = (listener: (logs: object[]) => void): void => {
    this.on("logs:updated", listener);
  };
}

export default LoggerService;

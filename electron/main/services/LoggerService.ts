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
      level: "trace",
      hooks: {
        logMethod(args, method, level) {
          const log = { args, level: this.levels.labels[level], ...this.bindings() };
          self.logs.push(log);
          self.emit("log", log);
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

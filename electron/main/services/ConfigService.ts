import { app, ipcMain } from "electron";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Logger } from "pino";

import { Settings } from "../types/SettingsType";
import LoggerService from "./LoggerService";

class ConfigService extends EventEmitter {
  private readonly logger: Logger;
  private readonly configPath: string = join(app.getPath("userData"), "config.json");
  private config: Partial<Settings> = {};

  constructor(loggerService: LoggerService) {
    super();
    this.logger = loggerService.getLogger().child({ module: "ConfigService" });
    this.logger.info("INIT");

    if (!existsSync(this.configPath)) {
      this.logger.debug(`Config file not found, creating default config file`);
      this.setConfig({ comPort: "COM1", baudRate: 9600, deej: {}, streamdeck: {} });
    }

    ipcMain.handle("setting:hydrate", () => this.getConfig());
    ipcMain.on("settings:update", (_, config: Partial<Settings>) => this.setConfig(config));
  }

  public getConfigPath = (): string => {
    return this.configPath;
  };

  public getConfig = (): Partial<Settings> => {
    return this.config;
  };

  public setConfig = (config: Partial<Settings>): void => {
    this.config = config;

    try {
      writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error while saving config: ${error.message}`, error);
      }
    }

    this.emit("config:updated", this.config);
  };

  public whenReady = async (): Promise<Partial<Settings>> => {
    return new Promise(resolve => {
      this.once("config:updated", (config: Partial<Settings>) => resolve(config));
      this.loadConfig();
    });
  };

  public onUpdated = (listener: (config: Partial<Settings>) => void): void => {
    this.on("config:updated", listener);
  };

  private loadConfig = (): void => {
    this.logger.info(`Loading config`, this.configPath);

    try {
      this.config = JSON.parse(readFileSync(this.configPath, "utf8"));
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(`Error while loading config ${error.message}`, error);
      }
    }

    this.emit("config:updated", this.config);
  };
}

export default ConfigService;

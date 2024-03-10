import { app, ipcMain } from "electron";
import { EventEmitter } from "node:events";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { Settings } from "../types/SettingsType";

class ConfigService extends EventEmitter {
  private readonly configPath: string = join(app.getPath("userData"), "config.json");
  private config: Partial<Settings> = {};

  constructor() {
    super();
    console.debug("ConfigService   | INIT");

    if (!existsSync(this.configPath)) {
      console.debug(`ConfigService   | Config file not found, creating default config file`);
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
        console.debug(`ConfigService   | Error while saving config: ${error.message}`, error);
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
    console.debug(`ConfigService   | Loading config`, this.configPath);

    try {
      this.config = JSON.parse(readFileSync(this.configPath, "utf8"));
    } catch (error) {
      if (error instanceof Error) {
        console.debug(`ConfigService   | Error while loading config ${error.message}`, error);
      }
    }

    this.emit("config:updated", this.config);
  };
}

export default ConfigService;

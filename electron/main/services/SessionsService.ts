import { ipcMain } from "electron";
import { NodeAudioVolumeMixer } from "node-audio-volume-mixer";
import { EventEmitter } from "node:events";
import { Logger } from "pino";

import ConfigService from "./ConfigService";
import LoggerService from "./LoggerService";
import SliderService from "./SliderService";

const MIN_REFRESH_TIME = 5 * 1000;
const MAX_REFRESH_TIME = 45 * 1000;
const CUSTOM_SESSIONS = ["master"];

interface ProcessStruct {
  pid: number;
  name: string;
}

class SessionsService extends EventEmitter {
  private readonly logger: Logger;
  private isStale: boolean = false;
  private isStaleTask: NodeJS.Timeout | null = null;
  private isFresh: boolean = false;
  private isFreshTask: NodeJS.Timeout | null = null;
  private sessions = NodeAudioVolumeMixer.getAudioSessionProcesses() || [];

  constructor(
    loggerService: LoggerService,
    readonly configService: ConfigService,
    readonly sliderService: SliderService
  ) {
    super();
    this.logger = loggerService.getLogger().child({ service: "SessionsService" });
    this.logger.debug("INIT");

    this.runIsStaleTask();
    this.runIsFreshTask();

    ipcMain.handle("deej:session", this.getNotAssignedSessions);

    sliderService.on("slider:updated", this.updateSessions);
  }

  public getNotAssignedSessions = (): string[] => {
    const attributedSessions: string[] = [];
    for (const sliderKey in this.configService.getConfig().deej || {}) {
      attributedSessions.push(
        ...(this.configService.getConfig().deej?.[sliderKey] || []).flatMap(session => session.toLowerCase())
      );
    }

    this.refreshSessions("client request");

    return this.sessions
      .flatMap(session => {
        if (session.pid === 0) {
          return "master";
        }

        if (session.name === "") {
          return `PID: ${session.pid}`;
        }

        return session.name.toLowerCase();
      })
      .filter(session => !attributedSessions.includes(session));
  };

  private refreshSessions = (reason: string): void => {
    this.logger.warn(`refreshing: ${reason ? reason : ""}`);
    this.sessions = NodeAudioVolumeMixer.getAudioSessionProcesses();
    this.isFresh = true;
    this.isStale = false;

    this.runIsStaleTask();
    this.runIsFreshTask();
  };

  private runIsStaleTask = () => {
    if (this.isStale) {
      return;
    }

    if (this.isStaleTask) {
      clearTimeout(this.isStaleTask);
    }

    setTimeout(() => (this.isStale = true), MAX_REFRESH_TIME);
  };

  private runIsFreshTask = () => {
    if (!this.isFresh) {
      return;
    }
    if (this.isFreshTask) {
      clearTimeout(this.isFreshTask);
    }

    setTimeout(() => (this.isFresh = false), MIN_REFRESH_TIME);
  };

  private setSessionVolume = (sessionName: string, sessions: ProcessStruct[], value: number): void => {
    if (sessionName === "master") {
      NodeAudioVolumeMixer.setMasterVolumeLevelScalar(value);
    } else {
      sessions
        .filter(session => session.name.toLowerCase() === sessionName.toLowerCase())
        .forEach(session => NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(session.pid, value));
    }
  };

  private updateSessions = (sliderKey: string, value: number) => {
    if (this.isStale) {
      this.refreshSessions("staled out");
      return;
    }

    const targetSessions = this.configService.getConfig().deej?.[sliderKey] || [];
    if (
      !targetSessions
        .filter(sessionName => !CUSTOM_SESSIONS.includes(sessionName))
        .every(sessionName => this.sessions.map(session => session.name).includes(sessionName)) &&
      !this.isFresh
    ) {
      this.refreshSessions("target session not found");
      return;
    }
    targetSessions.forEach(sessionName => this.setSessionVolume(sessionName, this.sessions, value));
  };
}

export default SessionsService;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionsService = void 0;
const tslib_1 = require("tslib");
const electron_log_1 = tslib_1.__importDefault(require("electron-log"));
const node_audio_volume_mixer_1 = require("node-audio-volume-mixer");
const node_events_1 = tslib_1.__importDefault(require("node:events"));
const MIN_REFRESH_TIME = 5 * 1000;
const MAX_REFRESH_TIME = 45 * 1000;
const CUSTOM_SESSIONS = ["master"];
class SessionsService extends node_events_1.default {
    constructor(configService, sliderService) {
        super();
        this.configService = configService;
        this.stateSubject = {
            isFresh: true,
            isStale: false,
            sessions: node_audio_volume_mixer_1.NodeAudioVolumeMixer.getAudioSessionProcesses() || []
        };
        this.isStaleTask = null;
        this.isFreshTask = null;
        this.setSessionVolume = (sessionName, sessions, value) => {
            if (sessionName === "master") {
                node_audio_volume_mixer_1.NodeAudioVolumeMixer.setMasterVolumeLevelScalar(value);
            }
            else {
                sessions.filter(session => session.name.toLowerCase() === sessionName.toLowerCase())
                    .forEach(session => node_audio_volume_mixer_1.NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar(session.pid, value));
            }
        };
        this.refreshSessions = (reason) => {
            electron_log_1.default.debug(`SESSIONS | refreshed: ${reason ? reason : ""}`);
            const sessions = node_audio_volume_mixer_1.NodeAudioVolumeMixer.getAudioSessionProcesses();
            this.stateSubject = { isFresh: true, isStale: false, sessions };
            this.emit("sessionsChange", this.stateSubject);
            this.runIsStaleTask();
            this.runIsFreshTask();
        };
        this.getTargetSessions = (sliderKey) => {
            let value = this.configService.config.slider_mapping[sliderKey] ?? [];
            if (typeof value === "string") {
                value = [value];
            }
            return value;
        };
        this.runIsStaleTask = () => {
            if (this.stateSubject.isStale)
                return;
            if (this.isStaleTask)
                clearTimeout(this.isStaleTask);
            setTimeout(() => {
                this.stateSubject.isStale = true;
            }, MAX_REFRESH_TIME);
        };
        this.runIsFreshTask = () => {
            if (!this.stateSubject.isFresh)
                return;
            if (this.isFreshTask)
                clearTimeout(this.isFreshTask);
            setTimeout(() => {
                this.stateSubject.isFresh = false;
            }, MIN_REFRESH_TIME);
        };
        this.updateSessions = (slide, value) => {
            if (this.stateSubject.isStale) {
                this.refreshSessions("staled out");
                return;
            }
            const targetSessions = this.getTargetSessions(slide);
            if (!targetSessions.filter(sessionName => !CUSTOM_SESSIONS.includes(sessionName))
                .every(sessionName => this.stateSubject.sessions.map(session => session.name).includes(sessionName))
                && !this.stateSubject.isFresh) {
                this.refreshSessions("target session not found");
                return;
            }
            targetSessions.forEach(sessionName => this.setSessionVolume(sessionName, this.stateSubject.sessions, value));
        };
        electron_log_1.default.info("INIT | SessionsService");
        this.runIsStaleTask();
        this.runIsFreshTask();
        sliderService.on("sliderChange", this.updateSessions);
    }
}
exports.SessionsService = SessionsService;
//# sourceMappingURL=sessions.service.js.map
import { ConfigService } from "./config.service"
import { SliderService } from "./slider.service"
import logger from "electron-log"
import { NodeAudioVolumeMixer } from "node-audio-volume-mixer"
import EventEmitter from "node:events"

interface Session {
    pid: number;
    name: string;
}

export interface SessionsState {
    isFresh: boolean;
    isStale: boolean;
    sessions: Session[];
}

const MIN_REFRESH_TIME = 5 * 1000
const MAX_REFRESH_TIME = 45 * 1000

const CUSTOM_SESSIONS = [ "master" ]

export class SessionsService extends EventEmitter {
    public stateSubject: SessionsState = {
        isFresh: true,
        isStale: false,
        sessions: NodeAudioVolumeMixer.getAudioSessionProcesses() || []
    }
    private isStaleTask: NodeJS.Timeout = null
    private isFreshTask: NodeJS.Timeout = null

    constructor(private configService: ConfigService, sliderService: SliderService) {
        super()
        logger.info( "INIT | SessionsService" )

        this.runIsStaleTask()
        this.runIsFreshTask()

        sliderService.on( "sliderChange", this.updateSessions )
    }

    public setSessionVolume = (sessionName: string, sessions: Session[], value: number): void => {
        if ( sessionName === "master" ) {
            NodeAudioVolumeMixer.setMasterVolumeLevelScalar( value )
        } else {
            sessions.filter( session => session.name.toLowerCase() === sessionName.toLowerCase() )
                .forEach( session => NodeAudioVolumeMixer.setAudioSessionVolumeLevelScalar( session.pid, value ) )
        }
    }

    public refreshSessions = (reason: string): void => {
        logger.debug( `SESSIONS | refreshed: ${ reason ? reason : "" }` )
        const sessions = NodeAudioVolumeMixer.getAudioSessionProcesses()
        this.stateSubject = { isFresh: true, isStale: false, sessions }

        this.emit( "sessionsChange", this.stateSubject )

        this.runIsStaleTask()
        this.runIsFreshTask()
    }

    public getTargetSessions = (sliderKey: number): string[] => {
        let value = this.configService.config.slider_mapping[sliderKey] ?? []
        if ( typeof value === "string" ) {
            value = [ value ]
        }
        return value
    }

    private runIsStaleTask = () => {
        if ( this.stateSubject.isStale ) return
        if ( this.isStaleTask ) clearTimeout( this.isStaleTask )

        setTimeout( () => {
            this.stateSubject.isStale = true
        }, MAX_REFRESH_TIME )
    }

    private runIsFreshTask = () => {
        if ( !this.stateSubject.isFresh ) return
        if ( this.isFreshTask ) clearTimeout( this.isFreshTask )

        setTimeout( () => {
            this.stateSubject.isFresh = false
        }, MIN_REFRESH_TIME )
    }

    private updateSessions = (slide: number, value: number): void => {
        if ( this.stateSubject.isStale ) {
            this.refreshSessions( "staled out" )
            return
        }

        const targetSessions = this.getTargetSessions( slide )
        if (
            !targetSessions.filter( sessionName => !CUSTOM_SESSIONS.includes( sessionName ) )
                .every( sessionName => this.stateSubject.sessions.map( session => session.name ).includes( sessionName ) )
            && !this.stateSubject.isFresh ) {
            this.refreshSessions( "target session not found" )
            return
        }
        targetSessions.forEach( sessionName => this.setSessionVolume( sessionName, this.stateSubject.sessions, value ) )
    }
}
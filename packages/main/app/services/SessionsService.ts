import ConfigService from "./config/ConfigService"
import SliderService from "./SliderService"
import { NodeAudioVolumeMixer } from "node-audio-volume-mixer"
import { EventEmitter } from "events"

interface Session {
    pid: number
    name: string
}

export interface SessionsState {
    isFresh: boolean;
    isStale: boolean;
    sessions: Session[];
}

const MIN_REFRESH_TIME = 5 * 1000
const MAX_REFRESH_TIME = 45 * 1000

const CUSTOM_SESSIONS = [ "master" ]

export default class SessionsService extends EventEmitter {
    public stateSubject: SessionsState = {
        isFresh: true,
        isStale: false,
        sessions: NodeAudioVolumeMixer.getAudioSessionProcesses() || []
    }
    private isStaleTask: NodeJS.Timeout | null = null
    private isFreshTask: NodeJS.Timeout | null = null

    constructor(private configService: ConfigService, sliderService: SliderService) {
        super()
        console.info( "INIT | SessionsService" )

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
        console.debug( `SESSIONS | refreshed: ${ reason ? reason : "" }` )
        const sessions = NodeAudioVolumeMixer.getAudioSessionProcesses()
        this.stateSubject = { isFresh: true, isStale: false, sessions }

        this.emit( "sessionsChange", this.stateSubject )
        this.emit( "sessions-updated" )

        this.runIsStaleTask()
        this.runIsFreshTask()
    }

    public getTargetSessions = (sliderKey: number): string[] => {
        let value = this.configService.getConfig().slider_mapping[sliderKey] ?? []
        if ( typeof value === "string" ) {
            value = [ value ]
        }
        return value
    }

    /**
     * Return the session name not associated with a slider.
     */
    public getNotAssignedSessions = (): string[] => {
        const attributedSessions: string[] = []
        for ( const sliderKey in this.configService.getConfig().slider_mapping ) {
            attributedSessions.push(
                ...this.configService.getConfig().slider_mapping[sliderKey]
                    .flatMap( session => session.toLowerCase() )
            )
        }

        return this.stateSubject.sessions
            .flatMap( session => session.name != "" ? session.name.toLowerCase() : "master" )
            .filter( session => !attributedSessions.includes( session ) )
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

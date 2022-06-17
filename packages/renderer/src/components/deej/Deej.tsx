import { Component, ComponentState, MouseEvent, ReactNode } from "react"
import { nextTick, range } from "../../../../main/app/helpers"
import Slider from "@/components/deej/Slider"
import ConfigType from "../../../../main/app/services/config/ConfigType"
import { SlidersVolume } from "../../../../main/app/services/SliderService"
import ContextMenu, { ContextMenuOptionType, ContextMenuPositionsType } from "@/components/ContextMenu"
import DeejOption from "@/components/deej/DeejOption"

type ContextMenuType = { configKey: string } & ContextMenuPositionsType

interface DeejState extends ComponentState {
    showOption?: string
    contextMenu?: ContextMenuType
    config: ConfigType
    slidersVolume: SlidersVolume
    notAssigned: string[]
}

export default class Deej extends Component<object, DeejState> {
    private configEdited = false

    constructor(props: object) {
        super( props )

        this.state = {
            config: window.api.get<ConfigType>( "config" ),
            slidersVolume: window.api.get<SlidersVolume>( "sliders-volume" ),
            notAssigned: window.api.get<string[]>( "sessions-not-assigned" )
        }
        window.api.on( `config`, (config: ConfigType) => this.setState( { config } ) )
        window.api.on( `sliders-volume`, (slidersVolume: SlidersVolume) => this.setState( { slidersVolume } ) )
        window.api.on( `sessions-not-assigned`, (notAssigned: string[]) => this.setState( { notAssigned: notAssigned } ) )
    }

    render(): ReactNode {
        return (
            <>
                <div className="deej">
                    { range( 0, 4 ).map( (i: number) => {
                        const configKey = i.toString()
                        return (
                            <Slider configKey={ configKey }
                                    mapping={ this.state.config.slider_mapping[configKey] || [] }
                                    volume={ Math.round( this.state.slidersVolume[configKey] * 100 ) || 0 }
                                    onContextMenu={ event => this.openContextMenu( event, configKey ) }
                                    key={ `slider-${ i }` }/>
                        )
                    } ) }
                </div>
                { this.contextMenuRender() }
                { this.optionRender() }
            </>
        )
    }

    /* Close previous context menu and open new on the next tick render */
    private openContextMenu = (event: MouseEvent, configKey: string): void => {
        if ( this.state.contextMenu ) this.setState( { contextMenu: undefined } )
        nextTick( () => this.setState( {
            contextMenu: {
                configKey,
                x: event.clientX,
                y: event.clientY
            }
        } ) )
    }

    private contextMenuRender = (): ReactNode => {
        const contextMenu = this.state.contextMenu
        if ( contextMenu ) {
            return ( <ContextMenu
                positions={ { x: contextMenu.x, y: contextMenu.y } }
                onClose={ () => this.setState( { contextMenu: undefined } ) }
                options={ [
                    this.editContextMenu( contextMenu )
                ] }
            /> )
        }
        return null
    }

    private optionRender = (): ReactNode => {
        const showOption = this.state.showOption
        if ( showOption ) {
            return ( <DeejOption
                configKey={ showOption }
                mapping={ this.state.config.slider_mapping[showOption] || [] }
                notAssigned={ this.state.notAssigned || [] }
                addToNotAssigned={ this.addToNotAssigned }
                addToAssigned={ this.addToAssigned }
                reloadSessions={ this.reloadSessions }
                onClose={ this.saveOption }
            /> )
        }
        return null
    }

    private editContextMenu = (contextMenu: ContextMenuType): ContextMenuOptionType => {
        return {
            label: "Modifier",
            run: () => this.setState( { showOption: contextMenu.configKey } )
        }
    }

    private addToNotAssigned = (configKey: string, session: string): void => {
        const notAssigned = this.state.notAssigned
        notAssigned.push( session )

        const slidersMapping = this.state.config.slider_mapping
        slidersMapping[configKey].splice( slidersMapping[configKey].indexOf( session ), 1 )

        this.setState( { notAssigned, slidersMapping } )
        this.configEdited = true
    }

    private addToAssigned = (configKey: string, session: string): void => {
        const slidersMapping = this.state.config.slider_mapping
        slidersMapping[configKey].push( session )

        const notAssigned = this.state.notAssigned
        notAssigned.splice( notAssigned.indexOf( session ), 1 )

        this.setState( { notAssigned, slidersMapping } )
        this.configEdited = true
    }

    private saveOption = (): void => {
        this.setState( { showOption: undefined } )
        if ( this.configEdited ) {
            window.api.send( "config", this.state.config )
            this.configEdited = false
        }
    }

    private reloadSessions = (): void => {
        window.api.send( "sessions-reload" )
    }
}

import { Component, ComponentState, MouseEvent, ReactNode } from "react"
import ConfigType, { DeckConfig } from "../../../../main/app/services/config/ConfigType"
import { isEmpty, nextTick, range } from "../../../../main/app/helpers"
import classNames from "classnames"
import ContextMenu, { ContextMenuOptionType, ContextMenuPositionsType } from "@/components/ContextMenu"
import DeckOption from "@/components/deck/DeckOption"

type ContextMenuType = { configKey: string } & ContextMenuPositionsType

interface DeckState extends ComponentState {
    showOption?: string
    contextMenu?: ContextMenuType
    moveButton?: string
    config: ConfigType
    data: {}
}

export default class Deck extends Component<{}, DeckState> {
    constructor(props: {}) {
        super( props )

        this.state = { config: window.api.get<ConfigType>( "config" ), data: {} }
        window.api.on( "config", (config: ConfigType) => this.setState( { config } ) )
        window.api.on( "deck-key-pressed", (key: string, data: any) => {
            this.setState( { data: { ...this.state.data, [key]: data } } )
        } )
    }

    render(): ReactNode {
        return (
            <>
                <div className="deck">
                    { range( 0, 15 ).map( (i: number) => {
                        const configKey = i.toString()
                        return (
                            <div title={ `Bouton ${ configKey }` }
                                 className={ classNames( "deck-button", { "deck-button-movable": this.isCurrentMoving() && !this.isCurrentMoving( configKey ) } ) }
                                 onClick={ () => this.onClick( configKey ) }
                                 onContextMenu={ event => this.openContextMenu( event, configKey ) }
                                 key={ `button-${ configKey }` }>
                                { this.infosRender( configKey ) }
                                { this.imageRender( configKey ) }
                            </div>
                        )
                    } ) }
                </div>
                { this.contextMenuRender() }
                { this.optionRender() }
            </>
        )
    }

    private infosRender = (configKey: string): ReactNode[] => {
        let render: ReactNode[] = []
        const config = this.getConfigForKey( configKey )
        if ( config ) {
            const data = ( this.state.data as { [key: string]: any } )[configKey] as { [key: string]: any } | undefined
            if ( config.pressed.module === "tapo" ) {
                if ( [ "toggle", "turnOn", "turnOff" ].includes( config.pressed.params[0] ) ) {
                    render.push( <div key={ `${ configKey }-tapo-${ config.pressed.params[0] }-pressed` }
                                      className="deck-button-infos deck-button-info-pressed"
                                      title={ data ? data?.device_on ? "Allumé" : "Éteint" : "N/D" }/> )
                } else if ( config.pressed.params[0] === "brightness" ) {
                    render.push( <div key={ `${ configKey }-tapo-${ config.pressed.params[0] }-pressed` }
                                      className="deck-button-infos deck-button-info-pressed"
                                      title={ data?.brightness ?? "N/D" }/> )
                }
            } else if ( config.pressed.module === "octopi-led" ) {
                if ( [ "toggleLight", "turnLightOn", "turnLightOff" ].includes( config.pressed.params[0] ) ) {
                    render.push( <div key={ `${ configKey }-octopi-led-${ config.pressed.params[0] }-pressed` }
                                      className="deck-button-infos deck-button-info-pressed"
                                      title={ data ? data?.lights_on ? "Allumé" : "Éteint" : "N/D" }/> )
                } else if ( [ "toggleTorche", "turnTorcheOn", "turnTorcheOff" ].includes( config.pressed.params[0] ) ) {
                    render.push( <div key={ `${ configKey }-octopi-led-${ config.pressed.params[0] }-pressed` }
                                      className="deck-button-infos deck-button-info-pressed"
                                      title={ data ? data?.torch_on ? "Allumé" : "Éteint" : "N/D" }/> )
                }
            }

            if ( config.hold ) {
                if ( config.hold.module === "tapo" ) {
                    if ( [ "toggle", "turnOn", "turnOff" ].includes( config.hold.params[0] ) ) {
                        render.push( <div key={ `${ configKey }-tapo-${ config.hold.params[0] }-hold` }
                                          className="deck-button-infos deck-button-info-hold"
                                          title={ data ? data?.device_on ? "Allumé" : "Éteint" : "N/D" }/> )
                    } else if ( config.hold.params[0] === "brightness" ) {
                        render.push( <div key={ `${ configKey }-tapo-${ config.hold.params[0] }-hold` }
                                          className="deck-button-infos deck-button-info-hold"
                                          title={ data?.brightness ?? "N/D" }/> )
                    }
                } else if ( config.hold.module === "octopi-led" ) {
                    if ( [ "toggleLight", "turnLightOn", "turnLightOff" ].includes( config.hold.params[0] ) ) {
                        render.push( <div key={ `${ configKey }-octopi-led-${ config.hold.params[0] }-hold` }
                                          className="deck-button-infos deck-button-info-hold"
                                          title={ data ? data?.lights_on ? "Allumé" : "Éteint" : "N/D" }/> )
                    } else if ( [ "toggleTorche", "turnTorcheOn", "turnTorcheOff" ].includes( config.hold.params[0] ) ) {
                        render.push( <div key={ `${ configKey }-octopi-led-${ config.hold.params[0] }-hold` }
                                          className="deck-button-infos deck-button-info-hold"
                                          title={ data ? data?.torch_on ? "Allumé" : "Éteint" : "N/D" }/> )
                    }
                }
            }
        }
        return render
    }

    private imageRender = (configKey: string): ReactNode => {
        const config = this.getConfigForKey( configKey )
        if ( config ) {
            if ( config.image ) return (
                <img className="deck-button-image" src={ config.image } alt={ `Bouton ${ configKey }` }/>
            )
            return this.imageNotFoundRender()
        }
        return null
    }

    private imageNotFoundRender = (): ReactNode => {
        return (
            <svg className="deck-button-image"
                 xmlns="http://www.w3.org/2000/svg"
                 viewBox="0 0 32 32">
                <circle cx="13" cy="10" r="3" fill="currentColor"/>
                <path
                    d="M19.29 12.29 13 18.59l-3.29-3.3a1 1 0 0 0-1.42 0L6 17.59V26h20v-8.41l-5.29-5.3a1 1 0 0 0-1.42 0z"
                    fill="currentColor"/>
                <path
                    d="M27 2H5a3 3 0 0 0-3 3v22a3 3 0 0 0 3 3h22a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3zm1 25a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h22a1 1 0 0 1 1 1z"
                    fill="currentColor"/>
            </svg>
        )
    }

    private onClick = (configKey: string): void => {
        if ( this.isCurrentMoving() ) {
            if ( this.isCurrentMoving( configKey ) ) {
                this.setState( { moveButton: undefined } )
                return
            }

            const moveBtn = this.getConfigForKey( this.state.moveButton! )
            const currentBtn = this.getConfigForKey( configKey )
            this.setConfigForKey( configKey, moveBtn )
            this.setConfigForKey( this.state.moveButton!, currentBtn )
            this.saveConfig()

            this.setState( { moveButton: undefined } )
        }

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
            const deckConfig = this.getConfigForKey( contextMenu.configKey )
            return ( <ContextMenu
                positions={ { x: contextMenu.x, y: contextMenu.y } }
                onClose={ () => this.setState( { contextMenu: undefined } ) }
                options={ [
                    this.addOrEditContextMenu( contextMenu, deckConfig ),
                    this.moveContextMenu( contextMenu, deckConfig ),
                    this.deleteContextMenu( contextMenu, deckConfig )
                ] }
            /> )
        }
        return null
    }

    private optionRender = (): ReactNode => {
        const showOption = this.state.showOption
        if ( showOption ) {
            return ( <DeckOption
                configKey={ showOption }
                deckConfig={ this.getConfigForKey( showOption ) }
                onClose={ this.saveOption }
            /> )
        }
        return null
    }

    private saveOption = (deckConfig: DeckConfig): void => {
        if ( isEmpty( deckConfig ) ) delete this.state.config.deck_mapping[this.state.showOption!]
        else this.state.config.deck_mapping[this.state.showOption!] = deckConfig
        this.saveConfig()

        this.setState( { showOption: undefined } )
    }

    private getConfigForKey = (configKey: string): DeckConfig => {
        return this.state.config.deck_mapping[configKey]
    }

    /* Update the state value this is not persistent state */
    private setConfigForKey = (configKey: string, deckConfig: DeckConfig): void => {
        this.state.config.deck_mapping[configKey] = deckConfig
    }

    private saveConfig = (): void => {
        window.api.send( "config", this.state.config )
    }

    private deleteButton = (configKey: string): void => {
        delete this.state.config.deck_mapping[configKey]
        this.saveConfig()
        this.setState( { showOption: undefined } )
    }

    private isCurrentMoving = (configKey?: string): boolean => {
        if ( configKey ) {
            return this.state.moveButton === configKey
        }
        return this.state.moveButton !== undefined
    }

    private addOrEditContextMenu = (contextMenu: ContextMenuType, deckConfig: DeckConfig): ContextMenuOptionType => {
        return {
            label: deckConfig ? "Modifier" : "Créer",
            run: () => this.setState( { showOption: contextMenu.configKey } )
        }
    }

    private moveContextMenu = (contextMenu: ContextMenuType, deckConfig: DeckConfig): ContextMenuOptionType => {
        return {
            label: this.isCurrentMoving( contextMenu.configKey ) ? "Annuler le déplacement" : "Déplacer",
            disabled: deckConfig === undefined,
            run: () => this.setState( {
                moveButton: this.isCurrentMoving( contextMenu.configKey ) ? undefined : contextMenu.configKey
            } )
        }
    }

    private deleteContextMenu = (contextMenu: ContextMenuType, deckConfig: DeckConfig): ContextMenuOptionType => {
        return {
            label: "Supprimer",
            className: "red",
            disabled: deckConfig === undefined,
            run: () => confirm( "Veux tu vraiment supprimer ce bouton ?" ) && this.deleteButton( contextMenu.configKey )
        }
    }
}

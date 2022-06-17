import { Component, ComponentProps, ComponentState, ReactNode } from "react"
import { DeckConfig, DeckState } from "../../../../main/app/services/config/ConfigType"
import ModuleType, { ModuleInputs } from "../../../../main/app/modules/ModuleType"
import Image from "@/components/inputs/Image"
import Select from "@/components/inputs/Select"
import Input from "@/components/inputs/Input"
import Textarea from "@/components/inputs/Textarea"

export const moduleOptions: ModuleType[] = [
    {
        key: "macro",
        name: "Macro",
        inputs: [
            { name: "Code arduino", type: "text" }
        ]
    },
    {
        key: "ir",
        name: "Led infrarouge",
        inputs: [
            { name: "Code infrarouge", type: "textarea" }
        ]
    },
    {
        key: "octopi-led",
        name: "OctoPrint Led",
        inputs: [
            {
                name: "Commande",
                type: "select",
                values: [
                    { key: "toggleLight", name: "Commuter la lumière" },
                    { key: "turnLightOn", name: "Allumer la lumière" },
                    { key: "turnLightOff", name: "Éteindre la lumière" },
                    { key: "toggleTorche", name: "Commuter la torche" },
                    { key: "turnTorcheOn", name: "Allumer la torche" },
                    { key: "turnTorcheOff", name: "Éteindre la torche" }
                ]
            },
            { name: "Adresse IP", type: "text" }
        ]
    },
    {
        key: "tapo",
        name: "TP-Link Tapo",
        inputs: [
            {
                name: "Commande",
                type: "select",
                values: [
                    { key: "toggle", name: "Commuter la lumière" },
                    { key: "turnOn", name: "Allumer la lumière" },
                    { key: "turnOff", name: "Éteindre la lumière" },
                    { key: "brightness", name: "Changer la luminosité" }
                ]
            },
            { name: "Adresse IP", type: "text" }
        ]
    }
]

interface DeckOptionProps extends ComponentProps<"div"> {
    configKey: string
    deckConfig: DeckConfig
    onClose: (deckConfig: DeckConfig) => void
}

interface DeckOptionState extends ComponentState {
    deckConfig: DeckConfig
}

export default class DeckOption extends Component<DeckOptionProps, DeckOptionState> {

    constructor(props: DeckOptionProps) {
        super( props )

        this.state = {
            deckConfig: props.deckConfig || {} as DeckConfig
        }
    }

    render(): ReactNode {
        return (
            <div className="options">
                <div className="options-header">
                    <div className="options-header-title">Configuration du bouton n°{ this.props.configKey }</div>
                    <svg className="options-header-close" height="32" width="32" xmlns="http://www.w3.org/2000/svg"
                         onClick={ () => this.props.onClose( this.state.deckConfig ) }>
                        <path d="m2 2 28 28m0-28L2 30 30 2Z" stroke="currentColor" strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="4"/>
                    </svg>
                </div>

                <div className="options-content deck-options">
                    <div className="deck-options-keys">
                        <div className="deck-options-key">
                            <div className="deck-options-key-title">
                                <span>Pression courte</span>
                            </div>

                            <div className="deck-options-key-content">
                                { this.inputsRender( "pressed" ) }
                            </div>
                        </div>
                        <div className="deck-options-key">
                            <div className="deck-options-key-title">
                                <span>Pression longue</span>
                            </div>

                            <div className="deck-options-key-content">
                                { this.inputsRender( "hold" ) }
                            </div>
                        </div>
                    </div>

                    <Image key="image" name="image" label="Image"
                           value={ this.state.deckConfig?.image || "" }
                           updatedValue={ value => {
                               const deckConfig = this.state.deckConfig
                               deckConfig["image"] = value
                               this.setState( { deckConfig } )
                           } }
                    />
                </div>
            </div>
        )
    }

    private inputsRender(type: DeckState): ReactNode[] {
        const inputs: ReactNode[] = []

        const value = this.state.deckConfig && this.state.deckConfig[type]
            ? this.state.deckConfig[type]?.module
            : ""

        inputs.push(
            <Select key={ `${ type }-module` } name={ `${ type }-module` } label="Module"
                    value={ value || "" }
                    values={ [
                        { key: "", label: "Sélectionner un module" },
                        ...moduleOptions.map( module => {
                            return { key: module.key, label: module.name }
                        } )
                    ] }
                    updatedValue={ value => {
                        const deckConfig = this.state.deckConfig
                        if ( value == "" ) delete deckConfig[type]
                        else deckConfig[type] = { module: value, params: [] }
                        this.setState( { deckConfig } )
                    } }
            />
        )

        if ( value ) {
            moduleOptions.find( module => module.key === this.state.deckConfig[type]?.module )?.inputs
                .forEach( (input, index) => inputs.push( this.inputRender( index, input, type ) ) )
        }

        return inputs
    }

    private inputRender = (index: number, input: ModuleInputs, type: DeckState): ReactNode => {
        const value = this.state.deckConfig[type]?.params?.length! > index ? this.state.deckConfig[type]?.params[index] : ""

        switch ( input.type ) {
            case "text":
                return (
                    <Input key={ `${ type }-params-${ index }` } type={ input.type }
                           name={ `${ type }-params-${ index }` }
                           label={ input.name }
                           value={ value || "" }
                           updatedValue={ value => {
                               const deckConfig = this.state.deckConfig
                               // @ts-ignore
                               deckConfig[type].params[index] = value
                               this.setState( { deckConfig } )
                           } }
                    />
                )
            case "textarea":
                return (
                    <Textarea key={ `${ type }-params-${ index }` } name={ `${ type }-params-${ index }` }
                              label={ input.name }
                              value={ value || "" }
                              updatedValue={ value => {
                                  const deckConfig = this.state.deckConfig
                                  // @ts-ignore
                                  deckConfig[type].params[index] = value
                                  this.setState( { deckConfig } )
                              } }
                    />
                )
            case "select":
                return (
                    <Select key={ `${ type }-params-${ index }` } name={ `${ type }-params-${ index }` }
                            label={ input.name }
                            value={ value || "" }
                            values={ [
                                { key: "", label: `Sélectionner une ${ input.name.toLowerCase() }` },
                                ...input.values.map( option => {
                                    return { key: option.key, label: option.name }
                                } )
                            ] }
                            updatedValue={ value => {
                                const deckConfig = this.state.deckConfig
                                // @ts-ignore
                                deckConfig[type].params[index] = value
                                this.setState( { deckConfig } )
                            } }
                    />
                )
        }
    }
}

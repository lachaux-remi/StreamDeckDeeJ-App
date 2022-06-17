import { Component, ComponentProps, ReactNode } from "react"

interface DeejOptionProps extends ComponentProps<"div"> {
    configKey: string
    mapping: string[]
    notAssigned: string[]
    addToNotAssigned: (configKey: string, session: string) => void
    addToAssigned: (configKey: string, session: string) => void
    reloadSessions: () => void
    onClose: () => void
}

export default class DeejOption extends Component<DeejOptionProps> {
    render(): ReactNode {
        return (
            <div className="options">
                <div className="options-header">
                    <div className="options-header-title">Configuration du slider n°{ this.props.configKey }</div>
                    <svg className="options-header-close" height="32" width="32" xmlns="http://www.w3.org/2000/svg"
                         onClick={ this.props.onClose }>
                        <path d="m2 2 28 28m0-28L2 30 30 2Z" stroke="currentColor" strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="4"/>
                    </svg>
                </div>

                <div className="options-content deej-options">
                    <div className="deej-options-list">
                        <div className="deej-options-list-title">
                            <span>Non attribué</span>
                            <svg className="deej-options-list-title-reload" height="19" width="19"
                                 xmlns="http://www.w3.org/2000/svg"
                                 onClick={ this.props.reloadSessions }>
                                <path
                                    d="m15.539 5.346-.813-.945a7.363 7.363 0 0 0-5.341-2.286A7.387 7.387 0 0 0 2 9.5a7.387 7.387 0 0 0 14.349 2.461"
                                    stroke="currentColor" fill="none" strokeLinecap="round" strokeMiterlimit="10"
                                    strokeWidth="4"/>
                                <path
                                    d="M18 3.4v4.254a.615.615 0 0 1-.615.615h-4.253a.615.615 0 0 1-.436-1.05l4.254-4.254a.615.615 0 0 1 1.05.436Z"
                                    fill="currentColor"/>
                            </svg>
                        </div>

                        <div className="deej-options-list-content">
                            <div className="deej-options-list-content-items">
                                { this.notAttributedRender() }
                            </div>
                        </div>
                    </div>
                    <svg className="deej-options-divider" height="68" width="68" xmlns="http://www.w3.org/2000/svg">
                        <path
                            d="M66 14.8H2m64 0L51.778 27.6M66 14.8 51.778 2M2 53.2h64m-64 0L16.222 66M2 53.2l14.222-12.8"
                            stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="4"/>
                    </svg>
                    <div className="deej-options-list">
                        <div className="deej-options-list-title">
                            <span>Actuellement attribué</span>
                        </div>

                        <div className="deej-options-list-content">
                            <div className="deej-options-list-content-items">
                                { this.mappingRender() }
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        )
    }

    private mappingRender = (): ReactNode[] => {
        return this.props.mapping.map( mapping => {
            return (
                <div className="deej-options-list-content-item"
                     onDoubleClick={ () => this.props.addToNotAssigned( this.props.configKey, mapping ) }
                     key={ mapping }>{ mapping }</div>
            )
        } )
    }

    private notAttributedRender = (): ReactNode[] => {
        return this.props.notAssigned.map( mapping => {
            return (
                <div className="deej-options-list-content-item"
                     onDoubleClick={ () => this.props.addToAssigned( this.props.configKey, mapping ) }
                     key={ mapping }>{ mapping }</div>
            )
        } )
    }
}

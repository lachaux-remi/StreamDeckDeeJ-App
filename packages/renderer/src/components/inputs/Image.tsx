import { Component, ComponentProps, ComponentState, ReactNode } from "react"

interface FileProps extends ComponentProps<"input"> {
    name: string
    label: string
    value: string
    updatedValue: (value: string | undefined) => void
}

interface FileState extends ComponentState {
    base64?: string
}

export default class Image extends Component<FileProps, FileState> {
    constructor(props: FileProps) {
        super( props )

        this.state = { base64: this.props.value }
    }

    render(): ReactNode {
        return (
            <div className="input-group input-group-image">
                <input
                    type="file"
                    title=""
                    onChange={ event => {
                        const reader = new FileReader()
                        reader.readAsDataURL( event.target.files![0] )
                        reader.onload = () => {
                            this.setState( { base64: reader.result?.toString()! } )
                            this.props.updatedValue( reader.result?.toString()! )
                        }
                    } }
                />
                { this.renderImage() }
            </div>
        )
    }

    private renderImage = (): ReactNode => {
        if ( this.state.base64 ) {
            return (
                <>
                    <img src={ this.state.base64 } alt="image"/>
                    <div
                        className="input-group-image-remove"
                        onClick={ () => {
                            this.setState( { base64: undefined } )
                            this.props.updatedValue( undefined )
                        } }
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320.591 320.591">
                            <path
                                d="M30.391 318.583a30.37 30.37 0 0 1-21.56-7.288c-11.774-11.844-11.774-30.973 0-42.817L266.643 10.665c12.246-11.459 31.462-10.822 42.921 1.424 10.362 11.074 10.966 28.095 1.414 39.875L51.647 311.295a30.366 30.366 0 0 1-21.256 7.288z"
                                fill="currentColor"/>
                            <path
                                d="M287.9 318.583a30.37 30.37 0 0 1-21.257-8.806L8.83 51.963C-2.078 39.225-.595 20.055 12.143 9.146c11.369-9.736 28.136-9.736 39.504 0l259.331 257.813c12.243 11.462 12.876 30.679 1.414 42.922-.456.487-.927.958-1.414 1.414a30.368 30.368 0 0 1-23.078 7.288z"
                                fill="currentColor"/>
                        </svg>
                    </div>
                </>
            )
        } else {
            return (
                <svg className="input-group-image-placeholder" xmlns="http://www.w3.org/2000/svg" width="120"
                     height="120" viewBox="0 0 32 32">
                    <path fill="currentColor"
                          d="M29 24h-3v-3a1 1 0 0 0-2 0v3h-3a1 1 0 0 0 0 2h3v3a1 1 0 0 0 2 0v-3h3a1 1 0 0 0 0-2zM17 24H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h18a1 1 0 0 1 1 1v12a1 1 0 0 0 2 0V5a3 3 0 0 0-3-3H5a3 3 0 0 0-3 3v18a3 3 0 0 0 3 3h12a1 1 0 0 0 0-2z"/>
                    <circle fill="currentColor" cx="11" cy="8.5" r="2.5"/>
                    <path fill="currentColor"
                          d="M7.29 14.29 6 15.59V22h16v-6.41l-4.29-4.3a1 1 0 0 0-1.42 0L11 16.59l-2.29-2.3a1 1 0 0 0-1.42 0z"/>
                </svg>

            )
        }
    }
}

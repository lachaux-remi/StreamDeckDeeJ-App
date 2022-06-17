import { Component, ComponentProps, ComponentState, ReactNode } from "react"
import classNames from "classnames"

interface SelectProps extends ComponentProps<"select"> {
    name: string
    label: string
    value: string
    values: { key: string; label: string }[]
    updatedValue: (value: string) => void
}

interface SelectState extends ComponentState {
    isOpen: boolean
}

export default class Select extends Component<SelectProps, SelectState> {
    private optionsMenu: HTMLDivElement | null = null

    constructor(props: SelectProps) {
        super( props )

        this.state = { isOpen: false }
    }

    render() {
        return (
            <div
                className={ classNames( "input-group", "input-group-select", { "input-group-select-open": this.state.isOpen } ) }
                onClick={ () => this.setState( { isOpen: !this.state.isOpen } ) }
                ref={ optionsMenu => this.optionsMenu = optionsMenu }>
                <label htmlFor={ this.props.name } className="input-group-label">{ this.props.label }</label>
                <div className="input-group-field">
                    <span>{ this.props.values.find( value => value.key === this.props.value )?.label }</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 444.819 444.819">
                        <path
                            d="m434.252 114.203-21.409-21.416c-7.419-7.04-16.084-10.561-25.975-10.561-10.095 0-18.657 3.521-25.7 10.561L222.41 231.549 83.653 92.791c-7.042-7.04-15.606-10.561-25.697-10.561-9.896 0-18.559 3.521-25.979 10.561l-21.128 21.416C3.615 121.436 0 130.099 0 140.188c0 10.277 3.619 18.842 10.848 25.693l185.864 185.865c6.855 7.23 15.416 10.848 25.697 10.848 10.088 0 18.75-3.617 25.977-10.848l185.865-185.865c7.043-7.044 10.567-15.608 10.567-25.693.001-9.901-3.523-18.559-10.566-25.985z"
                            fill="currentColor"/>
                    </svg>
                    { this.renderOptions() }
                </div>
            </div>
        )
    }

    componentDidMount(): void {
        document.addEventListener( "click", this.closeOptions )
        document.addEventListener( "contextmenu", this.closeOptions )
    }

    componentWillUnmount(): void {
        document.removeEventListener( "click", this.closeOptions )
        document.removeEventListener( "contextmenu", this.closeOptions )
    }

    private closeOptions = (event: MouseEvent): void => {
        if ( event.composedPath().includes( this.optionsMenu! ) ) return
        this.setState( { isOpen: false } )
    }

    private renderOptions = (): ReactNode => {
        if ( this.state.isOpen ) {
            return (
                <ul className="input-group-select-options">
                    { this.props.values.map( value => (
                        <li key={ value.key } className="input-group-select-option"
                            onClick={ () => this.props.updatedValue( value.key ) }>
                            { value.label }
                        </li>
                    ) ) }
                </ul>
            )
        }
        return null
    }
}

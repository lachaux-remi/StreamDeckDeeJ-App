import { Component, ComponentProps } from "react"

interface InputProps extends ComponentProps<"input"> {
    type: "text"
    name: string
    label: string
    value: string
    updatedValue: (value: string) => void
}

export default class Input extends Component<InputProps> {
    render() {
        return (
            <div className="input-group">
                <label htmlFor={ this.props.name } className="input-group-label">{ this.props.label }</label>
                <input
                    type={ this.props.type }
                    id={ this.props.name }
                    name={ this.props.name }
                    defaultValue={ this.props.value }
                    className="input-group-field"
                    onChange={ event => {
                        this.props.updatedValue( event.target.value )
                    } }
                />
            </div>
        )
    }
}

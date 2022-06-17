import { Component, ComponentProps } from "react"

interface TextareaProps extends ComponentProps<"textarea"> {
    name: string
    label: string
    value: string
    updatedValue: (value: string) => void
}

export default class Textarea extends Component<TextareaProps> {
    render() {
        return (
            <div className="input-group">
                <label htmlFor={ this.props.name } className="input-group-label">{ this.props.label }</label>
                <textarea
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


import { Component, ComponentProps } from "react"
import classNames from "classnames"

export type ContextMenuPositionsType = { x: number, y: number }
export type ContextMenuOptionType = { label: string, disabled?: boolean, className?: string, run: () => void }

interface ContextMenuProps extends ComponentProps<"div"> {
    positions: ContextMenuPositionsType
    options: ContextMenuOptionType[]
    onClose: () => void
}

export default class ContextMenu extends Component<ContextMenuProps> {
    private contextMenu: HTMLDivElement | null = null

    constructor(props: ContextMenuProps) {
        super( props )
    }

    render() {
        return (
            <div className="context-menu-options" ref={ contextMenu => this.contextMenu = contextMenu }>
                { this.props.options.filter( option => !option.disabled ).map( (option, i) => (
                    <div className={ classNames( "context-menu-option", option.className ) } key={ i }
                         onClick={ option.run }>
                        { option.label }
                    </div>
                ) ) }
            </div>
        )
    }

    componentDidMount() {
        if ( this.contextMenu ) {
            document.addEventListener( "click", () => this.props.onClose() )
            document.addEventListener( "contextmenu", () => this.props.onClose() )
            
            const { x, y } = this.props.positions
            const positionY = y + this.contextMenu.scrollHeight + 5 >= window.innerHeight
                ? window.innerHeight - this.contextMenu.scrollHeight - 20
                : y
            const positionX = x + this.contextMenu.scrollWidth + 5 >= window.innerWidth
                ? window.innerWidth - this.contextMenu.scrollWidth - 20
                : x

            const style = this.contextMenu.style
            style.top = `${ positionY }px`
            style.left = `${ positionX }px`
        }
    }

    componentWillUnmount() {
        document.removeEventListener( "click", () => this.props.onClose() )
        document.removeEventListener( "contextmenu", () => this.props.onClose() )
    }
}

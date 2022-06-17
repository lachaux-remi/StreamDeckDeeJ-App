import { Component, ComponentProps, ComponentState, CSSProperties, ReactNode } from "react"

interface SliderProps extends ComponentProps<"div"> {
    configKey: string
    mapping: string[]
    volume: number
    onContextMenu: (...args: any) => void
}

interface SliderState extends ComponentState {
    sliderHeight: number,
    knobHeight: number
}

export default class Slider extends Component<SliderProps, SliderState> {
    private slide: HTMLDivElement | null = null
    private knob: HTMLDivElement | null = null

    constructor(props: SliderProps) {
        super( props )

        this.state = { sliderHeight: 0, knobHeight: 0 }
    }

    render(): ReactNode {
        return (
            <div className="deej-slider" title={ `Slider ${ this.props.configKey }` }
                 onContextMenu={ this.props.onContextMenu }>
                { this.renderLabel() }
                { this.renderSlide() }
            </div>
        )
    }

    componentDidMount(): void {
        this.setState( {
            sliderHeight: this.slide?.clientHeight!,
            knobHeight: this.knob?.clientHeight!
        } )
    }

    private renderLabel = (): ReactNode => {
        return ( <div className="deej-slider-label">{ this.props.volume }%</div> )
    }

    private renderSlide = (): ReactNode => {
        return (
            <div className="deej-slider-slide" ref={ slide => this.slide = slide }>
                { this.renderKnob() }
            </div>
        )
    }

    private renderKnob = (): ReactNode => {
        return (
            <div style={ this.knobPosition() }
                 className="deej-slider-slide-knob"
                 ref={ knob => this.knob = knob }>
            </div>
        )
    }

    private knobPosition = (): CSSProperties => {
        return {
            bottom: `calc((${ this.state.sliderHeight }px - ${ this.state.knobHeight }px) / 100 * ${ this.props.volume })`
        }
    }
}

import { Component, ReactNode } from "react"
import Deck from "@/components/deck/Deck"
import Deej from "@/components/deej/Deej"

export default class App extends Component {
    render(): ReactNode {
        return (
            <>
                <Deck/>
                <Deej/>
            </>
        )
    }
}

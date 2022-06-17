import { createRoot } from "react-dom/client"
import App from "@/components/App"

import "./styles/style.css"

createRoot( document.querySelector( "#app" )! )
    .render( <App/> )

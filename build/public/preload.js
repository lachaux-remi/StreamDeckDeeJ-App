const { ipcRenderer } = require( "electron" )

window.onload = () => {
    const sliders = {}
    let sessionList = {}
    let currentShowOptionSlider = null
    const $app = document.getElementById( "app" )
    const $configSlider = document.getElementById( "config-slider" )
    const $configSliderId = $configSlider.querySelector( "[slider-id]" )
    const $assignedList = $configSlider.querySelector( "[list='assigned']" )
    const $notAssignedList = $configSlider.querySelector( "[list='not-assigned']" )

    // Close config and save config
    $configSlider.querySelector( "[action=close]" ).addEventListener( "click", () => {
        $app.classList.add( "show" )
        $configSlider.classList.remove( "show" )

        const sliderMapping = {}
        for ( const sliderKey in sliders ) {
            sliderMapping[sliderKey] = sliders[sliderKey].sessions
        }

        currentShowOptionSlider = null
        ipcRenderer.send( "configUpdate:sliderMapping", sliderMapping )
    } )

    // Reload session list
    $configSlider.querySelector( "[action=reload]" ).addEventListener( "click", () => {
        ipcRenderer.send( "sessionsReload" )
        if ( currentShowOptionSlider ) {
            showOptionSlider( currentShowOptionSlider )
        }
    } )

    document.querySelectorAll( "deej-slider" ).forEach( $slider => {
        // create label percent
        const $sliderValue = document.createElement( "div" )
        $sliderValue.classList.add( "slider-value" )
        $sliderValue.innerHTML = `0%`

        // create slide and cursor
        const $sliderSlide = document.createElement( "div" )
        $sliderSlide.classList.add( "slider-slide" )
        const $sliderSlideCursor = document.createElement( "div" )
        $sliderSlideCursor.classList.add( "slider-slide-cursor" )
        $sliderSlide.appendChild( $sliderSlideCursor )

        // create btn option
        const $sliderOption = document.createElement( "div" )
        $sliderOption.classList.add( "slider-option" )
        $sliderOption.innerHTML = `
            <svg height="25" width="24" xmlns="http://www.w3.org/2000/svg">
                <path d="m23.357 15.63-1.801-1.54a9.9 9.9 0 0 0 0-3.176l1.8-1.54a.882.882 0 0 0 .256-.969l-.024-.071a12.183 12.183 0 0 0-2.192-3.792l-.05-.057a.884.884 0 0 0-.966-.262l-2.236.796a9.614 9.614 0 0 0-2.742-1.583l-.432-2.338a.882.882 0 0 0-.71-.708l-.075-.013a12.408 12.408 0 0 0-4.372 0L9.738.39a.882.882 0 0 0-.71.708l-.435 2.349A9.731 9.731 0 0 0 5.87 5.024l-2.252-.801a.881.881 0 0 0-.967.262l-.05.057a12.278 12.278 0 0 0-2.19 3.792l-.026.071a.884.884 0 0 0 .256.97l1.823 1.555a9.678 9.678 0 0 0-.127 1.57c0 .528.042 1.057.127 1.569L.647 15.624a.882.882 0 0 0-.256.97l.025.071a12.215 12.215 0 0 0 2.191 3.792l.05.057a.884.884 0 0 0 .966.262l2.253-.801a9.535 9.535 0 0 0 2.723 1.577l.435 2.349a.882.882 0 0 0 .71.708l.074.013c1.446.26 2.927.26 4.373 0l.074-.013a.883.883 0 0 0 .71-.708l.433-2.337a9.68 9.68 0 0 0 2.742-1.584l2.236.796a.88.88 0 0 0 .966-.262l.05-.057a12.278 12.278 0 0 0 2.191-3.792l.025-.071a.889.889 0 0 0-.261-.964Zm-11.352 1.437a4.84 4.84 0 1 1-.001-9.68 4.84 4.84 0 0 1 0 9.68Z" fill="currentColor"/>
            </svg>
        `
        $sliderOption.addEventListener( "click", () => {
            showOptionSlider( sliders[$slider.id] )
        } )

        $slider.append( $sliderValue, $sliderSlide, $sliderOption )
        sliders[$slider.id] = { id: $slider.id, label: $sliderValue, cursor: $sliderSlideCursor }

        ipcRenderer.on(
            `sliderChange:${ $slider.id }`,
            /**
             * @param {IpcRendererEvent} _
             * @param {number} value
             */
            (_, value) => {
                updateValue( sliders[$slider.id], value )
            },
        )
    } )

    ipcRenderer.on(
        "sliderValues",
        /**
         * @param {IpcRendererEvent} _
         * @param {{[key: number]: number}} sliderState
         */
        (_, sliderState) => {
            for ( const sliderKey in sliderState ) {
                updateValue( sliders[sliderKey], sliderState[sliderKey] )
            }
        },
    )

    ipcRenderer.on(
        "sessionsChange",
        /**
         * @param {IpcRendererEvent} _
         * @param {[{pid: number, name: string}]} currentSession
         * @param {{[key: number]: []}} sessionConfig
         */
        (_, currentSession, sessionConfig) => {
            for ( const sliderKey in sessionConfig ) sliders[sliderKey].sessions = sessionConfig[sliderKey]
            sessionList = currentSession
                .flatMap( session => session.pid === 0 ? "master" : session.name.toLowerCase() )
                .filter( session => {
                    for ( const sliderKey in sliders ) {
                        if ( sliders[sliderKey].sessions.includes( session ) ) return false
                    }
                    return true
                } )
        },
    )

    /**
     * Update slider value
     * @param {?Object} slider
     * @param {number} sliderValue
     */
    const updateValue = (slider, sliderValue) => {
        if ( slider === undefined ) return

        const value = Math.round( sliderValue * 100 )
        slider.label.innerHTML = `${ value }%`
        slider.cursor.style.bottom = `calc((441px - 12px) / 100 * ${ value })` // (inner slider - cursor height) / 100 * value
    }

    /**
     * Show option slider
     * Update slider value
     * @param {Object} slider
     */
    const showOptionSlider = (slider) => {
        $app.classList.remove( "show" )
        $configSlider.classList.add( "show" )

        currentShowOptionSlider = slider
        $configSliderId.innerHTML = slider.id

        // Update not assigned list
        $notAssignedList.innerHTML = ""
        sessionList.forEach( session => addNotAssignedItem( slider, session ) )

        // Update assigned list
        $assignedList.innerHTML = ""
        if ( typeof slider.sessions === "string" ) slider.sessions = [ slider.sessions ]
        slider.sessions.forEach( session => addAssignedItem( slider, session ) )
    }

    /**
     * Add item to assigned list and add click event
     * @param {Object} slider
     * @param {string} session
     */
    const addAssignedItem = (slider, session) => {
        const $item = itemElement( session )
        $item.addEventListener( "dblclick", () => {
            slider.sessions.splice( slider.sessions.indexOf( session ), 1 )
            $item.remove()
            sessionList.push( session )
            // reload all html
            showOptionSlider( slider )
        }, { once: true } )
        $assignedList.appendChild( $item )
    }

    /**
     * Add item to not assigned list and add click event
     * @param {Object} slider
     * @param {string} session
     */
    const addNotAssignedItem = (slider, session) => {
        const $item = itemElement( session )
        $item.addEventListener( "dblclick", () => {
            sessionList.splice( sessionList.indexOf( session ), 1 )
            $item.remove()
            slider.sessions.push( session )
            // reload all html
            showOptionSlider( slider )
        }, { once: true } )
        $notAssignedList.appendChild( $item )
    }

    /**
     * Create new item for the list
     * @param session
     * @returns {HTMLDivElement}
     */
    const itemElement = (session) => {
        const $item = document.createElement( "div" )
        $item.classList.add( "config-body-list-content-item" )
        $item.innerHTML = session

        return $item
    }
}
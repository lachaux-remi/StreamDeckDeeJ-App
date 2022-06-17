export const throttle = (callback: (...args: any[]) => void, wait: number, leading: boolean, trailing: boolean, context: any): () => void => {
    let args: any
    let timeout: NodeJS.Timeout | null = null
    let previous: Date | null = null

    const later = function () {
        previous = new Date
        timeout = null
        callback.apply( context, args )
    }

    return function () {
        const now = new Date
        if ( !previous && !leading ) previous = now

        const remaining = wait - ( now.getTime() - previous?.getTime()! )

        // eslint-disable-next-line prefer-rest-params
        args = arguments

        if ( remaining <= 0 ) {
            clearTimeout( timeout! )
            timeout = null
            previous = now
            callback.apply( context, args )
        } else if ( !timeout && trailing ) {
            timeout = setTimeout( later, remaining )
        }
    }
}

const PADDING = [ [ 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16 ], [ 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15 ], [ 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14, 14 ], [ 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13 ], [ 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12, 12 ], [ 11, 11, 11, 11, 11, 11, 11, 11, 11, 11, 11 ], [ 10, 10, 10, 10, 10, 10, 10, 10, 10, 10 ], [ 9, 9, 9, 9, 9, 9, 9, 9, 9 ], [ 8, 8, 8, 8, 8, 8, 8, 8 ], [ 7, 7, 7, 7, 7, 7, 7 ], [ 6, 6, 6, 6, 6, 6 ], [ 5, 5, 5, 5, 5 ], [ 4, 4, 4, 4 ], [ 3, 3, 3 ], [ 2, 2 ], [ 1 ] ]

export const pad = (plaintext: Uint8Array): Uint8Array => {
    const padding = PADDING[plaintext.byteLength % 16 || 0]
    const result = new Uint8Array( plaintext.byteLength + padding.length )
    result.set( plaintext )
    result.set( padding, plaintext.byteLength )
    return result
}

export const range = (start: number, stop: number) => Array.from( { length: stop - start + 1 }, (_, i) => start + i )

export const isEmpty = (obj: object): boolean => {
    return Object.keys( obj ).length === 0
}

export const nextTick = (callback: () => void): void => {
    setTimeout( callback, 0 )
}

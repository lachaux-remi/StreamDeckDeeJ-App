import { net, protocol } from 'electron'
import { isAbsolute, relative, resolve, sep } from 'path'
import { pathToFileURL } from 'url'

export const RENDERER_URL = 'streamdeck-deej://renderer/index.html'

export function registerRendererProtocol(rendererRoot: string): void {
  protocol.handle('streamdeck-deej', (request) => {
    const url = new URL(request.url)
    if (url.hostname !== 'renderer' || url.port || !['GET', 'HEAD'].includes(request.method)) {
      return new Response('Not found', { status: 404 })
    }

    let pathname: string
    try {
      pathname = decodeURIComponent(url.pathname)
    } catch {
      return new Response('Bad request', { status: 400 })
    }

    const pathToServe = resolve(rendererRoot, `.${pathname}`)
    const relativePath = relative(rendererRoot, pathToServe)
    const isSafe =
      relativePath !== '..' && !relativePath.startsWith(`..${sep}`) && !isAbsolute(relativePath)

    if (!isSafe) {
      return new Response('Bad request', { status: 400 })
    }

    return net.fetch(pathToFileURL(pathToServe).toString(), { method: request.method })
  })
}

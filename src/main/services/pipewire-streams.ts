interface PwDumpObject {
  id: number
  type: string
  info?: {
    props?: Record<string, unknown>
    params?: {
      Props?: Array<{
        channelVolumes?: number[]
        volume?: number
      }>
    }
  }
}

export interface PipeWireOutputStream {
  pwNodeId: number
  name: string
  volume: number
  /** Process ID from the stream node, or from its client for PipeWire-native apps. */
  pid?: string
}

function stringProp(props: Record<string, unknown> | undefined, key: string): string | undefined {
  const value = props?.[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function pidProp(props: Record<string, unknown> | undefined): string | undefined {
  const value = props?.['application.process.id']
  return (typeof value === 'string' || typeof value === 'number') && String(value) !== ''
    ? String(value)
    : undefined
}

/**
 * Lists audio output streams from `pw-dump` JSON. Application names are
 * resolved through the client.id → client object lookup, which is required
 * for PipeWire-native apps (e.g. Spotify) whose stream node does NOT carry
 * application.name itself.
 */
export function parsePipeWireOutputStreams(raw: string): PipeWireOutputStream[] {
  const objects: PwDumpObject[] = JSON.parse(raw)

  const clientMap = new Map<number, Record<string, unknown>>()
  for (const obj of objects) {
    if (obj.type === 'PipeWire:Interface:Client' && obj.info?.props) {
      clientMap.set(obj.id, obj.info.props)
    }
  }

  const streams: PipeWireOutputStream[] = []
  for (const obj of objects) {
    const props = obj.info?.props
    if (!props || obj.type !== 'PipeWire:Interface:Node') {
      continue
    }
    if (props['media.class'] !== 'Stream/Output/Audio') {
      continue
    }

    const clientId = props['client.id']
    const clientProps = typeof clientId === 'number' ? clientMap.get(clientId) : undefined
    const name =
      stringProp(props, 'application.name') ??
      (clientProps
        ? (stringProp(clientProps, 'application.name') ??
          stringProp(clientProps, 'application.process.binary'))
        : undefined) ??
      stringProp(props, 'application.process.binary') ??
      stringProp(props, 'node.name')
    if (!name) {
      continue
    }

    const paramsProps = obj.info?.params?.Props
    let volume = 0
    if (paramsProps && paramsProps.length > 0) {
      const p = paramsProps[0]
      if (p.channelVolumes && p.channelVolumes.length > 0) {
        volume = Math.max(...p.channelVolumes)
      } else if (p.volume !== undefined) {
        volume = p.volume
      }
    }

    streams.push({ pwNodeId: obj.id, name, volume, pid: pidProp(props) ?? pidProp(clientProps) })
  }
  return streams
}

/** Finds the node ID of the capture stream created with the given node.name. */
export function findPipeWireNodeByName(raw: string, nodeName: string): number | undefined {
  const objects: PwDumpObject[] = JSON.parse(raw)
  return objects.find(
    (obj) => obj.type === 'PipeWire:Interface:Node' && obj.info?.props?.['node.name'] === nodeName
  )?.id
}

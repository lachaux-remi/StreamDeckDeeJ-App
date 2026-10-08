import { expect, test } from 'vitest'
import { findPipeWireNodeByName, parsePipeWireOutputStreams } from '@main/services/pipewire-streams'

const dump = JSON.stringify([
  {
    id: 7,
    type: 'PipeWire:Interface:Client',
    info: { props: { 'application.name': 'Spotify', 'application.process.id': 4242 } }
  },
  {
    id: 8,
    type: 'PipeWire:Interface:Client',
    info: { props: { 'application.process.binary': 'mpv' } }
  },
  {
    id: 77,
    type: 'PipeWire:Interface:Node',
    info: {
      props: { 'media.class': 'Stream/Output/Audio', 'client.id': 7 },
      params: { Props: [{ channelVolumes: [0.25, 0.5] }] }
    }
  },
  {
    id: 78,
    type: 'PipeWire:Interface:Node',
    info: {
      props: {
        'media.class': 'Stream/Output/Audio',
        'application.name': 'Firefox',
        'application.process.id': '3368'
      }
    }
  },
  {
    id: 79,
    type: 'PipeWire:Interface:Node',
    info: { props: { 'media.class': 'Stream/Output/Audio', 'client.id': 8 } }
  },
  {
    id: 80,
    type: 'PipeWire:Interface:Node',
    info: { props: { 'media.class': 'Stream/Output/Audio' } }
  },
  {
    id: 90,
    type: 'PipeWire:Interface:Node',
    info: { props: { 'media.class': 'Stream/Input/Audio', 'node.name': 'streamdeck-deej-meter-1' } }
  },
  {
    id: 91,
    type: 'PipeWire:Interface:Port',
    info: { props: { 'node.name': 'streamdeck-deej-meter-2' } }
  }
])

test('resolves output stream names and process IDs through their client', () => {
  expect(parsePipeWireOutputStreams(dump)).toEqual([
    { pwNodeId: 77, name: 'Spotify', volume: 0.5, pid: '4242' },
    { pwNodeId: 78, name: 'Firefox', volume: 0, pid: '3368' },
    { pwNodeId: 79, name: 'mpv', volume: 0, pid: undefined }
  ])
})

test('finds a capture node by its unique node.name only', () => {
  expect(findPipeWireNodeByName(dump, 'streamdeck-deej-meter-1')).toBe(90)
  expect(findPipeWireNodeByName(dump, 'streamdeck-deej-meter-2')).toBeUndefined()
  expect(findPipeWireNodeByName(dump, 'missing')).toBeUndefined()
})

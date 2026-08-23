import { afterEach, expect, test, vi } from 'vitest'
import HomeAssistantAPI from '@main/libs/home-assistant/HomeAssistantAPI'

afterEach(() => {
  vi.unstubAllGlobals()
})

test('encodes state identifiers and keeps authentication secrets out of HTTP errors', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ state: 'on', attributes: { brightness: 42 } }), {
        status: 200
      })
    )
    .mockResolvedValueOnce(new Response('', { status: 503, statusText: 'Unavailable' }))
  vi.stubGlobal('fetch', fetch)
  const api = new HomeAssistantAPI('https://ha.example', 'fixture-secret-token')

  await expect(api.getState('light.kitchen/lamp')).resolves.toEqual({
    state: 'on',
    attributes: { brightness: 42 }
  })
  const error = await api.getState('light.offline').catch((caught: unknown) => caught)
  expect(String(error)).toContain('Home Assistant state error: 503 Unavailable')

  expect(fetch).toHaveBeenNthCalledWith(
    1,
    'https://ha.example/api/states/light.kitchen%2Flamp',
    expect.objectContaining({ headers: { Authorization: 'Bearer fixture-secret-token' } })
  )
  expect(String(error)).not.toContain('fixture-secret-token')
})

test('posts to the split service path without allowing extra data to replace the target entity', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify([{ entity_id: 'light.kitchen', state: 'on' }]), { status: 200 })
    )
  vi.stubGlobal('fetch', fetch)
  const api = new HomeAssistantAPI('https://ha.example', 'token')

  await expect(
    api.callService('light.turn_on', 'light.kitchen', {
      brightness_pct: 80,
      entity_id: 'light.untrusted'
    })
  ).resolves.toEqual([{ entity_id: 'light.kitchen', state: 'on' }])

  expect(fetch).toHaveBeenCalledWith(
    'https://ha.example/api/services/light/turn_on',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ brightness_pct: 80, entity_id: 'light.kitchen' })
    })
  )
})

test('rejects malformed service names, handles empty success bodies, and reports HTTP failures', async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 200 }))
    .mockResolvedValueOnce(new Response('', { status: 400, statusText: 'Bad Request' }))
  vi.stubGlobal('fetch', fetch)
  const api = new HomeAssistantAPI('https://ha.example', 'token')

  await expect(api.callService('turn_on', 'light.kitchen')).rejects.toThrow(
    'Expected "domain.service"'
  )
  await expect(api.callService('light.turn_off', 'light.kitchen')).resolves.toEqual([])
  await expect(api.callService('light.turn_on', 'light.kitchen')).rejects.toThrow(
    'Home Assistant API error: 400 Bad Request'
  )
})

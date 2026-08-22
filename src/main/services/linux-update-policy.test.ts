import { expect, test } from 'vitest'
import {
  configureSecureAppImageUpdater,
  OFFICIAL_GITHUB_RELEASE_API,
  OFFICIAL_GITHUB_RELEASE_PAGE
} from './linux-update-policy'

test('hardcodes the official HTTPS GitHub release endpoints', () => {
  expect(OFFICIAL_GITHUB_RELEASE_API).toBe(
    'https://api.github.com/repos/lachaux-remi/StreamDeckDeeJ-App/releases/latest'
  )
  expect(OFFICIAL_GITHUB_RELEASE_PAGE).toBe(
    'https://github.com/lachaux-remi/StreamDeckDeeJ-App/releases/latest'
  )
})

test('configures AppImage updates without automatic download, install, downgrade, or token', () => {
  const feedConfigurations: unknown[] = []
  const target = {
    autoDownload: true,
    autoInstallOnAppQuit: true,
    allowDowngrade: true,
    allowPrerelease: true,
    fullChangelog: true,
    setFeedURL: (configuration: unknown): void => void feedConfigurations.push(configuration)
  }

  configureSecureAppImageUpdater(target)

  expect(target).toEqual({
    autoDownload: false,
    autoInstallOnAppQuit: false,
    allowDowngrade: false,
    allowPrerelease: false,
    fullChangelog: false,
    setFeedURL: target.setFeedURL
  })
  expect(feedConfigurations).toEqual([
    {
      provider: 'github',
      owner: 'lachaux-remi',
      repo: 'StreamDeckDeeJ-App',
      private: false
    }
  ])
  expect('token' in (feedConfigurations[0] as Record<string, unknown>)).toBe(false)
})

export const OFFICIAL_GITHUB_RELEASE_API =
  'https://api.github.com/repos/lachaux-remi/StreamDeckDeeJ-App/releases/latest'
export const OFFICIAL_GITHUB_RELEASE_PAGE =
  'https://github.com/lachaux-remi/StreamDeckDeeJ-App/releases/latest'

interface UpdaterPolicyTarget {
  autoDownload: boolean
  autoInstallOnAppQuit: boolean
  allowDowngrade: boolean
  allowPrerelease: boolean
  fullChangelog: boolean
  setFeedURL(configuration: {
    provider: 'github'
    owner: string
    repo: string
    private: false
  }): void
}

export function configureSecureUpdater(target: UpdaterPolicyTarget): void {
  target.autoDownload = false
  target.autoInstallOnAppQuit = false
  target.allowDowngrade = false
  target.allowPrerelease = false
  target.fullChangelog = false
  target.setFeedURL({
    provider: 'github',
    owner: 'lachaux-remi',
    repo: 'StreamDeckDeeJ-App',
    private: false
  })
}

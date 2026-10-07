export const AUR_PACKAGE_NAME: string

export interface PackageInfo {
  depends: string[]
  [key: string]: string | string[]
}

export function parsePackageInfo(text: string): PackageInfo

export function renderPkgbuild(options: {
  version: string
  description: string
  depends: string[]
  packageSha256: string
  licenseSha256: string
}): string

export function renderInstallScript(officialInstall: string): string

export function prepareAurPackage(
  packagePath: string,
  version: string,
  licensePath: string,
  outputDirectory: string
): Promise<void>

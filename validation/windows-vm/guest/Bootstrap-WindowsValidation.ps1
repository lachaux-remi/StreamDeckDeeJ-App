[CmdletBinding()]
param(
    [ValidateSet('Community', 'BuildTools')]
    [string]$VisualStudioEdition = 'Community',
    [string]$PnpmVersion = '11.22.0'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Assert-Administrator {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = [Security.Principal.WindowsPrincipal]::new($identity)
    if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Run this bootstrap from an elevated PowerShell window.'
    }
}

function Invoke-WingetInstall {
    param(
        [Parameter(Mandatory)]
        [string]$Id,
        [string[]]$ExtraArguments = @()
    )

    & winget install --exact --id $Id --accept-package-agreements --accept-source-agreements @ExtraArguments
    if ($LASTEXITCODE -ne 0) {
        throw "winget failed for $Id with exit code $LASTEXITCODE"
    }
}

Assert-Administrator

if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
    throw 'winget is required. Update App Installer from Microsoft Store, then run this script again.'
}

$vsId = if ($VisualStudioEdition -eq 'Community') {
    'Microsoft.VisualStudio.2022.Community'
} else {
    'Microsoft.VisualStudio.2022.BuildTools'
}
$workload = if ($VisualStudioEdition -eq 'Community') {
    'Microsoft.VisualStudio.Workload.NativeDesktop'
} else {
    'Microsoft.VisualStudio.Workload.VCTools'
}
$override = "--wait --passive --norestart --add $workload --includeRecommended"

Invoke-WingetInstall -Id $vsId -ExtraArguments @('--override', $override)
Invoke-WingetInstall -Id 'OpenJS.NodeJS.LTS'

$machinePath = [Environment]::GetEnvironmentVariable('Path', 'Machine')
$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
$env:Path = "$machinePath;$userPath"

$nodeVersion = (& node --version).Trim()
if ($nodeVersion -notmatch '^v24\.') {
    throw "Node.js 24 is required, but winget installed $nodeVersion. Install an official Node.js 24 x64 MSI and rerun."
}

& npm install --global "pnpm@$PnpmVersion"
if ($LASTEXITCODE -ne 0) {
    throw "npm failed to install pnpm $PnpmVersion"
}

$actualPnpmVersion = (& pnpm --version).Trim()
if ($actualPnpmVersion -ne $PnpmVersion) {
    throw "pnpm $PnpmVersion is required, but $actualPnpmVersion is active"
}

$vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
if (-not (Test-Path $vswhere)) {
    throw "Visual Studio Installer did not provide vswhere.exe at $vswhere"
}
$installationPath = (& $vswhere -latest -products '*' -requires $workload -property installationPath).Trim()
if (-not $installationPath) {
    throw "Visual Studio workload $workload was not detected"
}

$windowsSdkInclude = Join-Path ${env:ProgramFiles(x86)} 'Windows Kits\10\Include'
if (-not (Test-Path $windowsSdkInclude)) {
    throw 'Windows SDK headers were not detected under Windows Kits\10\Include'
}

[pscustomobject]@{
    VisualStudioEdition = $VisualStudioEdition
    VisualStudioPath = $installationPath
    Workload = $workload
    WindowsSdkInclude = $windowsSdkInclude
    Node = $nodeVersion
    Pnpm = $actualPnpmVersion
} | Format-List

Write-Host 'Bootstrap complete. Reboot Windows, then use a non-elevated PowerShell for validation.' -ForegroundColor Green

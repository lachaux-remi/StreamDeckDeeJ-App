[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9._-]*$')]
    [string]$Phase,
    [string]$EvidenceRoot = (Join-Path $PSScriptRoot '..\evidence'),
    [string]$NMinusOneInstaller,
    [string]$NInstaller,
    [string]$NReleaseAssetsDirectory
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$outputDirectory = Join-Path $EvidenceRoot "$timestamp-$Phase"
New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null

function Get-OptionalCommandOutput {
    param([scriptblock]$Command)
    try {
        & $Command 2>&1 | Out-String
    } catch {
        "UNAVAILABLE: $($_.Exception.Message)"
    }
}

function Get-InstallerEvidence {
    param([string]$Path)
    if (-not $Path) {
        return $null
    }
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return [pscustomobject]@{ Path = $Path; Status = 'missing' }
    }
    $item = Get-Item -LiteralPath $Path
    $signature = Get-AuthenticodeSignature -LiteralPath $Path
    [pscustomobject]@{
        Path = $item.FullName
        Status = 'present'
        Length = $item.Length
        Sha512 = (Get-FileHash -LiteralPath $Path -Algorithm SHA512).Hash
        ProductVersion = $item.VersionInfo.ProductVersion
        SignatureStatus = [string]$signature.Status
        SignerSubject = if ($signature.SignerCertificate) { $signature.SignerCertificate.Subject } else { $null }
        AuthenticodePolicy = 'intentionally-unsigned; expected status is NotSigned'
    }
}

function Get-ReleaseAssetEvidence {
    param([string]$Directory)
    if (-not $Directory) {
        return $null
    }
    if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
        return [pscustomobject]@{ Directory = $Directory; Status = 'missing'; Assets = @() }
    }

    $assets = Get-ChildItem -LiteralPath $Directory -File |
        Where-Object {
            $_.Name -in @('latest.yml', 'update-manifest-v1.json', 'update-manifest-v1.sig') -or
                $_.Name -match '^streamdeck-deej-[0-9]+\.[0-9]+\.[0-9]+-windows-x64\.exe(?:\.blockmap)?$'
        } |
        Sort-Object Name |
        ForEach-Object {
            [pscustomobject]@{
                Name = $_.Name
                Length = $_.Length
                Sha512 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA512).Hash
            }
        }

    return [pscustomobject]@{
        Directory = (Get-Item -LiteralPath $Directory).FullName
        Status = if (@($assets).Count -eq 5) { 'complete-five-asset-set' } else { 'incomplete' }
        Assets = @($assets)
    }
}

$usbPattern = 'VID_5239&PID_0001'
$pnpDevices = Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
    Where-Object { $_.InstanceId -like "*$usbPattern*" } |
    Select-Object Status, Class, FriendlyName, InstanceId
$serialPorts = Get-CimInstance Win32_SerialPort -ErrorAction SilentlyContinue |
    Where-Object { $_.PNPDeviceID -like "*$usbPattern*" } |
    Select-Object DeviceID, Name, Description, PNPDeviceID
$audioDevices = Get-CimInstance Win32_SoundDevice -ErrorAction SilentlyContinue |
    Select-Object Status, Name, Manufacturer, PNPDeviceID
$processes = Get-Process -Name 'streamdeck-deej' -ErrorAction SilentlyContinue |
    Select-Object Id, ProcessName, Path, StartTime

$uninstallRoots = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
)
$uninstallEntries = foreach ($root in $uninstallRoots) {
    Get-ItemProperty $root -ErrorAction SilentlyContinue |
        Where-Object { $_.DisplayName -like '*streamdeck-deej*' } |
        Select-Object DisplayName, DisplayVersion, InstallLocation, UninstallString, PSPath
}

$runKeys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\StartupApproved\Run'
)
$autostart = foreach ($key in $runKeys) {
    if (Test-Path $key) {
        [pscustomobject]@{ Key = $key; Values = (Get-ItemProperty $key | Select-Object * -ExcludeProperty PS*) }
    }
}

$secureBoot = Get-OptionalCommandOutput { Confirm-SecureBootUEFI }
$tpm = Get-OptionalCommandOutput { Get-Tpm | Format-List * }
$powerStates = Get-OptionalCommandOutput { powercfg /a }

$report = [ordered]@{
    SchemaVersion = 1
    Phase = $Phase
    CollectedAt = (Get-Date).ToString('o')
    Computer = [ordered]@{
        Name = $env:COMPUTERNAME
        User = [Security.Principal.WindowsIdentity]::GetCurrent().Name
        Os = Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, BuildNumber, OSArchitecture, LastBootUpTime
        SecureBoot = $secureBoot.Trim()
        Tpm = $tpm.Trim()
        PowerStates = $powerStates.Trim()
    }
    Toolchain = [ordered]@{
        Node = Get-OptionalCommandOutput { node --version }
        Pnpm = Get-OptionalCommandOutput { pnpm --version }
    }
    Artifacts = @(
        @(
            Get-InstallerEvidence -Path $NMinusOneInstaller
            Get-InstallerEvidence -Path $NInstaller
        ) | Where-Object { $null -ne $_ }
    )
    ReleaseAssets = Get-ReleaseAssetEvidence -Directory $NReleaseAssetsDirectory
    Hardware = [ordered]@{
        UsbComposite = @($pnpDevices)
        SerialPorts = @($serialPorts)
        AudioDevices = @($audioDevices)
    }
    Application = [ordered]@{
        Processes = @($processes)
        UninstallEntries = @($uninstallEntries)
        Autostart = @($autostart)
    }
}

$jsonPath = Join-Path $outputDirectory 'report.json'
$report | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $jsonPath -Encoding UTF8
New-Item -ItemType File -Path (Join-Path $outputDirectory 'notes.txt') -Force | Out-Null

Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue |
    Sort-Object Class, FriendlyName |
    Format-Table Status, Class, FriendlyName, InstanceId -AutoSize |
    Out-String -Width 4096 |
    Set-Content -LiteralPath (Join-Path $outputDirectory 'pnp-devices.txt') -Encoding UTF8

Write-Host "Evidence collected: $outputDirectory" -ForegroundColor Green
Write-Host "Add human observations to: $(Join-Path $outputDirectory 'notes.txt')"

[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [ValidatePattern('^COM\d+$')]
    [string]$Port,
    [ValidateRange(5, 300)]
    [int]$DurationSeconds = 30,
    [string]$OutputPath = (Join-Path $PSScriptRoot "..\evidence\serial-$(Get-Date -Format 'yyyyMMdd-HHmmss').jsonl")
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$serial = [System.IO.Ports.SerialPort]::new($Port, 115200, 'None', 8, 'One')
$serial.NewLine = "`r`n"
$serial.ReadTimeout = 1000
$serial.WriteTimeout = 1000
$deadline = (Get-Date).AddSeconds($DurationSeconds)
$validFrames = 0
$invalidFrames = 0

function Test-ProtocolMessage {
    param([object]$Message)

    if ($Message.type -eq 'deck') {
        return ($Message.state -in @('pressed', 'hold', 'released')) -and
            ($Message.value -is [int] -or $Message.value -is [long]) -and
            $Message.value -ge 0 -and $Message.value -le 63
    }
    if ($Message.type -eq 'deej' -and $null -ne $Message.value) {
        $properties = @($Message.value.PSObject.Properties)
        if ($properties.Count -lt 1 -or $properties.Count -gt 16) {
            return $false
        }
        foreach ($property in $properties) {
            if ($property.Name -notmatch '^(0|[1-9]\d*)$') { return $false }
            $index = [int]$property.Name
            if ($index -gt 15) { return $false }
            if ($property.Value -isnot [int] -and $property.Value -isnot [long]) { return $false }
            if ($property.Value -lt 0 -or $property.Value -gt 1023) { return $false }
        }
        return $true
    }
    return $false
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

try {
    $serial.Open()
    $serial.Write("app:ready`r`n")
    Write-Host "Reading $Port for $DurationSeconds seconds. Move sliders and press/hold/release buttons."

    while ((Get-Date) -lt $deadline) {
        try {
            $line = $serial.ReadLine()
        } catch [System.TimeoutException] {
            continue
        }

        $byteLength = [Text.Encoding]::UTF8.GetByteCount($line)
        $entry = [ordered]@{ At = (Get-Date).ToString('o'); Raw = $line; Valid = $false; Reason = $null }
        if ($byteLength -gt 512) {
            $entry.Reason = 'frame too large'
            $invalidFrames++
        } else {
            try {
                $message = $line | ConvertFrom-Json
                if (Test-ProtocolMessage -Message $message) {
                    $entry.Valid = $true
                    $validFrames++
                } else {
                    $entry.Reason = 'invalid message shape or type'
                    $invalidFrames++
                }
            } catch {
                $entry.Reason = 'invalid JSON'
                $invalidFrames++
            }
        }
        $entry | ConvertTo-Json -Compress | Add-Content -LiteralPath $OutputPath -Encoding UTF8
    }
} finally {
    if ($serial.IsOpen) {
        $serial.Close()
    }
    $serial.Dispose()
}

Write-Host "Valid frames: $validFrames; invalid frames: $invalidFrames; log: $OutputPath"
if ($validFrames -eq 0) {
    throw 'No valid firmware frame was observed.'
}
if ($invalidFrames -gt 0) {
    throw "$invalidFrames invalid frame(s) were observed."
}

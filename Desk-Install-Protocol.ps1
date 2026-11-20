$ErrorActionPreference = 'Stop'
$uri = [string]$args[0]
if ($uri -notmatch '^fbdesk-install://install/([a-p]{32})/?$') {
    throw 'Invalid Facebook Desk installer link.'
}
$extensionId = $Matches[1]
$root = $PSScriptRoot
& (Join-Path $root 'Install-Start-Video.ps1') -ExtensionIds $extensionId
$launcher = Join-Path $root 'Start-Media-Background.ps1'
if (!(Test-Path -LiteralPath $launcher)) { throw 'Missing Media Bridge launcher.' }
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
$start = New-Object System.Diagnostics.ProcessStartInfo
$start.FileName = $powershell
$start.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "' + $launcher + '"'
$start.WorkingDirectory = $root
$start.UseShellExecute = $true
$start.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
[System.Diagnostics.Process]::Start($start) | Out-Null

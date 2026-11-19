$ErrorActionPreference = 'Stop'
$logDirectory = Join-Path $env:LOCALAPPDATA 'FacebookDeskMedia'
[IO.Directory]::CreateDirectory($logDirectory) | Out-Null
$logPath = Join-Path $logDirectory 'start-video.log'
$mutex = New-Object Threading.Mutex($false, 'Local\FacebookDeskMediaBackground')
$owned = $false
try {
    try { $owned = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $owned = $true }
    if (!$owned) { exit 0 }
    "$(Get-Date -Format o) Start Video: $PSScriptRoot" | Set-Content -LiteralPath $logPath -Encoding UTF8
    $client = New-Object Net.Sockets.TcpClient
    try { $connected = $client.ConnectAsync('127.0.0.1',47833).Wait(1500); $occupied = $connected -and $client.Connected } catch { $occupied = $false } finally { $client.Dispose() }
    if ($occupied) { 'Port 47833 is already in use. No second bridge was started. If pairing fails, close the old Media Bridge and retry.' | Add-Content -LiteralPath $logPath; exit 0 }
    # The native host writes valid IDs before launching. Never prompt invisibly.
    $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'media-bridge-config.json') -Raw | ConvertFrom-Json
    if (!$config.extensionIds.Count) { throw 'Missing Extension ID. Run Install-Start-Video.cmd.' }
    & (Join-Path $PSScriptRoot 'Start-Media.ps1') *> $logPath
    if ($LASTEXITCODE -ne 0) { throw "Media Bridge exited with code $LASTEXITCODE" }
} catch { $_ | Out-String | Add-Content -LiteralPath $logPath -Encoding UTF8; exit 1 }
finally { if ($owned) { $mutex.ReleaseMutex() }; $mutex.Dispose() }

$ErrorActionPreference = 'Stop'
$configPath = Join-Path $PSScriptRoot 'media-bridge-config.json'
$extensionIds = @()
if (Test-Path -LiteralPath $configPath) { $extensionIds = @((Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json).extensionIds) }
if (!$extensionIds.Count) {
    $extensionText = Read-Host 'Paste Facebook Desk extension ID from chrome://extensions (comma separated for multiple profiles)'
    $extensionIds = @($extensionText.Split(',') | ForEach-Object { $_.Trim() })
}
if (!$extensionIds.Count -or @($extensionIds | Where-Object { $_ -notmatch '^[a-p]{32}$' }).Count) { throw 'Invalid extension ID.' }
# Existing IDs are updated atomically by the native host. Do not overwrite
# another profile's pairing while this process is starting.
if (!(Test-Path -LiteralPath $configPath)) { @{ extensionIds = $extensionIds } | ConvertTo-Json | Set-Content -LiteralPath $configPath -Encoding UTF8 }
$environmentPath = Join-Path $env:LOCALAPPDATA 'PostResearch\video-env'
$pythonPath = Join-Path $environmentPath 'Scripts\python.exe'
if (!(Test-Path -LiteralPath $pythonPath)) {
    $pythonCandidates = @(
        (Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe'),
        (Join-Path $PSScriptRoot 'python\python.exe')
    )
    foreach ($commandName in @('python', 'python3', 'py')) {
        $pythonCandidates += @(Get-Command $commandName -CommandType Application -ErrorAction SilentlyContinue | Where-Object { $_.Source -notlike '*\Microsoft\WindowsApps\*' } | Select-Object -ExpandProperty Source)
    }
    $bootstrapPython = $null
    foreach ($candidatePath in ($pythonCandidates | Select-Object -Unique)) {
        if (!(Test-Path -LiteralPath $candidatePath)) { continue }
        try {
            $resolvedPython = & $candidatePath -c 'import sys;print(sys.executable)' 2>$null
            if ($LASTEXITCODE -eq 0 -and $resolvedPython -and (Test-Path -LiteralPath ([string]$resolvedPython))) {
                $bootstrapPython = [string]$resolvedPython
                break
            }
        } catch { continue }
    }
    if (!$bootstrapPython) { throw 'Python 3 was not found. Install Python 3, then run this launcher again.' }
    Write-Host "Using Python: $bootstrapPython"
    & $bootstrapPython -m venv $environmentPath
    if ($LASTEXITCODE -ne 0) { throw 'Install Python 3, then run this launcher again.' }
}
& $pythonPath -c 'import importlib.util,sys;sys.exit(not all(map(importlib.util.find_spec,sys.argv[1:])))' yt_dlp imageio_ffmpeg
if ($LASTEXITCODE -ne 0) {
    & $pythonPath -m pip install yt-dlp imageio-ffmpeg
    if ($LASTEXITCODE -ne 0) { throw 'Could not install video dependencies.' }
}
$bridgeArguments = @((Join-Path $PSScriptRoot 'media-bridge.py'))
foreach ($extensionId in $extensionIds) { $bridgeArguments += @('--allow-extension', $extensionId) }
& $pythonPath @bridgeArguments

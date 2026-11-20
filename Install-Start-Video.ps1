param([string]$ExtensionIds)
$ErrorActionPreference = 'Stop'
if (!$ExtensionIds) {
    $idsFound = foreach ($profile in Get-ChildItem -LiteralPath (Join-Path $env:LOCALAPPDATA 'Google\Chrome\User Data') -Directory -ErrorAction SilentlyContinue) {
        foreach ($file in 'Secure Preferences','Preferences') {
            $prefs = Join-Path $profile.FullName $file
            if (!(Test-Path -LiteralPath $prefs)) { continue }
            try { $settings = (Get-Content -LiteralPath $prefs -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop).extensions.settings } catch { continue }
            if (!$settings) { continue }
            foreach ($entry in $settings.PSObject.Properties) {
                if ($entry.Name -cmatch '^[a-p]{32}$' -and $entry.Value.path -ieq $PSScriptRoot) { $entry.Name }
            }
        }
    }
    $ExtensionIds = (@($idsFound | Sort-Object -Unique) -join ',')
    if (!$ExtensionIds) { $ExtensionIds = Read-Host 'Paste Extension ID from FB Desk settings' }
}
$ids = @($ExtensionIds.Split(',') | ForEach-Object { $_.Trim() } | Select-Object -Unique)
if (!$ids.Count -or @($ids | Where-Object { $_ -notmatch '^[a-p]{32}$' }).Count) { throw 'Invalid Extension ID: use the ID displayed in FB Desk settings.' }
$configPath = Join-Path $PSScriptRoot 'media-bridge-config.json'
if (Test-Path -LiteralPath $configPath) { $ids += @((Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json).extensionIds) }
$hostPath = Join-Path $PSScriptRoot 'media-native-host.json'
if (Test-Path -LiteralPath $hostPath) { $ids += @((Get-Content -LiteralPath $hostPath -Raw | ConvertFrom-Json).allowed_origins | ForEach-Object { $_ -replace '^chrome-extension://','' -replace '/$','' }) }
$registration = Get-Item 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.facebookdesk.media' -ErrorAction SilentlyContinue
if ($registration) {
    $registeredPath = $registration.GetValue('')
    if ($registeredPath -and (Test-Path -LiteralPath $registeredPath -PathType Leaf)) {
        $registered = Get-Content -LiteralPath $registeredPath -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($registered.name -eq 'com.facebookdesk.media') {
            $ids += @($registered.allowed_origins | ForEach-Object { if ($_ -cmatch '^chrome-extension://([a-p]{32})/$') { $Matches[1] } })
        }
    }
}
$ids = @($ids | Where-Object { $_ -match '^[a-p]{32}$' } | Select-Object -Unique)
$executablePath = Join-Path $PSScriptRoot 'MediaNativeHost.exe'
if (!(Test-Path -LiteralPath $executablePath)) {
    Add-Type -Path (Join-Path $PSScriptRoot 'MediaNativeHost.cs') -ReferencedAssemblies 'System.dll','System.Core.dll','System.Web.Extensions.dll' -OutputAssembly $executablePath -OutputType ConsoleApplication
}
$desktopHostPath = Join-Path $PSScriptRoot 'DeskNativeHost-3_8_5.exe'
if (!(Test-Path -LiteralPath $desktopHostPath)) { Add-Type -Path (Join-Path $PSScriptRoot 'DeskNativeHost.cs') -ReferencedAssemblies 'System.dll','System.Core.dll','System.Web.Extensions.dll' -OutputAssembly $desktopHostPath -OutputType ConsoleApplication }
$utf8 = New-Object Text.UTF8Encoding($false)
$manifest = @{name='com.facebookdesk.media'; description='Facebook Desk Start Video'; path=$desktopHostPath; type='stdio'; allowed_origins=@($ids | ForEach-Object { "chrome-extension://$_/" })}
[IO.File]::WriteAllText($hostPath, ($manifest | ConvertTo-Json -Depth 5), $utf8)
# Chrome starts this narrowly scoped host only for explicitly registered IDs.
$key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Software\Google\Chrome\NativeMessagingHosts\com.facebookdesk.media')
try { $key.SetValue('', $hostPath, [Microsoft.Win32.RegistryValueKind]::String) } finally { $key.Dispose() }
# 3.8.7: also merge the IDs into media-bridge-config.json, otherwise Media Bridge rejects a new ID
# ("Extension chua duoc ghep noi") even though the native host accepts it.
$bridgeIds = @($ids)
if (Test-Path -LiteralPath $configPath) { $bridgeIds += @((Get-Content -LiteralPath $configPath -Raw | ConvertFrom-Json).extensionIds) }
$bridgeIds = @($bridgeIds | Where-Object { $_ -match '^[a-p]{32}$' } | Select-Object -Unique)
[IO.File]::WriteAllText($configPath, (@{extensionIds = $bridgeIds} | ConvertTo-Json), $utf8)
Write-Host 'Installed. Reload FB Desk in chrome://extensions, then open Settings > Start Video.' -ForegroundColor Green
Write-Host ('Registered IDs: ' + ($ids -join ', '))

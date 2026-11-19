param([Parameter(Mandatory=$true)][string]$ClientId,[switch]$ExistingVideoFolder)
$ErrorActionPreference='Stop'
if ($ClientId -notmatch '^[0-9]+-[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$'){throw 'Invalid Chrome Extension OAuth client ID'}
$path=Join-Path $PSScriptRoot 'manifest.json'
$m=Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
$scope=if ($ExistingVideoFolder){'https://www.googleapis.com/auth/drive'}else{'https://www.googleapis.com/auth/drive.file'}
$m | Add-Member -Force -NotePropertyName oauth2 -NotePropertyValue ([ordered]@{client_id=$ClientId;scopes=@($scope)})
[IO.File]::WriteAllText($path,($m | ConvertTo-Json -Depth 8),[Text.UTF8Encoding]::new($false))
Write-Output 'OAuth configured. Reload the extension in Chrome.'


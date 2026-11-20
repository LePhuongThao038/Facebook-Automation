# Cap nhat FB Desk TAI CHO: chep ma moi vao DUNG thu muc Chrome dang nap, giu nguyen ID extension,
# hang cho, tien do va cau hinh rieng cua may. KHONG Load unpacked thu muc moi (lam vay doi ID, mat du lieu).
#
#   Xem truoc (khong ghi gi):  powershell -ExecutionPolicy Bypass -File Update-InPlace.ps1 -Target "D:\FB-Desk" -Preview
#   Cap nhat:                   powershell -ExecutionPolicy Bypass -File Update-InPlace.ps1 -Target "D:\FB-Desk"
#
# Truoc khi chay: bam "Dung bot" o moi profile dung thu muc nay va cho het "Dang xu ly".
# Sau khi chay: chrome://extensions -> bam (Tai lai) tren the Facebook Desk -> mo lai tab FB Desk.
param(
    [Parameter(Mandatory = $true)][string]$Target,
    [string]$Source = '',
    [switch]$Preview
)
$ErrorActionPreference = 'Stop'
if (!$Source) { $Source = $PSScriptRoot }  # PowerShell 5.1: $PSScriptRoot is empty inside param() defaults

function Read-Manifest([string]$folder) {
    $path = Join-Path $folder 'manifest.json'
    if (!(Test-Path -LiteralPath $path)) { throw "Khong thay manifest.json trong $folder" }
    return Get-Content -LiteralPath $path -Raw -Encoding UTF8 | ConvertFrom-Json
}

$Source = (Resolve-Path -LiteralPath $Source).Path
$Target = (Resolve-Path -LiteralPath $Target).Path
# Junction/symlink: lay duong dan that de khong chep vao chinh no.
$targetItem = Get-Item -LiteralPath $Target
if ($targetItem.LinkType) { $Target = (Resolve-Path -LiteralPath $targetItem.Target).Path; Write-Host "Thu muc dich la $($targetItem.LinkType), dung duong dan that: $Target" }
if ($Source.TrimEnd('\') -ieq $Target.TrimEnd('\')) { throw 'Thu muc nguon va dich trung nhau.' }

$from = Read-Manifest $Source
$to = Read-Manifest $Target
if ($to.name -ne $from.name) { throw "Thu muc dich khong phai FB Desk (name = '$($to.name)')." }
Write-Host "Nguon: $Source  (ban $($from.version_name))"
Write-Host "Dich : $Target  (ban $($to.version_name))"

# Khong bao gio ghi de: cau hinh rieng cua may, du lieu that, ban build native host.
$keep = @('media-bridge-config.json', 'media-native-host.json', 'media-bridge-settings.json', 'DANH-BA-TU-SHEET.json', 'VAI-VE-TU-SHEET.json')
$skipDirs = @('.git', 'node_modules', 'tests', 'logs', 'tools', 'post-research', 'docs', 'work', 'outputs', '__pycache__')
$files = Get-ChildItem -LiteralPath $Source -Recurse -File | Where-Object {
    $rel = $_.FullName.Substring($Source.Length).TrimStart('\')
    $top = $rel.Split('\')[0]
    -not ($skipDirs -contains $top) -and -not ($keep -contains $_.Name) -and
    $_.Extension -notin @('.exe', '.csv', '.zip', '.bundle') -and
    $_.Name -notlike 'CROSS-COMMENT-*' -and $_.Name -notlike 'COMMENT-THU-*' -and $_.Name -notlike 'DOI-CHIEU-*'
}
$changes = foreach ($f in $files) {
    $rel = $f.FullName.Substring($Source.Length).TrimStart('\')
    $dest = Join-Path $Target $rel
    if (!(Test-Path -LiteralPath $dest)) { [pscustomobject]@{ Kind = 'moi'; Rel = $rel; Src = $f.FullName; Dest = $dest } }
    elseif ((Get-FileHash -LiteralPath $f.FullName).Hash -ne (Get-FileHash -LiteralPath $dest).Hash) { [pscustomobject]@{ Kind = 'sua'; Rel = $rel; Src = $f.FullName; Dest = $dest } }
}
$changes = @($changes)
Write-Host ("Se cap nhat {0} tep ({1} sua, {2} moi). Giu nguyen: {3}" -f $changes.Count, @($changes | Where-Object Kind -eq 'sua').Count, @($changes | Where-Object Kind -eq 'moi').Count, ($keep -join ', '))
$changes | ForEach-Object { Write-Host ("  [{0}] {1}" -f $_.Kind, $_.Rel) }
if ($Preview -or !$changes.Count) { Write-Host 'Che do xem truoc / khong co gi de cap nhat. Chua ghi tep nao.'; exit 0 }

# Sao luu cac tep sap bi ghi de, canh thu muc dich (khong nam trong thu muc Chrome dang nap).
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = $Target.TrimEnd('\') + '.backup-' + $stamp
New-Item -ItemType Directory -Path $backup | Out-Null
$done = New-Object System.Collections.Generic.List[object]
try {
    foreach ($c in $changes) {
        if ($c.Kind -eq 'sua') {
            $bak = Join-Path $backup $c.Rel
            New-Item -ItemType Directory -Force -Path (Split-Path $bak) | Out-Null
            Copy-Item -LiteralPath $c.Dest -Destination $bak -Force
        }
        New-Item -ItemType Directory -Force -Path (Split-Path $c.Dest) | Out-Null
        Copy-Item -LiteralPath $c.Src -Destination $c.Dest -Force
        $done.Add($c)
    }
} catch {
    Write-Host "Loi giua chung: $($_.Exception.Message). Dang phuc hoi..." -ForegroundColor Red
    foreach ($c in $done) {
        if ($c.Kind -eq 'sua') { Copy-Item -LiteralPath (Join-Path $backup $c.Rel) -Destination $c.Dest -Force }
        else { Remove-Item -LiteralPath $c.Dest -Force -ErrorAction SilentlyContinue }
    }
    Write-Host 'Da phuc hoi thu muc dich ve trang thai truoc khi cap nhat.' -ForegroundColor Yellow
    exit 1
}
$after = Read-Manifest $Target
Write-Host ("Xong: {0} -> {1}. Ban sao luu: {2}" -f $to.version_name, $after.version_name, $backup) -ForegroundColor Green
Write-Host 'Tiep theo: chrome://extensions -> bam (Tai lai) tren the Facebook Desk -> mo lai tab FB Desk. ID extension giu nguyen.'

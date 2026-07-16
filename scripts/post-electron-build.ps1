# After electron-builder: silent-install current package.json version, prune old installers (keep 2 newest by version).
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Get-InstallerVersion {
    param([string]$Name)
    if ($Name -match 'NOVAT-Setup-(\d+\.\d+\.\d+)\.exe$') {
        return [version]$Matches[1]
    }
    return $null
}

$pkgVersion = (Get-Content (Join-Path $Root "package.json") -Raw | ConvertFrom-Json).version
$releaseDir = Join-Path $Root "release"
if (-not (Test-Path $releaseDir)) {
    Write-Host "[NOVAT] release/ missing - nothing to install."
    exit 0
}

$installers = @(Get-ChildItem (Join-Path $releaseDir "NOVAT-Setup-*.exe") | ForEach-Object {
    $v = Get-InstallerVersion $_.Name
    if ($v) { [PSCustomObject]@{ File = $_; Version = $v } }
} | Sort-Object Version -Descending)

if ($installers.Count -eq 0) {
    Write-Host "[NOVAT] No installer found in release/."
    exit 0
}

Write-Host "[NOVAT] Found $($installers.Count) installer(s). Keeping newest 2."

$toRemove = @($installers | Select-Object -Skip 2)
foreach ($item in $toRemove) {
    $exe = $item.File
    $blockmap = Join-Path $releaseDir ("NOVAT-Setup-{0}.exe.blockmap" -f $item.Version)
    Write-Host "[NOVAT] Delete old version: $($exe.Name)"
    Remove-Item $exe.FullName -Force -ErrorAction SilentlyContinue
    if (Test-Path $blockmap) {
        Remove-Item $blockmap -Force -ErrorAction SilentlyContinue
    }
}

$target = $installers | Where-Object { $_.Version.ToString() -eq $pkgVersion } | Select-Object -First 1
if (-not $target) { $target = $installers[0] }
Write-Host "[NOVAT] Installing $($target.Version) (package.json=$pkgVersion) ..."

Get-Process -Name "NOVAT" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$proc = Start-Process -FilePath $target.File.FullName -ArgumentList "/S" -Wait -PassThru
if ($proc.ExitCode -and $proc.ExitCode -ne 0) {
    Write-Warning "[NOVAT] Installer exit code: $($proc.ExitCode)"
}

$candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\workorganizer\NOVAT.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\NOVAT\NOVAT.exe"),
    (Join-Path $env:LOCALAPPDATA "Programs\novat\NOVAT.exe"),
    (Join-Path $env:ProgramFiles "NOVAT\NOVAT.exe")
)
$app = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $app) {
    $shortcut = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\NOVAT.lnk"
    if (Test-Path $shortcut) {
        $shell = New-Object -ComObject WScript.Shell
        $targetPath = $shell.CreateShortcut($shortcut).TargetPath
        if ($targetPath -and (Test-Path $targetPath)) { $app = $targetPath }
    }
}
if ($app) {
    Start-Process $app
    Write-Host "[NOVAT] Started: $app"
} else {
    Write-Host "[NOVAT] Install done. Start NOVAT manually if needed."
}

$kept = (@(Get-ChildItem (Join-Path $releaseDir "NOVAT-Setup-*.exe") | ForEach-Object { $_.Name }) -join ", ")
Write-Host "[NOVAT] Kept: $kept"
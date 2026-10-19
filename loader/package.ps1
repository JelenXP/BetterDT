# Builds the release:
#   dist\BetterDT.zip        – for manual install (extract into the game folder)
#   dist\release\*           – GitHub release assets for the auto-updater (manifest.txt + every file)
# The version is read from betterdt.cpp (BETTERDT_VERSION).
param([string[]]$Notes = @())
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root 'dist'
$version = [regex]::Match((Get-Content -Raw (Join-Path $root 'betterdt.cpp')), '#define BETTERDT_VERSION "([0-9.]+)"').Groups[1].Value
if (-not $version) { throw 'BETTERDT_VERSION not found' }

$modsDir = Join-Path $root '..\mod\mods'
$mods = Get-Content -Raw (Join-Path $modsDir 'mods.json') | ConvertFrom-Json
$dll = Join-Path $root 'build\BetterDT_x64.ext.dll'

# zip
$stage = Join-Path $out 'stage'
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $stage 'mods') | Out-Null
Copy-Item $dll $stage
foreach ($f in $mods) { Copy-Item (Join-Path $modsDir $f) (Join-Path $stage 'mods') }
Copy-Item (Join-Path $modsDir 'mods.json') (Join-Path $stage 'mods')
Copy-Item (Join-Path $root 'INSTALL.txt') (Join-Path $stage 'BetterDT-INSTALL.txt')
$zip = Join-Path $out 'BetterDT.zip'
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force

# release assets + manifest
$rel = Join-Path $out 'release'
Remove-Item $rel -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $rel | Out-Null
$lines = @('betterdt-manifest 1', "version $version")
foreach ($n in $Notes) { $lines += "note $n" }
$lines += 'mods ' + ($mods -join ' ')
$files = @(@{ src = $dll; dest = 'dll' }, @{ src = (Join-Path $root 'INSTALL.txt'); dest = 'INSTALL.txt' })
foreach ($f in $mods) { $files += @{ src = (Join-Path $modsDir $f); dest = "mods/$f" } }
foreach ($f in $files) {
  $name = Split-Path -Leaf $f.src
  Copy-Item $f.src (Join-Path $rel $name)
  $hash = (Get-FileHash -Algorithm SHA256 $f.src).Hash.ToLower()
  $size = (Get-Item $f.src).Length
  $lines += "file $hash $size $name $($f.dest)"
}
[IO.File]::WriteAllText((Join-Path $rel 'manifest.txt'), ($lines -join "`n") + "`n", (New-Object Text.UTF8Encoding($false)))
Copy-Item $zip $rel
Write-Output "BetterDT $version"
Get-ChildItem $rel | Select-Object Name, Length

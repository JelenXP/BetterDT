# Builds the release zip: DTModLoader_x64.ext.dll + mods\ (contents are extracted into the game folder).
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root 'dist'
$stage = Join-Path $out 'stage'
Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force (Join-Path $stage 'mods') | Out-Null
Copy-Item (Join-Path $root 'build\DTModLoader_x64.ext.dll') $stage
$mods = Join-Path $root '..\mod\mods'
foreach ($f in 'os-perf.js', 'hire-tools.js') { Copy-Item (Join-Path $mods $f) (Join-Path $stage 'mods') }
Set-Content -Encoding ascii (Join-Path $stage 'mods\mods.json') '["os-perf.js", "hire-tools.js"]'
Set-Content -Encoding ascii (Join-Path $stage 'mods\dtmodloader.ini') "# gpu=1: render on the high-performance GPU (laptops with two GPUs). gpu=0 turns it off.`r`ngpu=1"
Copy-Item (Join-Path $root 'INSTALL.txt') $stage
$zip = Join-Path $out 'DTModLoader.zip'
Remove-Item $zip -ErrorAction SilentlyContinue
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip
Remove-Item $stage -Recurse -Force
Get-Item $zip | Select-Object FullName, Length

# Builds dist\BetterDT.zip, the only release asset. Players extract it into the game folder by hand and
# the auto-updater downloads the same zip. The entries are stored uncompressed so the updater can read
# them without an inflate library (the zip is small anyway).
# The version is read from betterdt.cpp (BETTERDT_VERSION); -Notes lines are shown in the game settings.
param([string[]]$Notes = @())
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$out = Join-Path $root 'dist'
$version = [regex]::Match((Get-Content -Raw (Join-Path $root 'betterdt.cpp')), '#define BETTERDT_VERSION "([0-9.]+)"').Groups[1].Value
if (-not $version) { throw 'BETTERDT_VERSION not found' }

$modsDir = Join-Path $root '..\mod\mods'
$mods = Get-Content -Raw (Join-Path $modsDir 'mods.json') | ConvertFrom-Json
$utf8 = New-Object Text.UTF8Encoding($false)

$manifest = @('betterdt-manifest 2', "version $version")
foreach ($n in $Notes) { $manifest += "note $n" }
$manifest += 'mods ' + ($mods -join ' ')

# zip entry name -> content
$entries = [ordered]@{}
$entries['BetterDT_x64.ext.dll'] = [IO.File]::ReadAllBytes((Join-Path $root 'build\BetterDT_x64.ext.dll'))
$entries['BetterDT-INSTALL.txt'] = [IO.File]::ReadAllBytes((Join-Path $root 'INSTALL.txt'))
foreach ($f in $mods) { $entries["mods/$f"] = [IO.File]::ReadAllBytes((Join-Path $modsDir $f)) }
$entries['mods/mods.json'] = [IO.File]::ReadAllBytes((Join-Path $modsDir 'mods.json'))
$entries['mods/betterdt-version.txt'] = $utf8.GetBytes(($manifest -join "`n") + "`n")

$crcTable = [uint32[]]::new(256)
for ($i = 0; $i -lt 256; $i++) {
  [uint32]$c = $i
  for ($k = 0; $k -lt 8; $k++) { if ($c -band 1) { $c = 3988292384 -bxor ($c -shr 1) } else { $c = $c -shr 1 } }
  $crcTable[$i] = $c
}
function Crc32([byte[]]$data) {
  [uint32]$c = 4294967295
  foreach ($b in $data) { $c = $crcTable[($c -bxor $b) -band 0xFF] -bxor ($c -shr 8) }
  return [uint32]($c -bxor 4294967295)
}

# stored zip: local header + data for every entry, then the central directory
$now = Get-Date
[uint16]$dosTime = ($now.Hour -shl 11) -bor ($now.Minute -shl 5) -bor [int][math]::Floor($now.Second / 2)
[uint16]$dosDate = (($now.Year - 1980) -shl 9) -bor ($now.Month -shl 5) -bor $now.Day
$ms = New-Object IO.MemoryStream
$w = New-Object IO.BinaryWriter($ms)
$central = New-Object IO.MemoryStream
$cw = New-Object IO.BinaryWriter($central)
foreach ($name in $entries.Keys) {
  $data = $entries[$name]
  $nameBytes = $utf8.GetBytes($name)
  $crc = Crc32 $data
  $offset = [uint32]$ms.Position
  $w.Write([uint32]0x04034b50); $w.Write([uint16]10); $w.Write([uint16]0); $w.Write([uint16]0)
  $w.Write($dosTime); $w.Write($dosDate); $w.Write([uint32]$crc)
  $w.Write([uint32]$data.Length); $w.Write([uint32]$data.Length)
  $w.Write([uint16]$nameBytes.Length); $w.Write([uint16]0); $w.Write($nameBytes); $w.Write($data)
  $cw.Write([uint32]0x02014b50); $cw.Write([uint16]20); $cw.Write([uint16]10); $cw.Write([uint16]0); $cw.Write([uint16]0)
  $cw.Write($dosTime); $cw.Write($dosDate); $cw.Write([uint32]$crc)
  $cw.Write([uint32]$data.Length); $cw.Write([uint32]$data.Length)
  $cw.Write([uint16]$nameBytes.Length); $cw.Write([uint16]0); $cw.Write([uint16]0)
  $cw.Write([uint16]0); $cw.Write([uint16]0); $cw.Write([uint32]0); $cw.Write([uint32]$offset); $cw.Write($nameBytes)
}
$cdOffset = [uint32]$ms.Position
$cw.Flush()
$w.Write($central.ToArray())
$w.Write([uint32]0x06054b50); $w.Write([uint16]0); $w.Write([uint16]0)
$w.Write([uint16]$entries.Count); $w.Write([uint16]$entries.Count)
$w.Write([uint32]$central.Length); $w.Write($cdOffset); $w.Write([uint16]0)
$w.Flush()

New-Item -ItemType Directory -Force $out | Out-Null
Remove-Item (Join-Path $out 'release') -Recurse -Force -ErrorAction SilentlyContinue
$zip = Join-Path $out 'BetterDT.zip'
[IO.File]::WriteAllBytes($zip, $ms.ToArray())
Write-Output "BetterDT $version -> $zip ($((Get-Item $zip).Length) bytes, $($entries.Count) files)"

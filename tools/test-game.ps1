# Test copy only, never a release: copies the repo's mods into the test copy of the game, starts it with the
# debugging port and prints its PID.
param([string]$Dir = "$env:LOCALAPPDATA\Temp\claude\C--Programov-n--chess--claude-worktrees-devices-tycoon-modding-b829a9\514985cc-c4fa-4e02-8582-2f27e974ab08\scratchpad\gametest3")
$src = Join-Path $PSScriptRoot "..\mod\mods"
Copy-Item (Join-Path $src "*.js"), (Join-Path $src "mods.json") (Join-Path $Dir "mods") -Force
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS = "--remote-debugging-port=9222 --remote-allow-origins=http://127.0.0.1"
# its own WebView2 profile: a running copy of the game holds the shared one, and a second browser with other
# arguments cannot open it
$env:WEBVIEW2_USER_DATA_FOLDER = Join-Path $Dir "webview2-test"
$p = Start-Process -FilePath (Join-Path $Dir "Devices Tycoon.exe") -WorkingDirectory $Dir -PassThru
$p.Id

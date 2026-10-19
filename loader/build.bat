@echo off
rem Build BetterDT_x64.ext.dll (Visual Studio 2022 with C++ tools).
rem WebView2 SDK header is downloaded from NuGet on first build (package Microsoft.Web.WebView2).
setlocal
cd /d "%~dp0"
set WV2VER=1.0.2903.40
if not exist sdk\WebView2.h (
  mkdir sdk 2>nul
  curl -sL -o sdk\wv2.nupkg https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/%WV2VER%/microsoft.web.webview2.%WV2VER%.nupkg || exit /b 1
  tar -xf sdk\wv2.nupkg -C sdk build/native/include/WebView2.h || exit /b 1
  move /y sdk\build\native\include\WebView2.h sdk\WebView2.h >nul
  rmdir /s /q sdk\build
  del sdk\wv2.nupkg
)
set "VSWHERE=%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe"
for /f "usebackq delims=" %%i in (`"%VSWHERE%" -latest -property installationPath`) do set "VS=%%i"
call "%VS%\VC\Auxiliary\Build\vcvars64.bat" >nul || exit /b 1
mkdir build 2>nul
cl /nologo /LD /O2 /MT /EHsc /W3 /std:c++17 /utf-8 /D_CRT_SECURE_NO_WARNINGS /Isdk /Fobuild\ betterdt.cpp vtidx.c ^
   /link /OUT:build\BetterDT_x64.ext.dll /IMPLIB:build\betterdt.lib ole32.lib dxgi.lib winhttp.lib shlwapi.lib shell32.lib user32.lib advapi32.lib || exit /b 1
echo OK: build\BetterDT_x64.ext.dll

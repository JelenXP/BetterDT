// DTModLoader – zavaděč JS modů pro Devices Tycoon bez úpravy souborů hry.
//
// Jak to funguje:
//  • Construct (WebView2 obal hry) sám načte každý soubor *.ext.dll ze složky hry a zavolá jeho
//    WrapperExtInit. To je oficiální mechanismus pro nativní rozšíření (tak se načítá i Steam_x64.ext.dll).
//  • Při načtení přesměrujeme v importní tabulce exe funkci GetProcAddress. Když si zavaděč WebView2
//    v exe vyžádá CreateWebViewEnvironmentWithOptionsInternal, vrátíme vlastní obálku, která
//      – přidá Chromiu přepínač --force_high_performance_gpu (vykreslování na výkonné grafice),
//      – po vytvoření webview zaregistruje skript (AddScriptToExecuteOnDocumentCreated) složený
//        z modů ve složce mods\ vedle exe (pořadí podle mods\mods.json).
//  • DevTools ani vzdálené ladění se nezapínají; soubory hry (assets.dat, package.json) zůstávají
//    nedotčené, takže aktualizace hry mod nesmaže.
//
// Nastavení: mods\dtmodloader.ini (řádky klíč=hodnota): gpu=0 vypne přepínač grafiky.
// Záznam: mods\dtmodloader.log (přepíše se při každém spuštění).

#include <windows.h>
#include <dxgi1_6.h>
#include <wrl.h>
#include <string>
#include <vector>
#include <cstdio>
#include "WebView2.h"

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

extern "C" const int VT_ENV_CREATE_CONTROLLER;
extern "C" const int VT_ENV3_CREATE_COMPOSITION;
extern "C" const int VT_ENV10_CREATE_CONTROLLER_OPT;
extern "C" const int VT_ENV10_CREATE_COMPOSITION_OPT;

static const wchar_t kVersion[] = L"0.1";
static const wchar_t kGpuFlag[] = L"--force_high_performance_gpu";

static HMODULE g_self;
static std::wstring g_modsDir;   // ...\Devices Tycoon\mods\ (s lomítkem na konci)
static ULONGLONG g_t0;

// ── záznam ──────────────────────────────────────────────────────────────────────────────────────
static void Log(const char *fmt, ...) {
  if (g_modsDir.empty()) return;
  FILE *f = _wfopen((g_modsDir + L"dtmodloader.log").c_str(), L"ab");
  if (!f) return;
  fprintf(f, "%7llu ms  ", GetTickCount64() - g_t0);
  va_list ap; va_start(ap, fmt); vfprintf(f, fmt, ap); va_end(ap);
  fputc('\n', f);
  fclose(f);
}

// ── soubory ─────────────────────────────────────────────────────────────────────────────────────
static bool ReadFileUtf8(const std::wstring &path, std::string &out) {
  HANDLE h = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ, nullptr, OPEN_EXISTING, 0, nullptr);
  if (h == INVALID_HANDLE_VALUE) return false;
  LARGE_INTEGER sz{};
  GetFileSizeEx(h, &sz);
  out.resize((size_t)sz.QuadPart);
  DWORD got = 0;
  BOOL ok = out.empty() || ReadFile(h, &out[0], (DWORD)out.size(), &got, nullptr);
  CloseHandle(h);
  if (!ok) return false;
  out.resize(got);
  if (out.size() >= 3 && (unsigned char)out[0] == 0xEF && (unsigned char)out[1] == 0xBB && (unsigned char)out[2] == 0xBF)
    out.erase(0, 3);
  return true;
}

static std::wstring Widen(const std::string &s) {
  if (s.empty()) return {};
  int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
  std::wstring w(n, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), &w[0], n);
  return w;
}

static bool GpuEnabled() {
  std::string ini;
  if (!ReadFileUtf8(g_modsDir + L"dtmodloader.ini", ini)) return true;
  for (size_t p = 0; (p = ini.find("gpu", p)) != std::string::npos; p += 3) {
    if (p > 0 && ini[p - 1] != '\n' && ini[p - 1] != '\r') continue;
    size_t q = ini.find_first_not_of(" \t=", p + 3);
    if (q != std::string::npos && ini.find('=', p) < q) return ini[q] != '0';
  }
  return true;
}

// Seznam modů z mods.json: všechny řetězce v uvozovkách, které končí na .js (stačí na ["a.js","b.js"]).
static std::vector<std::string> ModList() {
  std::vector<std::string> list;
  std::string json;
  if (!ReadFileUtf8(g_modsDir + L"mods.json", json)) return list;
  for (size_t i = 0; (i = json.find('"', i)) != std::string::npos;) {
    size_t j = json.find('"', i + 1);
    if (j == std::string::npos) break;
    std::string s = json.substr(i + 1, j - i - 1);
    if (s.size() > 3 && s.compare(s.size() - 3, 3, ".js") == 0 &&
        s.find_first_of("\\/:") == std::string::npos && s.find("..") == std::string::npos)
      list.push_back(s);
    i = j + 1;
  }
  return list;
}

// Skript, který se spustí v každém novém dokumentu (jen v hlavní stránce hry).
static std::wstring BuildScript() {
  std::string js;
  js += "(() => {\n"
        "if (window.top !== window || location.hostname !== 'app.localhost') return;\n"
        "if (globalThis.DTMods && globalThis.DTMods.native) return;\n"
        "const mods = [], names = new Set();\n"
        "const log = (...a) => console.log('[DTMods]', ...a);\n"
        // starý loader z assets.dat (dtmod install) by DTMods přepsal a mody načetl podruhé → objekt je
        // jen pro čtení a register stejné jméno podruhé ignoruje
        "Object.defineProperty(globalThis, 'DTMods', { value: Object.freeze({\n"
        "  native: true, version: '";
  js += "0.1";
  js += "',\n"
        "  register(name, init) { if (names.has(name)) return; names.add(name); mods.push({ name, init }); },\n"
        "  log,\n"
        "}), writable: false, configurable: false });\n";
  for (const std::string &name : ModList()) {
    std::string code;
    if (!ReadFileUtf8(g_modsDir + Widen(name), code)) {
      Log("mod %s: soubor nejde přečíst", name.c_str());
      js += "console.error('[DTMods] nejde načíst " + name + "');\n";
      continue;
    }
    Log("mod %s: %zu B", name.c_str(), code.size());
    js += "try { (function () {\n" + code + "\n})(); } catch (e) { console.error('[DTMods] mod " + name +
          " spadl při načtení:', e); }\n";
  }
  js += "function startAll(rt) {\n"
        "  for (const m of mods) {\n"
        "    try { m.init(rt); log('spuštěn mod', m.name); }\n"
        "    catch (e) { console.error('[DTMods] mod', m.name, 'spadl:', e); }\n"
        "  }\n"
        "}\n"
        "(function wait() { const rt = globalThis.runtime;\n"
        "  if (rt && rt.objects && rt.layout) startAll(rt); else setTimeout(wait, 250); })();\n"
        "log('DTModLoader ";
  js += "0.1";
  js += " připraven, modů: ' + mods.length);\n"
        "})();\n";
  return Widen(js);
}

// ── vložení skriptu do vytvořeného webview ───────────────────────────────────────────────────────
static void Inject(ICoreWebView2Controller *ctl) {
  ComPtr<ICoreWebView2> wv;
  if (FAILED(ctl->get_CoreWebView2(&wv)) || !wv) { Log("get_CoreWebView2 selhalo"); return; }
  std::wstring script = BuildScript();
  HRESULT hr = wv->AddScriptToExecuteOnDocumentCreated(script.c_str(),
    Callback<ICoreWebView2AddScriptToExecuteOnDocumentCreatedCompletedHandler>(
      [](HRESULT hr, LPCWSTR) -> HRESULT { Log("skript zaregistrován (hr=0x%08lx)", hr); return S_OK; }).Get());
  Log("AddScriptToExecuteOnDocumentCreated: hr=0x%08lx, %zu znaků", hr, script.size());
}

// ── háčky na vytvoření controlleru (přepsané položky vtable prostředí) ─────────────────────────────
// Hra může použít kteroukoli ze čtyř metod (obyčejný/composition controller, s volbami i bez).
typedef ICoreWebView2CreateCoreWebView2CompositionControllerCompletedHandler CompHandler;
typedef ICoreWebView2CreateCoreWebView2ControllerCompletedHandler CtlHandler;
typedef HRESULT(STDMETHODCALLTYPE *CreateCompFn)(void *, HWND, CompHandler *);
typedef HRESULT(STDMETHODCALLTYPE *CreateCtlFn)(void *, HWND, CtlHandler *);
typedef HRESULT(STDMETHODCALLTYPE *CreateCompOptFn)(void *, HWND, ICoreWebView2ControllerOptions *, CompHandler *);
typedef HRESULT(STDMETHODCALLTYPE *CreateCtlOptFn)(void *, HWND, ICoreWebView2ControllerOptions *, CtlHandler *);
static CreateCompFn g_origCreateComp;
static CreateCtlFn g_origCreateCtl;
static CreateCompOptFn g_origCreateCompOpt;
static CreateCtlOptFn g_origCreateCtlOpt;

static ComPtr<CompHandler> WrapComp(CompHandler *h) {
  ComPtr<CompHandler> inner(h);
  return Callback<CompHandler>([inner](HRESULT hr, ICoreWebView2CompositionController *c) -> HRESULT {
    if (SUCCEEDED(hr) && c) {
      ComPtr<ICoreWebView2Controller> ctl;
      if (SUCCEEDED(c->QueryInterface(IID_PPV_ARGS(&ctl)))) Inject(ctl.Get());
    } else Log("composition controller nevznikl (hr=0x%08lx)", hr);
    return inner ? inner->Invoke(hr, c) : S_OK;
  });
}

static ComPtr<CtlHandler> WrapCtl(CtlHandler *h) {
  ComPtr<CtlHandler> inner(h);
  return Callback<CtlHandler>([inner](HRESULT hr, ICoreWebView2Controller *c) -> HRESULT {
    if (SUCCEEDED(hr) && c) Inject(c);
    else Log("controller nevznikl (hr=0x%08lx)", hr);
    return inner ? inner->Invoke(hr, c) : S_OK;
  });
}

static HRESULT STDMETHODCALLTYPE HookCreateComp(void *self, HWND w, CompHandler *h) {
  Log("CreateCoreWebView2CompositionController");
  return g_origCreateComp(self, w, WrapComp(h).Get());
}
static HRESULT STDMETHODCALLTYPE HookCreateCtl(void *self, HWND w, CtlHandler *h) {
  Log("CreateCoreWebView2Controller");
  return g_origCreateCtl(self, w, WrapCtl(h).Get());
}
static HRESULT STDMETHODCALLTYPE HookCreateCompOpt(void *self, HWND w, ICoreWebView2ControllerOptions *o, CompHandler *h) {
  Log("CreateCoreWebView2CompositionControllerWithOptions");
  return g_origCreateCompOpt(self, w, o, WrapComp(h).Get());
}
static HRESULT STDMETHODCALLTYPE HookCreateCtlOpt(void *self, HWND w, ICoreWebView2ControllerOptions *o, CtlHandler *h) {
  Log("CreateCoreWebView2ControllerWithOptions");
  return g_origCreateCtlOpt(self, w, o, WrapCtl(h).Get());
}

template <class T> static void PatchVtbl(void *obj, int idx, void *repl, T *orig) {
  void **vt = *(void ***)obj;
  if (vt[idx] == repl) return;           // stejná třída už je přepsaná
  DWORD old;
  VirtualProtect(&vt[idx], sizeof(void *), PAGE_READWRITE, &old);
  *orig = (T)vt[idx];
  vt[idx] = repl;
  VirtualProtect(&vt[idx], sizeof(void *), old, &old);
}

// ── grafické karty (jen do záznamu) ─────────────────────────────────────────────────────────────
// Přepínač nevybírá výrobce: Chromium požádá Windows (DXGI) o adaptér s preferencí „vysoký výkon“.
// S jedinou grafikou je to ona, s integrovanou + dedikovanou (NVIDIA/AMD/Intel Arc) ta dedikovaná.
static void LogAdapters() {
  ComPtr<IDXGIFactory6> f;
  if (FAILED(CreateDXGIFactory1(IID_PPV_ARGS(&f)))) { Log("DXGI: IDXGIFactory6 není k dispozici"); return; }
  for (UINT i = 0;; i++) {
    ComPtr<IDXGIAdapter1> a;
    if (f->EnumAdapterByGpuPreference(i, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, IID_PPV_ARGS(&a)) != S_OK) break;
    DXGI_ADAPTER_DESC1 d{};
    a->GetDesc1(&d);
    if (d.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) continue;
    Log("grafika %u: %ls (%llu MB vlastní paměti)%s", i, d.Description,
        (unsigned long long)(d.DedicatedVideoMemory >> 20), i == 0 ? " ← výkonná volba" : "");
  }
}

// ── obálka CreateWebViewEnvironmentWithOptionsInternal (z EmbeddedBrowserWebView.dll) ─────────────
typedef HRESULT(STDAPICALLTYPE *CreateEnvFn)(bool, int, PCWSTR, IUnknown *, ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler *);
static CreateEnvFn g_realCreateEnv;

static HRESULT STDAPICALLTYPE HookCreateEnv(bool checkRunning, int runtimeType, PCWSTR userData, IUnknown *options,
                                           ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler *h) {
  Log("CreateWebViewEnvironmentWithOptionsInternal");
  const bool gpu = GpuEnabled();
  if (gpu) LogAdapters(); else Log("výkonná grafika vypnutá v dtmodloader.ini");
  ComPtr<ICoreWebView2EnvironmentOptions> opts;
  if (options && SUCCEEDED(options->QueryInterface(IID_PPV_ARGS(&opts))) && gpu) {
    LPWSTR cur = nullptr;
    opts->get_AdditionalBrowserArguments(&cur);
    std::wstring args = cur ? cur : L"";
    if (cur) CoTaskMemFree(cur);
    if (args.find(kGpuFlag) == std::wstring::npos) {
      args = std::wstring(kGpuFlag) + (args.empty() ? L"" : L" ") + args;
      HRESULT hr = opts->put_AdditionalBrowserArguments(args.c_str());
      Log("přepínač výkonné grafiky přidán (hr=0x%08lx)", hr);
    }
  }
  ComPtr<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler> inner(h);
  auto wrapped = Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
    [inner](HRESULT hr, ICoreWebView2Environment *env) -> HRESULT {
      if (SUCCEEDED(hr) && env) {
        PatchVtbl(env, VT_ENV_CREATE_CONTROLLER, (void *)HookCreateCtl, &g_origCreateCtl);
        ComPtr<ICoreWebView2Environment3> env3;
        if (SUCCEEDED(env->QueryInterface(IID_PPV_ARGS(&env3))))
          PatchVtbl(env3.Get(), VT_ENV3_CREATE_COMPOSITION, (void *)HookCreateComp, &g_origCreateComp);
        ComPtr<ICoreWebView2Environment10> env10;
        if (SUCCEEDED(env->QueryInterface(IID_PPV_ARGS(&env10)))) {
          PatchVtbl(env10.Get(), VT_ENV10_CREATE_CONTROLLER_OPT, (void *)HookCreateCtlOpt, &g_origCreateCtlOpt);
          PatchVtbl(env10.Get(), VT_ENV10_CREATE_COMPOSITION_OPT, (void *)HookCreateCompOpt, &g_origCreateCompOpt);
        }
        Log("prostředí WebView2 vytvořeno, háčky na controller nastaveny");
      } else Log("prostředí WebView2 nevzniklo (hr=0x%08lx)", hr);
      return inner ? inner->Invoke(hr, env) : S_OK;
    });
  return g_realCreateEnv(checkRunning, runtimeType, userData, options, wrapped.Get());
}

// ── GetProcAddress v importní tabulce exe ───────────────────────────────────────────────────────
typedef FARPROC(WINAPI *GpaFn)(HMODULE, LPCSTR);
static GpaFn g_realGpa;

static FARPROC WINAPI HookGpa(HMODULE m, LPCSTR name) {
  FARPROC p = g_realGpa(m, name);
  if (p && ((ULONG_PTR)name >> 16) && strcmp(name, "CreateWebViewEnvironmentWithOptionsInternal") == 0) {
    g_realCreateEnv = (CreateEnvFn)p;
    return (FARPROC)HookCreateEnv;
  }
  return p;
}

static bool PatchIat(HMODULE mod, const char *dll, const char *fn, void *repl, void **orig) {
  auto base = (BYTE *)mod;
  auto dos = (IMAGE_DOS_HEADER *)base;
  auto nt = (IMAGE_NT_HEADERS *)(base + dos->e_lfanew);
  auto &dir = nt->OptionalHeader.DataDirectory[IMAGE_DIRECTORY_ENTRY_IMPORT];
  if (!dir.VirtualAddress) return false;
  for (auto imp = (IMAGE_IMPORT_DESCRIPTOR *)(base + dir.VirtualAddress); imp->Name; imp++) {
    if (_stricmp((char *)(base + imp->Name), dll) != 0 || !imp->OriginalFirstThunk) continue;
    auto names = (IMAGE_THUNK_DATA *)(base + imp->OriginalFirstThunk);
    auto addrs = (IMAGE_THUNK_DATA *)(base + imp->FirstThunk);
    for (; names->u1.AddressOfData; names++, addrs++) {
      if (IMAGE_SNAP_BY_ORDINAL(names->u1.Ordinal)) continue;
      auto ibn = (IMAGE_IMPORT_BY_NAME *)(base + names->u1.AddressOfData);
      if (strcmp((char *)ibn->Name, fn) != 0) continue;
      DWORD old;
      VirtualProtect(&addrs->u1.Function, sizeof(void *), PAGE_READWRITE, &old);
      *orig = (void *)addrs->u1.Function;
      addrs->u1.Function = (ULONG_PTR)repl;
      VirtualProtect(&addrs->u1.Function, sizeof(void *), old, &old);
      return true;
    }
  }
  return false;
}

// ── rozhraní rozšíření Constructu ────────────────────────────────────────────────────────────────
// Správce rozšíření (WV2ExtManager.dll) zavolá WrapperExtInit(IApplication*) a vrácený objekt si
// nechá (při nule rozšíření zahodí). Volá na něm metody vtable (0 = Release, 2 = OnMainWindowCreated…).
// Žádnou komponentu neregistrujeme, takže nám nepřijdou zprávy; stačí metody, které nic nedělají.
static void *Slot(void *, void *, void *, void *) { return nullptr; }
static void *g_extVtbl[16];
static struct { void **vtbl; } g_ext = { g_extVtbl };

extern "C" __declspec(dllexport) void *WrapperExtInit(void *) {
  for (auto &p : g_extVtbl) p = (void *)Slot;
  Log("WrapperExtInit");
  return &g_ext;
}

BOOL WINAPI DllMain(HINSTANCE h, DWORD reason, LPVOID) {
  if (reason != DLL_PROCESS_ATTACH) return TRUE;
  DisableThreadLibraryCalls(h);
  g_self = h;
  g_t0 = GetTickCount64();
  wchar_t path[MAX_PATH];
  DWORD n = GetModuleFileNameW(h, path, MAX_PATH);
  std::wstring dir(path, n);
  dir.resize(dir.find_last_of(L"\\/") + 1);
  g_modsDir = dir + L"mods\\";
  DeleteFileW((g_modsDir + L"dtmodloader.log").c_str());
  bool ok = PatchIat(GetModuleHandleW(nullptr), "KERNEL32.dll", "GetProcAddress", (void *)HookGpa, (void **)&g_realGpa);
  Log("DTModLoader %ls načten, háček GetProcAddress: %s", kVersion, ok ? "ano" : "NE");
  return TRUE;
}

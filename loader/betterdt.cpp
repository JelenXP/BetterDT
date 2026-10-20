// BetterDT – JS mod loader for Devices Tycoon that does not modify any game file.
//
// How it works:
//  • Construct (the game's WebView2 wrapper) loads every *.ext.dll in the game folder and calls its
//    WrapperExtInit. That is the official mechanism for native extensions (Steam_x64.ext.dll uses it too).
//  • On load we redirect GetProcAddress in the exe's import table. When the exe's WebView2 loader asks
//    for CreateWebViewEnvironmentWithOptionsInternal, we return our own wrapper, which
//      – adds the Chromium switch --force_high_performance_gpu (render on the high-performance GPU),
//      – after the webview is created, registers a script (AddScriptToExecuteOnDocumentCreated) built
//        from the mods in the mods\ folder next to the exe (order from mods\mods.json),
//      – serves https://betterdt.localhost/… (WebResourceRequested): the BetterDT section in the game
//        settings uses it to read state, save settings and run updates.
//  • DevTools and remote debugging stay off; game files (assets.dat, package.json) stay untouched,
//    so game updates do not remove the mod.
//
// Settings: mods\betterdt.ini (key=value lines, written by the BetterDT section in the game settings):
//   gpu=0 disables the GPU switch, autoupdate=0 disables updates, mod.<file>=0 disables a mod,
//   other keys belong to mods (e.g. hire-tools.autoHire=1).
// Updates: BetterDT-update.zip (a copy of BetterDT.zip) from the latest GitHub release (every file checked by its CRC-32).
// Crashes: a crashed game page is reloaded automatically (see OnProcessFailed).
// Log: mods\betterdt.log (overwritten on every start).

#include <windows.h>
#include <dxgi1_6.h>
#include <winhttp.h>
#include <shlwapi.h>
#include <shellapi.h>
#include <tlhelp32.h>
#include <wrl.h>
#include <atomic>
#include <map>
#include <mutex>
#include <string>
#include <vector>
#include <cstdio>
#include <ctime>
#include "WebView2.h"

using Microsoft::WRL::Callback;
using Microsoft::WRL::ComPtr;

extern "C" const int VT_ENV_CREATE_CONTROLLER;
extern "C" const int VT_ENV3_CREATE_COMPOSITION;
extern "C" const int VT_ENV10_CREATE_CONTROLLER_OPT;
extern "C" const int VT_ENV10_CREATE_COMPOSITION_OPT;

#ifndef BETTERDT_VERSION
#define BETTERDT_VERSION "0.3.6"
#endif
#define WIDE2(s) L##s
#define WIDE(s) WIDE2(s)
static const char kRepo[] = "JelenXP/BetterDT";
static const wchar_t kGpuFlag[] = L"--force_high_performance_gpu";
static const char kCoreMod[] = "betterdt-settings.js";      // settings section, cannot be disabled
static const wchar_t kOldDll[] = L"DTModLoader_x64.ext.dll";  // previous name of the loader
static const size_t kMaxAsset = 20u * 1024 * 1024;

static std::wstring g_selfPath;  // ...\Devices Tycoon\BetterDT_x64.ext.dll
static std::wstring g_gameDir;   // ...\Devices Tycoon\ (with trailing slash)
static std::wstring g_modsDir;   // ...\Devices Tycoon\mods\ (with trailing slash)
static ULONGLONG g_t0;
static std::mutex g_mx;          // settings and update state (update thread × UI thread)
static std::atomic<bool> g_scriptBuilt{ false };   // the mods of this session have been read

// ── log ──────────────────────────────────────────────────────────────────────────────────────────
static void Log(const char *fmt, ...) {
  if (g_modsDir.empty()) return;
  static std::mutex mx;
  std::lock_guard<std::mutex> lk(mx);
  FILE *f = _wfopen((g_modsDir + L"betterdt.log").c_str(), L"ab");
  if (!f) return;
  fprintf(f, "%7llu ms  ", GetTickCount64() - g_t0);
  va_list ap; va_start(ap, fmt); vfprintf(f, fmt, ap); va_end(ap);
  fputc('\n', f);
  fclose(f);
}

// ── strings and files ──────────────────────────────────────────────────────────────────────────
static std::wstring Widen(const std::string &s) {
  if (s.empty()) return {};
  int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
  std::wstring w(n, L'\0');
  MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), &w[0], n);
  return w;
}
static std::string Narrow(const std::wstring &w) {
  if (w.empty()) return {};
  int n = WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), nullptr, 0, nullptr, nullptr);
  std::string s(n, '\0');
  WideCharToMultiByte(CP_UTF8, 0, w.data(), (int)w.size(), &s[0], n, nullptr, nullptr);
  return s;
}

static bool ReadFileUtf8(const std::wstring &path, std::string &out) {
  HANDLE h = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, 0, nullptr);
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

// write through a temp file so a crash never leaves half a file
static bool WriteFileAtomic(const std::wstring &path, const std::string &data) {
  std::wstring tmp = path + L".tmp";
  HANDLE h = CreateFileW(tmp.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, 0, nullptr);
  if (h == INVALID_HANDLE_VALUE) return false;
  DWORD put = 0;
  BOOL ok = data.empty() || WriteFile(h, data.data(), (DWORD)data.size(), &put, nullptr);
  CloseHandle(h);
  if (!ok || put != data.size()) { DeleteFileW(tmp.c_str()); return false; }
  return MoveFileExW(tmp.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING) != 0;
}

static std::string JsonStr(const std::string &s) {
  std::string o = "\"";
  for (unsigned char c : s) {
    switch (c) {
      case '"': o += "\\\""; break;
      case '\\': o += "\\\\"; break;
      case '\n': o += "\\n"; break;
      case '\r': o += "\\r"; break;
      case '\t': o += "\\t"; break;
      case '<': o += "\\u003c"; break;
      default:
        if (c < 0x20) { char b[8]; sprintf(b, "\\u%04x", c); o += b; }
        else o += (char)c;
    }
  }
  return o + "\"";
}

// ── settings (mods\betterdt.ini) ────────────────────────────────────────────────────────────────
static std::map<std::string, std::string> g_ini;

static void ParseIni(const std::string &text, std::map<std::string, std::string> &out) {
  size_t p = 0;
  while (p < text.size()) {
    size_t e = text.find('\n', p);
    if (e == std::string::npos) e = text.size();
    std::string line = text.substr(p, e - p);
    p = e + 1;
    while (!line.empty() && (line.back() == '\r' || line.back() == ' ' || line.back() == '\t')) line.pop_back();
    size_t s = line.find_first_not_of(" \t");
    if (s == std::string::npos || line[s] == '#' || line[s] == ';') continue;
    size_t q = line.find('=', s);
    if (q == std::string::npos) continue;
    std::string k = line.substr(s, q - s), v = line.substr(q + 1);
    while (!k.empty() && (k.back() == ' ' || k.back() == '\t')) k.pop_back();
    size_t vs = v.find_first_not_of(" \t");
    v = vs == std::string::npos ? "" : v.substr(vs);
    if (!k.empty()) out[k] = v;
  }
}

static void LoadIni() {
  std::string text;
  std::lock_guard<std::mutex> lk(g_mx);
  g_ini.clear();
  if (ReadFileUtf8(g_modsDir + L"betterdt.ini", text)) { ParseIni(text, g_ini); return; }
  // first start after the rename: take over mods\dtmodloader.ini
  if (ReadFileUtf8(g_modsDir + L"dtmodloader.ini", text)) { ParseIni(text, g_ini); Log("settings taken over from dtmodloader.ini"); }
}

static void SaveIniLocked() {
  std::string out = "# BetterDT settings (edit them in the game: Settings > BetterDT)\r\n";
  for (auto &kv : g_ini) out += kv.first + "=" + kv.second + "\r\n";
  if (!WriteFileAtomic(g_modsDir + L"betterdt.ini", out)) Log("cannot write betterdt.ini");
}

static std::string IniGet(const std::string &k, const std::string &def) {
  std::lock_guard<std::mutex> lk(g_mx);
  auto it = g_ini.find(k);
  return it == g_ini.end() ? def : it->second;
}
static bool IniOn(const std::string &k, bool def) {
  std::string v = IniGet(k, def ? "1" : "0");
  return !(v == "0" || v == "false" || v == "off" || v == "no");
}

static bool ValidKey(const std::string &k) {
  if (k.empty() || k.size() > 80) return false;
  for (char c : k) if (!(isalnum((unsigned char)c) || c == '.' || c == '_' || c == '-')) return false;
  return true;
}

// ── mod list ───────────────────────────────────────────────────────────────────────────────────
static bool ValidModName(const std::string &s) {
  return s.size() > 3 && s.size() < 100 && s.compare(s.size() - 3, 3, ".js") == 0 &&
         s.find_first_of("\\/:*?\"<>| ") == std::string::npos && s.find("..") == std::string::npos;
}

// List from mods.json: every quoted string that ends with .js (enough for ["a.js","b.js"]).
static std::vector<std::string> ModList() {
  std::vector<std::string> list;
  std::string json;
  if (!ReadFileUtf8(g_modsDir + L"mods.json", json)) return list;
  for (size_t i = 0; (i = json.find('"', i)) != std::string::npos;) {
    size_t j = json.find('"', i + 1);
    if (j == std::string::npos) break;
    std::string s = json.substr(i + 1, j - i - 1);
    if (ValidModName(s)) list.push_back(s);
    i = j + 1;
  }
  return list;
}
static bool ModEnabled(const std::string &name) {
  return name == kCoreMod || IniOn("mod." + name, true);
}

// ── update state ────────────────────────────────────────────────────────────────────────────────
struct UpdateState {
  std::string state = "idle";   // idle | checking | uptodate | available | downloading | installed | error
  std::string latest, error, notes;
  long long checkedAt = 0;
  bool busy = false;
  bool acked = false;           // the player has closed the "new version" dialog
};
static UpdateState g_upd;
static std::map<std::string, std::string> g_crash;   // last crash of the game page, empty = none (see Crashes)

static std::string MapJson(const std::map<std::string, std::string> &m) {
  std::string j = "{";
  for (auto &kv : m) j += (j.size() > 1 ? "," : "") + JsonStr(kv.first) + ":" + JsonStr(kv.second);
  return j + "}";
}

static std::string StateJson() {
  std::lock_guard<std::mutex> lk(g_mx);
  std::string j = "{\"version\":" + JsonStr(BETTERDT_VERSION) + ",\"repo\":" + JsonStr(kRepo) + ",\"settings\":" + MapJson(g_ini);
  j += ",\"update\":{\"state\":" + JsonStr(g_upd.state) + ",\"latest\":" + JsonStr(g_upd.latest) +
       ",\"error\":" + JsonStr(g_upd.error) + ",\"notes\":" + JsonStr(g_upd.notes) +
       ",\"checkedAt\":" + std::to_string(g_upd.checkedAt) + ",\"busy\":" + (g_upd.busy ? "true" : "false") +
       ",\"acked\":" + (g_upd.acked ? "true" : "false") + "}";
  j += ",\"crash\":" + (g_crash.empty() ? std::string("null") : MapJson(g_crash)) + "}";
  return j;
}

static void SetUpd(const char *state, const std::string &error = "") {
  std::lock_guard<std::mutex> lk(g_mx);
  g_upd.state = state;
  g_upd.error = error;
}

// ── HTTPS (WinHTTP follows the redirect from github.com to the file storage) ──────────────────────
// redirect != nullptr: do not follow redirects, return the Location header instead
static bool HttpGet(const std::string &url, std::string &out, size_t maxSize, std::string &err,
                    std::string *redirect = nullptr) {
  out.clear();
  std::wstring wurl = Widen(url);
  URL_COMPONENTS uc{};
  uc.dwStructSize = sizeof(uc);
  wchar_t host[256], path[2048];
  uc.lpszHostName = host; uc.dwHostNameLength = 256;
  uc.lpszUrlPath = path; uc.dwUrlPathLength = 2048;
#ifdef BETTERDT_TEST_BASE
  const bool secure = wurl.compare(0, 8, L"https://") == 0;   // test build may use http://127.0.0.1
  if (!WinHttpCrackUrl(wurl.c_str(), 0, 0, &uc)) { err = "bad url"; return false; }
#else
  const bool secure = true;
  if (!WinHttpCrackUrl(wurl.c_str(), 0, 0, &uc) || uc.nScheme != INTERNET_SCHEME_HTTPS) { err = "bad url"; return false; }
#endif
  HINTERNET s = WinHttpOpen(L"BetterDT/" WIDE(BETTERDT_VERSION), WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, nullptr, nullptr, 0);
  if (!s) s = WinHttpOpen(L"BetterDT/" WIDE(BETTERDT_VERSION), WINHTTP_ACCESS_TYPE_DEFAULT_PROXY, nullptr, nullptr, 0);
  if (!s) { err = "WinHttpOpen " + std::to_string(GetLastError()); return false; }
  WinHttpSetTimeouts(s, 10000, 10000, 15000, 30000);
  bool ok = false;
  HINTERNET c = WinHttpConnect(s, host, uc.nPort, 0);
  HINTERNET r = c ? WinHttpOpenRequest(c, L"GET", path, nullptr, WINHTTP_NO_REFERER, WINHTTP_DEFAULT_ACCEPT_TYPES, secure ? WINHTTP_FLAG_SECURE : 0) : nullptr;
  if (r && redirect) {
    DWORD off = WINHTTP_DISABLE_REDIRECTS;
    WinHttpSetOption(r, WINHTTP_OPTION_DISABLE_FEATURE, &off, sizeof(off));
  }
  if (r && WinHttpSendRequest(r, WINHTTP_NO_ADDITIONAL_HEADERS, 0, WINHTTP_NO_REQUEST_DATA, 0, 0, 0) &&
      WinHttpReceiveResponse(r, nullptr)) {
    DWORD status = 0, sz = sizeof(status);
    WinHttpQueryHeaders(r, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, nullptr, &status, &sz, nullptr);
    if (redirect && status >= 301 && status <= 308) {
      wchar_t loc[2048];
      DWORD lsz = sizeof(loc);
      if (WinHttpQueryHeaders(r, WINHTTP_QUERY_LOCATION, nullptr, loc, &lsz, nullptr)) {
        *redirect = Narrow(std::wstring(loc, lsz / sizeof(wchar_t)));
        ok = true;
      } else err = "no location";
    } else if (status == 200) {
      ok = true;
      for (;;) {
        DWORD avail = 0;
        if (!WinHttpQueryDataAvailable(r, &avail)) { ok = false; err = "read " + std::to_string(GetLastError()); break; }
        if (!avail) break;
        if (out.size() + avail > maxSize) { ok = false; err = "too large"; break; }
        size_t at = out.size();
        out.resize(at + avail);
        DWORD got = 0;
        if (!WinHttpReadData(r, &out[at], avail, &got)) { ok = false; err = "read " + std::to_string(GetLastError()); break; }
        out.resize(at + got);
      }
    } else err = "HTTP " + std::to_string(status);
  } else err = "network " + std::to_string(GetLastError());
  if (r) WinHttpCloseHandle(r);
  if (c) WinHttpCloseHandle(c);
  WinHttpCloseHandle(s);
  return ok;
}

static bool NewerThan(const std::string &a, const std::string &b) {   // a > b ("1.2.3")
  int x[3] = {}, y[3] = {};
  sscanf(a.c_str(), "%d.%d.%d", &x[0], &x[1], &x[2]);
  sscanf(b.c_str(), "%d.%d.%d", &y[0], &y[1], &y[2]);
  for (int i = 0; i < 3; i++) if (x[i] != y[i]) return x[i] > y[i];
  return false;
}

// ── release: one asset, BetterDT.zip ──────────────────────────────────────────────────────────────
// The same zip players extract by hand. It is uncompressed ("stored", made by package.ps1), so it is read
// without an inflate library; every entry is checked against its CRC-32. mods/betterdt-version.txt:
//   betterdt-manifest 2
//   version 0.2.1
//   change 0.2.1 <line of release notes>          (the whole history from CHANGES.txt, newest first)
//   note <line of release notes>                  (for BetterDT up to 0.3.1, which only reads these)
//   mods betterdt-settings.js os-perf.js …        (official order in mods.json)
struct Manifest {
  std::string version, notes;
  std::vector<std::pair<std::string, std::string>> changes;   // version, note
  std::vector<std::string> mods;
};
struct ZipEntry { std::string name, data; };
static const char kZipAsset[] = "BetterDT.zip";
// the same zip under a second name, so GitHub counts updates apart from manual downloads (0.3.7+)
static const char kUpdateAsset[] = "BetterDT-update.zip";
static const char kManifestEntry[] = "mods/betterdt-version.txt";

static uint32_t Crc32(const std::string &d) {
  static uint32_t t[256];
  if (!t[1]) for (uint32_t i = 0; i < 256; i++) {
    uint32_t c = i;
    for (int k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
    t[i] = c;
  }
  uint32_t c = 0xFFFFFFFFu;
  for (unsigned char b : d) c = t[(c ^ b) & 255] ^ (c >> 8);
  return c ^ 0xFFFFFFFFu;
}

static uint32_t Le(const std::string &z, size_t at, int bytes) {
  uint32_t v = 0;
  for (int i = bytes - 1; i >= 0; i--) v = v << 8 | (unsigned char)z[at + i];
  return v;
}

static bool ReadStoredZip(const std::string &z, std::vector<ZipEntry> &out, std::string &err) {
  err = "bad zip";
  if (z.size() < 22) return false;
  size_t eocd = std::string::npos;
  for (size_t i = z.size() - 22, stop = z.size() > 65557 ? z.size() - 65557 : 0;; i--) {
    if (Le(z, i, 4) == 0x06054b50) { eocd = i; break; }
    if (i == stop) break;
  }
  if (eocd == std::string::npos) return false;
  size_t count = Le(z, eocd + 10, 2), p = Le(z, eocd + 16, 4);
  for (size_t n = 0; n < count; n++) {
    if (p + 46 > z.size() || Le(z, p, 4) != 0x02014b50) return false;
    uint32_t flags = Le(z, p + 8, 2), method = Le(z, p + 10, 2), crc = Le(z, p + 16, 4);
    size_t csize = Le(z, p + 20, 4), usize = Le(z, p + 24, 4), nlen = Le(z, p + 28, 2);
    size_t skip = nlen + Le(z, p + 30, 2) + Le(z, p + 32, 2), local = Le(z, p + 42, 4);
    if (p + 46 + nlen > z.size()) return false;
    std::string name = z.substr(p + 46, nlen);
    p += 46 + skip;
    if (!name.empty() && name.back() == '/') continue;   // folder
    if ((flags & 1) || method != 0 || csize != usize) { err = "compressed zip entry " + name; return false; }
    if (local + 30 > z.size() || Le(z, local, 4) != 0x04034b50) return false;
    size_t data = local + 30 + Le(z, local + 26, 2) + Le(z, local + 28, 2);
    if (data + usize > z.size()) return false;
    ZipEntry e{ name, z.substr(data, usize) };
    if (Crc32(e.data) != crc) { err = "CRC " + name; return false; }
    out.push_back(std::move(e));
  }
  err.clear();
  return true;
}

static bool ParseManifest(const std::string &text, Manifest &m, std::string &err) {
  bool magic = false;
  size_t p = 0;
  while (p < text.size()) {
    size_t e = text.find('\n', p);
    if (e == std::string::npos) e = text.size();
    std::string line = text.substr(p, e - p);
    p = e + 1;
    while (!line.empty() && (line.back() == '\r' || line.back() == ' ')) line.pop_back();
    if (line.empty() || line[0] == '#') continue;
    size_t sp = line.find(' ');
    std::string cmd = line.substr(0, sp), rest = sp == std::string::npos ? "" : line.substr(sp + 1);
    if (cmd == "betterdt-manifest") magic = rest == "2";
    else if (cmd == "version") m.version = rest;
    else if (cmd == "note") m.notes += (m.notes.empty() ? "" : "\n") + rest;
    else if (cmd == "change") {
      size_t s = rest.find(' ');
      if (s != std::string::npos && s + 1 < rest.size()) m.changes.emplace_back(rest.substr(0, s), rest.substr(s + 1));
    }
    else if (cmd == "mods") {
      for (size_t i = 0; i < rest.size();) {
        size_t j = rest.find(' ', i);
        if (j == std::string::npos) j = rest.size();
        std::string n = rest.substr(i, j - i);
        if (ValidModName(n)) m.mods.push_back(n);
        i = j + 1;
      }
    }
  }
  if (!magic || m.version.empty()) { err = "invalid manifest"; return false; }
  return true;
}

// release notes of every version newer than the installed one (newest first, "0.3.1: …" when there are
// several versions; at most 12 lines); the plain "note" lines when the zip has no history
static std::string ChangesSince(const Manifest &m, const std::string &installed) {
  std::vector<std::pair<std::string, std::string>> news;
  for (auto &c : m.changes) if (NewerThan(c.first, installed) && !NewerThan(c.first, m.version)) news.push_back(c);
  if (news.empty()) return m.notes;
  bool multi = false;
  for (auto &c : news) if (c.first != news[0].first) multi = true;
  std::string out;
  const size_t kMax = 12;
  for (size_t i = 0; i < news.size() && i < kMax; i++)
    out += (out.empty() ? "" : "\n") + (multi ? news[i].first + ": " : std::string()) + news[i].second;
  if (news.size() > kMax) out += "\n…";
  return out;
}

static std::string ReleaseUrl(const std::string &tail) {
#ifdef BETTERDT_TEST_BASE
  return BETTERDT_TEST_BASE + tail;
#endif
  return std::string("https://github.com/") + kRepo + "/releases/" + tail;
}

// Where a zip entry is installed; empty = skipped (mods.json is merged, the manifest is only read).
static std::wstring EntryDest(const std::string &name) {
  if (name == "BetterDT_x64.ext.dll") return g_gameDir + L"BetterDT_x64.ext.dll";
  if (name == "BetterDT-INSTALL.txt") return g_gameDir + L"BetterDT-INSTALL.txt";
  if (name.compare(0, 5, "mods/") == 0 && ValidModName(name.substr(5))) return g_modsDir + Widen(name.substr(5));
  return L"";
}

// Installs the files of a downloaded and verified zip. They take effect after a restart.
static bool InstallRelease(const Manifest &m, const std::vector<ZipEntry> &zip) {
  std::wstring stage = g_modsDir + L".update\\";
  CreateDirectoryW(stage.c_str(), nullptr);
  const std::wstring dllPath = g_gameDir + L"BetterDT_x64.ext.dll";
  std::vector<std::pair<std::wstring, std::wstring>> staged;   // temp file -> destination
  bool dll = false;
  for (const ZipEntry &e : zip) {
    std::wstring dest = EntryDest(e.name);
    if (dest.empty()) continue;
    std::string flat = e.name;
    for (char &c : flat) if (c == '/') c = '_';
    std::wstring tmp = stage + Widen(flat);
    if (!WriteFileAtomic(tmp, e.data)) { SetUpd("error", "write " + e.name); return false; }
    staged.push_back({ tmp, dest });
    dll |= dest == dllPath;
  }
  if (!dll) { SetUpd("error", "the zip has no DLL"); return false; }
  // everything is written → replace
  for (auto &sf : staged) {
    if (sf.second == dllPath) {
      // a loaded DLL cannot be overwritten but can be renamed; the old one is deleted on the next start
      // (.old extension so that Construct does not load it as an extension)
      std::wstring old = g_gameDir + L"BetterDT_x64.old";
      DeleteFileW(old.c_str());
      if (!MoveFileExW(g_selfPath.c_str(), old.c_str(), MOVEFILE_REPLACE_EXISTING)) {
        Log("update: cannot rename the DLL (%lu)", GetLastError());
        SetUpd("error", "replace dll");
        return false;
      }
    }
    if (!MoveFileExW(sf.first.c_str(), sf.second.c_str(), MOVEFILE_REPLACE_EXISTING | MOVEFILE_COPY_ALLOWED)) {
      Log("update: cannot replace %ls (%lu)", sf.second.c_str(), GetLastError());
      SetUpd("error", "replace " + Narrow(sf.second));
      return false;
    }
    Log("update: %ls", sf.second.c_str());
  }
  RemoveDirectoryW(stage.c_str());
  // mods.json: official mods in release order + the player's own mods that were already listed
  if (!m.mods.empty()) {
    std::vector<std::string> list = m.mods;
    for (const std::string &n : ModList()) {
      bool have = false;
      for (auto &x : list) have |= x == n;
      if (!have) list.push_back(n);
    }
    std::string json = "[";
    for (size_t i = 0; i < list.size(); i++) json += (i ? ", " : "") + JsonStr(list[i]);
    WriteFileAtomic(g_modsDir + L"mods.json", json + "]");
  }
  SetUpd("installed");
  Log("update to %s installed (takes effect after restarting the game)", m.version.c_str());
  return true;
}

// Checks the latest release (github.com/…/releases/latest redirects to …/releases/tag/v<version>);
// when it is newer, downloads the zip and installs it (it takes effect after a restart).
static void RunUpdate() {
  std::string body, loc, err;
  if (!HttpGet(ReleaseUrl("latest"), body, 1024 * 1024, err, &loc)) {
    Log("update: cannot check the latest release (%s)", err.c_str());
    SetUpd("error", err);
    return;
  }
  size_t t = loc.rfind("/tag/v");
  std::string latest = t == std::string::npos ? "" : loc.substr(t + 6);
  if (latest.empty() || latest.find_first_not_of("0123456789.") != std::string::npos) {
    Log("update: no release found (%s)", loc.c_str());
    SetUpd("error", "no public release");
    return;
  }
  {
    std::lock_guard<std::mutex> lk(g_mx);
    g_upd.latest = latest;
    g_upd.checkedAt = (long long)time(nullptr);
  }
  if (!NewerThan(latest, BETTERDT_VERSION)) {
    SetUpd("uptodate");
    Log("update: up to date (%s)", latest.c_str());
    return;
  }
  Log("update: %s available", latest.c_str());
  SetUpd("downloading");
  std::string zipData;
  std::vector<ZipEntry> zip;
  if (!HttpGet(ReleaseUrl("download/v" + latest + "/" + kUpdateAsset), zipData, kMaxAsset, err) &&
      !HttpGet(ReleaseUrl("download/v" + latest + "/" + kZipAsset), zipData, kMaxAsset, err)) {
    Log("update: cannot download %s (%s)", kUpdateAsset, err.c_str());
    SetUpd("error", "download: " + err);
    return;
  }
  if (!ReadStoredZip(zipData, zip, err)) { Log("update: %s", err.c_str()); SetUpd("error", err); return; }
  Manifest m;
  const ZipEntry *man = nullptr;
  for (auto &e : zip) if (e.name == kManifestEntry) man = &e;
  if (!man || !ParseManifest(man->data, m, err) || m.version != latest) {
    Log("update: the zip has no valid %s", kManifestEntry);
    SetUpd("error", "invalid release zip");
    return;
  }
  {
    std::lock_guard<std::mutex> lk(g_mx);
    g_upd.notes = ChangesSince(m, BETTERDT_VERSION);
  }
  SetUpd("available");
  // the running game keeps the mods it started with: replace the files only after the script with the
  // mods has been built, so old and new files are never mixed (the new version starts after a restart)
  SetUpd("downloading");
  for (int i = 0; i < 600 && !g_scriptBuilt; i++) Sleep(200);
  InstallRelease(m, zip);
}

static DWORD WINAPI UpdateThread(LPVOID p) {
  RunUpdate();
  std::lock_guard<std::mutex> lk(g_mx);
  g_upd.busy = false;
  return 0;
}
static void StartUpdate() {
  {
    std::lock_guard<std::mutex> lk(g_mx);
    if (g_upd.busy || g_upd.state == "installed") return;   // running, or waiting for a restart
    g_upd.busy = true;
    g_upd.state = "checking";
    g_upd.error.clear();
  }
  HANDLE t = CreateThread(nullptr, 0, UpdateThread, nullptr, 0, nullptr);
  if (t) CloseHandle(t);
  else { std::lock_guard<std::mutex> lk(g_mx); g_upd.busy = false; g_upd.state = "error"; g_upd.error = "thread"; }
}

// ── restart of the whole game ────────────────────────────────────────────────────────────────────
// We start the exe again right away (it inherits the environment Steam gave the game, so it stays
// connected to Steam) with BETTERDT_WAIT_PID set, and close this instance. The new instance waits in
// WaitForPreviousInstance until this process and its WebView2 browser process are gone, because it needs
// the browser profile they hold. No helper process or script is involved.
static const wchar_t kWaitVar[] = L"BETTERDT_WAIT_PID";

static BOOL CALLBACK CloseOwnWindow(HWND w, LPARAM) {
  DWORD pid = 0;
  GetWindowThreadProcessId(w, &pid);
  if (pid == GetCurrentProcessId() && IsWindowVisible(w)) PostMessageW(w, WM_CLOSE, 0, 0);
  return TRUE;
}

static bool RestartGame() {
  wchar_t buf[MAX_PATH];
  DWORD n = GetModuleFileNameW(nullptr, buf, MAX_PATH);
  std::wstring exe(buf, n), dir = exe.substr(0, exe.find_last_of(L"\\/"));
  std::wstring cmd = L"\"" + exe + L"\"";
  SetEnvironmentVariableW(kWaitVar, std::to_wstring(GetCurrentProcessId()).c_str());
  STARTUPINFOW si{ sizeof(si) };
  PROCESS_INFORMATION pi{};
  BOOL ok = CreateProcessW(exe.c_str(), &cmd[0], nullptr, nullptr, FALSE, 0, nullptr, dir.c_str(), &si, &pi);
  SetEnvironmentVariableW(kWaitVar, nullptr);
  if (!ok) { Log("restart: cannot start the game (%lu)", GetLastError()); return false; }
  CloseHandle(pi.hThread);
  CloseHandle(pi.hProcess);
  Log("restart: new instance started, closing this one");
  // close the game like its window's close button would; end it if it is still running after 10 s
  EnumWindows(CloseOwnWindow, 0);
  HANDLE t = CreateThread(nullptr, 0, [](LPVOID) -> DWORD {
    Sleep(10000);
    Log("restart: the game did not close, ending it");
    TerminateProcess(GetCurrentProcess(), 0);
    return 0;
  }, nullptr, 0, nullptr);
  if (t) CloseHandle(t);
  return true;
}

// In the instance started by RestartGame: wait (max 20 s) until the previous game process and the
// WebView2 processes it started have exited. Called before the WebView2 environment is created.
static void WaitForPreviousInstance() {
  wchar_t v[16];
  DWORD len = GetEnvironmentVariableW(kWaitVar, v, 16);
  if (!len || len >= 16) return;
  SetEnvironmentVariableW(kWaitVar, nullptr);
  DWORD pid = wcstoul(v, nullptr, 10);
  ULONGLONG start = GetTickCount64();
  if (HANDLE h = OpenProcess(SYNCHRONIZE, FALSE, pid)) {
    WaitForSingleObject(h, 15000);
    CloseHandle(h);
  }
  for (;;) {   // the browser process (msedgewebview2.exe, child of the old game) closes the rest
    bool child = false;
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap != INVALID_HANDLE_VALUE) {
      PROCESSENTRY32W pe{ sizeof(pe) };
      for (BOOL more = Process32FirstW(snap, &pe); more; more = Process32NextW(snap, &pe))
        if (pe.th32ParentProcessID == pid && _wcsicmp(pe.szExeFile, L"msedgewebview2.exe") == 0) child = true;
      CloseHandle(snap);
    }
    if (!child || GetTickCount64() - start > 20000) break;
    Sleep(200);
  }
  Log("restart: waited %llu ms for the previous instance", GetTickCount64() - start);
}

// ── crashes of the game page (white screen with a sad face) ──────────────────────────────────────────
// WebView2 reports a crashed or killed page process through ProcessFailed. The game does not handle it and
// shows Chromium's white error page. We log the details, reload the page (the game starts again at the main
// menu, the saves are on disk) and the settings mod tells the player and offers a prefilled bug report.
// The last crash is kept in mods\betterdt-crash.txt until the player closes that dialog, so it also
// survives a restart of the whole game (when the browser process itself died).
static ComPtr<ICoreWebView2Environment> g_env;
static ComPtr<ICoreWebView2> g_wv;
static std::map<std::string, std::string> g_beat;   // last state reported by the page (every 15 s)
static std::vector<long long> g_crashTimes;          // reloads in this session (protection against a loop)
static int g_gpuExits;

static const char *KindName(int k) {
  static const char *n[] = { "browser process exited", "page process exited", "page not responding",
    "frame process exited", "utility process exited", "sandbox helper exited", "GPU process exited",
    "plugin process exited", "plugin broker exited", "unknown process exited" };
  return k >= 0 && k < 10 ? n[k] : "?";
}
static const char *ReasonName(int r) {
  static const char *n[] = { "unexpected", "unresponsive", "terminated", "crashed", "launch failed",
    "out of memory", "profile deleted" };
  return r >= 0 && r < 7 ? n[r] : "?";
}

static void SaveCrashLocked() {
  std::string text;
  for (auto &kv : g_crash) text += kv.first + "=" + kv.second + "\n";
  WriteFileAtomic(g_modsDir + L"betterdt-crash.txt", text);
}
static void LoadCrash() {
  std::string text;
  std::lock_guard<std::mutex> lk(g_mx);
  if (ReadFileUtf8(g_modsDir + L"betterdt-crash.txt", text)) ParseIni(text, g_crash);
}

static HRESULT OnProcessFailed(ICoreWebView2 *wv, ICoreWebView2ProcessFailedEventArgs *a) {
  COREWEBVIEW2_PROCESS_FAILED_KIND kind = COREWEBVIEW2_PROCESS_FAILED_KIND_UNKNOWN_PROCESS_EXITED;
  COREWEBVIEW2_PROCESS_FAILED_REASON reason = COREWEBVIEW2_PROCESS_FAILED_REASON_UNEXPECTED;
  int exitCode = 0;
  std::string desc;
  a->get_ProcessFailedKind(&kind);
  ComPtr<ICoreWebView2ProcessFailedEventArgs2> a2;
  if (SUCCEEDED(a->QueryInterface(IID_PPV_ARGS(&a2)))) {
    a2->get_Reason(&reason);
    a2->get_ExitCode(&exitCode);
    LPWSTR d = nullptr;
    if (SUCCEEDED(a2->get_ProcessDescription(&d)) && d) { desc = Narrow(d); CoTaskMemFree(d); }
  }
  MEMORYSTATUSEX ms{ sizeof(ms) };
  GlobalMemoryStatusEx(&ms);
  char code[16];
  sprintf(code, "0x%08X", (unsigned)exitCode);
  Log("process failed: %s, reason: %s, exit code %s%s%s; memory in use %lu %%, %llu MB free",
      KindName(kind), ReasonName(reason), code, desc.empty() ? "" : ", ", desc.c_str(),
      ms.dwMemoryLoad, (unsigned long long)(ms.ullAvailPhys >> 20));
  if (kind == COREWEBVIEW2_PROCESS_FAILED_KIND_GPU_PROCESS_EXITED) { g_gpuExits++; return S_OK; }   // restarts by itself
  const bool page = kind == COREWEBVIEW2_PROCESS_FAILED_KIND_RENDER_PROCESS_EXITED;
  const bool browser = kind == COREWEBVIEW2_PROCESS_FAILED_KIND_BROWSER_PROCESS_EXITED;
  if (!page && !browser) return S_OK;   // a hanging page or a helper process: log only

  long long now = (long long)time(nullptr);
  std::vector<long long> recent;
  for (long long t : g_crashTimes) if (now - t < 600) recent.push_back(t);
  recent.push_back(now);
  g_crashTimes = recent;
  {
    std::lock_guard<std::mutex> lk(g_mx);
    g_crash = g_beat;   // layout, day, year, heap, dom, game, mods
    g_crash["kind"] = KindName(kind);
    g_crash["reason"] = ReasonName(reason);
    g_crash["exitCode"] = code;
    g_crash["process"] = desc;
    g_crash["at"] = std::to_string(now);
    g_crash["uptime"] = std::to_string((GetTickCount64() - g_t0) / 1000);
    g_crash["memoryLoad"] = std::to_string(ms.dwMemoryLoad);
    g_crash["freeMB"] = std::to_string(ms.ullAvailPhys >> 20);
    g_crash["gpuRestarts"] = std::to_string(g_gpuExits);
    g_crash["crashesInSession"] = std::to_string(g_crashTimes.size());
    SaveCrashLocked();
  }
  if (recent.size() > 3) { Log("more than 3 crashes within 10 minutes, not reloading again"); return S_OK; }
  if (page) {
    HRESULT hr = wv->Reload();
    Log("page reloaded (hr=0x%08lx)", hr);
  } else RestartGame();
  return S_OK;
}

// ── bug report (prefilled GitHub issue + clipboard) ────────────────────────────────────────────────
static std::string UrlEncode(const std::string &s) {
  static const char *hx = "0123456789ABCDEF";
  std::string o;
  for (unsigned char c : s) {
    if (isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') o += (char)c;
    else { o += '%'; o += hx[c >> 4]; o += hx[c & 15]; }
  }
  return o;
}

static std::string Field(const std::map<std::string, std::string> &m, const char *k, const char *def = "?") {
  auto it = m.find(k);
  return it == m.end() || it->second.empty() ? def : it->second;
}

static std::string SystemInfo() {
  std::string s;
  typedef LONG(WINAPI * RtlGetVersionFn)(OSVERSIONINFOW *);
  OSVERSIONINFOW ov{ sizeof(ov) };
  auto rgv = (RtlGetVersionFn)GetProcAddress(GetModuleHandleW(L"ntdll.dll"), "RtlGetVersion");
  if (rgv && rgv(&ov) == 0) s += "- Windows " + std::to_string(ov.dwMajorVersion) + "." + std::to_string(ov.dwMinorVersion) +
                                 " build " + std::to_string(ov.dwBuildNumber) + "\n";
  wchar_t cpu[256];
  DWORD sz = sizeof(cpu);
  if (RegGetValueW(HKEY_LOCAL_MACHINE, L"HARDWARE\\DESCRIPTION\\System\\CentralProcessor\\0", L"ProcessorNameString",
                   RRF_RT_REG_SZ, nullptr, cpu, &sz) == ERROR_SUCCESS) s += "- CPU: " + Narrow(cpu) + "\n";
  MEMORYSTATUSEX ms{ sizeof(ms) };
  GlobalMemoryStatusEx(&ms);
  s += "- RAM: " + std::to_string((ms.ullTotalPhys + (1ull << 29)) >> 30) + " GB\n";
  ComPtr<IDXGIFactory1> f;
  if (SUCCEEDED(CreateDXGIFactory1(IID_PPV_ARGS(&f)))) {
    for (UINT i = 0;; i++) {
      ComPtr<IDXGIAdapter1> ad;
      if (f->EnumAdapters1(i, &ad) != S_OK) break;
      DXGI_ADAPTER_DESC1 d{};
      ad->GetDesc1(&d);
      if (d.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) continue;
      LARGE_INTEGER v{};
      std::string drv = "?";
      if (SUCCEEDED(ad->CheckInterfaceSupport(__uuidof(IDXGIDevice), &v)))
        drv = std::to_string(HIWORD(v.HighPart)) + "." + std::to_string(LOWORD(v.HighPart)) + "." +
              std::to_string(HIWORD(v.LowPart)) + "." + std::to_string(LOWORD(v.LowPart));
      s += "- GPU: " + Narrow(d.Description) + ", driver " + drv + ", " +
           std::to_string(d.DedicatedVideoMemory >> 20) + " MB dedicated\n";
    }
  }
  ComPtr<ICoreWebView2Environment> env = g_env;
  LPWSTR bv = nullptr;
  if (env && SUCCEEDED(env->get_BrowserVersionString(&bv)) && bv) { s += "- WebView2 " + Narrow(bv) + "\n"; CoTaskMemFree(bv); }
  std::string pkg, game = "?";
  if (ReadFileUtf8(g_gameDir + L"package.json", pkg)) {
    size_t p = pkg.find("\"version\"");
    p = p == std::string::npos ? p : pkg.find('"', pkg.find(':', p));
    if (p != std::string::npos) game = pkg.substr(p + 1, pkg.find('"', p + 1) - p - 1);
  }
  s += "- Devices Tycoon " + game + ", BetterDT " BETTERDT_VERSION;
  s += std::string(", high-performance GPU switch ") + (IniOn("gpu", true) ? "on" : "off") + "\n- Mods:";
  for (const std::string &m : ModList()) if (ModEnabled(m)) s += " " + m;
  return s + "\n";
}

static void CopyToClipboard(const std::string &text) {
  std::wstring w = Widen(text);
  if (!OpenClipboard(nullptr)) return;
  EmptyClipboard();
  HGLOBAL h = GlobalAlloc(GMEM_MOVEABLE, (w.size() + 1) * sizeof(wchar_t));
  if (h) {
    memcpy(GlobalLock(h), w.c_str(), (w.size() + 1) * sizeof(wchar_t));
    GlobalUnlock(h);
    if (!SetClipboardData(CF_UNICODETEXT, h)) GlobalFree(h);
  }
  CloseClipboard();
}

// Copies the report to the clipboard (to paste it anywhere, e.g. into the Steam discussion) and opens
// a new GitHub issue with it. Nothing is sent without the player submitting the form.
static void OpenReport() {
  std::map<std::string, std::string> c;
  {
    std::lock_guard<std::mutex> lk(g_mx);
    c = g_crash;
  }
  long long up = atoll(Field(c, "uptime", "0").c_str());
  std::string title = "Game crash: " + Field(c, "kind") + " (" + Field(c, "reason") + ")";
  std::string body =
    "**What were you doing when it happened?**\n\n\n"
    "### Crash\n"
    "- " + Field(c, "kind") + ", reason: " + Field(c, "reason") + ", exit code " + Field(c, "exitCode") +
    (Field(c, "process", "").empty() ? "" : ", " + Field(c, "process")) + "\n"
    "- Screen: " + Field(c, "layout") + ", game day " + Field(c, "day") + " (year " + Field(c, "year") + ")\n"
    "- Played for " + std::to_string(up / 3600) + " h " + std::to_string(up / 60 % 60) + " min, crashes this session: " +
    Field(c, "crashesInSession") + ", GPU process restarts: " + Field(c, "gpuRestarts") + "\n"
    "- Memory in use: " + Field(c, "memoryLoad") + " % (" + Field(c, "freeMB") + " MB free), game JS heap " +
    Field(c, "heap") + " MB, page elements " + Field(c, "dom") + "\n\n"
    "### Versions\n"
    "- Devices Tycoon " + Field(c, "game") + ", BetterDT " BETTERDT_VERSION "\n"
    "- Mods not running: " + (Field(c, "mods", "").empty() ? std::string("none") : Field(c, "mods")) + "\n\n"
    "### System\n" + SystemInfo();
  CopyToClipboard(title + "\n\n" + body);
  std::string url = "https://github.com/" + std::string(kRepo) + "/issues/new?title=" + UrlEncode(title) + "&body=" + UrlEncode(body);
#ifdef BETTERDT_TEST_BASE
  Log("crash report (test build, not opened): %s", url.c_str());
#else
  ShellExecuteW(nullptr, L"open", Widen(url).c_str(), nullptr, nullptr, SW_SHOWNORMAL);
  Log("crash report opened");
#endif
}

// ── API for the page: https://betterdt.localhost/<command>?k=…&v=… ─────────────────────────────────
static std::string UrlDecode(const std::string &s) {
  std::string o;
  for (size_t i = 0; i < s.size(); i++) {
    if (s[i] == '+') o += ' ';
    else if (s[i] == '%' && i + 2 < s.size() && isxdigit((unsigned char)s[i + 1]) && isxdigit((unsigned char)s[i + 2])) {
      o += (char)strtol(s.substr(i + 1, 2).c_str(), nullptr, 16); i += 2;
    } else o += s[i];
  }
  return o;
}
static std::string QueryParam(const std::string &q, const std::string &name) {
  for (size_t i = 0; i < q.size();) {
    size_t j = q.find('&', i);
    if (j == std::string::npos) j = q.size();
    std::string part = q.substr(i, j - i);
    size_t eq = part.find('=');
    if (UrlDecode(part.substr(0, eq)) == name) return eq == std::string::npos ? "" : UrlDecode(part.substr(eq + 1));
    i = j + 1;
  }
  return "";
}

static std::string HandleApi(const std::string &cmd, const std::string &query, int &status) {
  status = 200;
  if (cmd == "state") return StateJson();
  if (cmd == "set") {
    std::string k = QueryParam(query, "k"), v = QueryParam(query, "v");
    if (!ValidKey(k) || v.size() > 200 || v.find_first_of("\r\n") != std::string::npos) { status = 400; return "{\"error\":\"bad key\"}"; }
    {
      std::lock_guard<std::mutex> lk(g_mx);
      g_ini[k] = v;
      SaveIniLocked();
    }
    Log("setting %s=%s", k.c_str(), v.c_str());
    return StateJson();
  }
  // "Check now" installs a newer version right away, like the check at start; "install" is the same (older menus)
  if (cmd == "check" || cmd == "install") { StartUpdate(); return StateJson(); }
  if (cmd == "update-ack") { { std::lock_guard<std::mutex> lk(g_mx); g_upd.acked = true; } return StateJson(); }
  if (cmd == "restart") return RestartGame() ? "{\"ok\":true}" : "{\"ok\":false}";
  if (cmd == "beat") {   // what the game is doing, for crash reports
    std::lock_guard<std::mutex> lk(g_mx);
    for (const char *k : { "layout", "day", "year", "heap", "dom", "game", "mods" }) {
      std::string v = QueryParam(query, k);
      if (v.size() > 200 || v.find_first_of("\r\n") != std::string::npos) v.clear();
      g_beat[k] = v;
    }
    return "{\"ok\":true}";
  }
  if (cmd == "crash-ack") {
    std::lock_guard<std::mutex> lk(g_mx);
    g_crash.clear();
    DeleteFileW((g_modsDir + L"betterdt-crash.txt").c_str());
    return "{\"ok\":true}";
  }
  if (cmd == "report") { OpenReport(); return "{\"ok\":true}"; }
  if (cmd == "open") {
    std::string what = QueryParam(query, "what");
    if (what == "folder") ShellExecuteW(nullptr, L"open", g_modsDir.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    else if (what == "log") ShellExecuteW(nullptr, L"open", (g_modsDir + L"betterdt.log").c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    else if (what == "discord") ShellExecuteW(nullptr, L"open", L"https://discord.gg/JdQEMNNTrN", nullptr, nullptr, SW_SHOWNORMAL);
    else if (what == "github") ShellExecuteW(nullptr, L"open", Widen(std::string("https://github.com/") + kRepo + "/releases").c_str(), nullptr, nullptr, SW_SHOWNORMAL);
    else { status = 400; return "{\"error\":\"bad target\"}"; }
    return "{\"ok\":true}";
  }
  status = 404;
  return "{\"error\":\"unknown\"}";
}

static void InstallApi(ICoreWebView2 *wv) {
  HRESULT hr = wv->AddWebResourceRequestedFilter(L"https://betterdt.localhost/*", COREWEBVIEW2_WEB_RESOURCE_CONTEXT_ALL);
  EventRegistrationToken tok{};
  wv->add_WebResourceRequested(Callback<ICoreWebView2WebResourceRequestedEventHandler>(
    [](ICoreWebView2 *, ICoreWebView2WebResourceRequestedEventArgs *args) -> HRESULT {
      ComPtr<ICoreWebView2WebResourceRequest> req;
      if (FAILED(args->get_Request(&req)) || !g_env) return S_OK;
      LPWSTR wuri = nullptr;
      req->get_Uri(&wuri);
      std::string uri = wuri ? Narrow(wuri) : "";
      if (wuri) CoTaskMemFree(wuri);
      const std::string base = "https://betterdt.localhost/";
      if (uri.compare(0, base.size(), base) != 0) return S_OK;
      // only the game page (reject other origins)
      ComPtr<ICoreWebView2HttpRequestHeaders> hdr;
      std::string origin;
      if (SUCCEEDED(req->get_Headers(&hdr)) && hdr) {
        LPWSTR o = nullptr;
        if (SUCCEEDED(hdr->GetHeader(L"Origin", &o)) && o) { origin = Narrow(o); CoTaskMemFree(o); }
      }
      std::string rest = uri.substr(base.size()), query;
      size_t qm = rest.find('?');
      if (qm != std::string::npos) { query = rest.substr(qm + 1); rest = rest.substr(0, qm); }
      int status = 403;
      std::string body = "{\"error\":\"origin\"}";
      const std::string app = "://app.localhost";
      if (origin.size() >= app.size() && origin.compare(origin.size() - app.size(), app.size(), app) == 0)
        body = HandleApi(rest, query, status);
      ComPtr<IStream> st;
      st.Attach(SHCreateMemStream((const BYTE *)body.data(), (UINT)body.size()));
      std::wstring headers = L"Content-Type: application/json; charset=utf-8\nCache-Control: no-store\n"
                             L"Access-Control-Allow-Origin: " + (origin.empty() ? std::wstring(L"null") : Widen(origin));
      ComPtr<ICoreWebView2WebResourceResponse> resp;
      g_env->CreateWebResourceResponse(st.Get(), status, status == 200 ? L"OK" : L"Error", headers.c_str(), &resp);
      if (resp) args->put_Response(resp.Get());
      return S_OK;
    }).Get(), &tok);
  Log("API https://betterdt.localhost/ (hr=0x%08lx)", hr);
  EventRegistrationToken t2{};
  wv->add_NavigationCompleted(Callback<ICoreWebView2NavigationCompletedEventHandler>(
    [](ICoreWebView2 *, ICoreWebView2NavigationCompletedEventArgs *a) -> HRESULT {
      BOOL ok = FALSE; COREWEBVIEW2_WEB_ERROR_STATUS st{}; a->get_IsSuccess(&ok); a->get_WebErrorStatus(&st);
      Log("page loaded (ok=%d, status=%d)", ok, (int)st); return S_OK; }).Get(), &t2);
  g_wv = wv;
  EventRegistrationToken t3{};
  hr = wv->add_ProcessFailed(Callback<ICoreWebView2ProcessFailedEventHandler>(OnProcessFailed).Get(), &t3);
  Log("crash handler (hr=0x%08lx)", hr);
}

// ── page script ────────────────────────────────────────────────────────────────────────────────
// Runs in every new document (only in the main game page).
static std::wstring BuildScript() {
  std::vector<std::string> mods = ModList();
  bool hasCore = false;
  for (auto &n : mods) hasCore |= n == kCoreMod;
  if (!hasCore) mods.insert(mods.begin(), kCoreMod);
  std::string modsJson = "[";
  for (size_t i = 0; i < mods.size(); i++)
    modsJson += std::string(i ? "," : "") + "{\"file\":" + JsonStr(mods[i]) + ",\"enabled\":" + (ModEnabled(mods[i]) ? "true" : "false") + "}";
  modsJson += "]";

  std::string js;
  js += "(() => {\n"
        "if (window.top !== window || location.hostname !== 'app.localhost') return;\n"
        "if (globalThis.BetterDT || (globalThis.DTMods && globalThis.DTMods.native)) return;\n"
        "const mods = [], names = new Set();\n"
        "const log = (...a) => console.log('[BetterDT]', ...a);\n"
        "const state = " + StateJson() + ";\n"
        "const settings = state.settings, listeners = new Set();\n"
        "const api = (cmd, q) => fetch('https://betterdt.localhost/' + cmd + (q ? '?' + new URLSearchParams(q) : ''), { cache: 'no-store' })\n"
        "  .then(r => r.json()).then(s => { if (s && s.settings) { Object.assign(state, s); state.settings = settings;\n"
        "    for (const k in s.settings) settings[k] = s.settings[k]; } return s; });\n"
        "const S = Object.freeze({\n"
        "  get(k, def) { return Object.prototype.hasOwnProperty.call(settings, k) ? settings[k] : def; },\n"
        "  bool(k, def) { const v = S.get(k); return v === undefined ? !!def : !/^(0|false|off|no)$/i.test(String(v)); },\n"
        "  num(k, def) { const v = S.get(k); const n = Number(v); return v === undefined || v === '' || !Number.isFinite(n) ? def : n; },\n"
        "  set(k, v) { v = typeof v === 'boolean' ? (v ? '1' : '0') : String(v); settings[k] = v;\n"
        "    for (const f of listeners) { try { f(k, v); } catch (e) { console.error(e); } }\n"
        "    return api('set', { k, v }); },\n"
        "  onChange(f) { listeners.add(f); return () => listeners.delete(f); },\n"
        "});\n"
        "const B = Object.freeze({\n"
        "  native: true, version: " + JsonStr(BETTERDT_VERSION) + ", repo: " + JsonStr(kRepo) + ",\n"
        "  mods: Object.freeze(" + modsJson + "),\n"
        "  settings: S, state, api,\n"
        "  register(name, init) { if (names.has(name)) return; names.add(name); mods.push({ name, init }); },\n"
        "  log,\n"
        "});\n"
        // the old loader from assets.dat (dtmod install) would overwrite DTMods and load the mods twice →
        // the objects are read-only and register ignores a name it has already seen
        "Object.defineProperty(globalThis, 'BetterDT', { value: B, writable: false, configurable: false });\n"
        "Object.defineProperty(globalThis, 'DTMods', { value: B, writable: false, configurable: false });\n"
        "api('state').catch(() => {});\n";
  int loaded = 0;
  for (const std::string &name : mods) {
    if (!ModEnabled(name)) { Log("mod %s: disabled", name.c_str()); continue; }
    std::string code;
    if (!ReadFileUtf8(g_modsDir + Widen(name), code)) {
      Log("mod %s: cannot read the file", name.c_str());
      js += "console.error('[BetterDT] cannot load " + name + "');\n";
      continue;
    }
    Log("mod %s: %zu B", name.c_str(), code.size());
    loaded++;
    js += "try { (function () {\n" + code + "\n})(); } catch (e) { console.error('[BetterDT] mod " + name +
          " failed while loading:', e); }\n";
  }
  js += "function startAll(rt) {\n"
        "  for (const m of mods) {\n"
        "    try { m.init(rt); log('started mod', m.name); }\n"
        "    catch (e) { console.error('[BetterDT] mod', m.name, 'failed:', e); }\n"
        "  }\n"
        "}\n"
        // rt.layout throws before the first layout is loaded → keep waiting
        "(function wait() { const rt = globalThis.runtime; let ok = false;\n"
        "  try { ok = !!(rt && rt.objects && rt.layout); } catch { }\n"
        "  if (ok) startAll(rt); else setTimeout(wait, 250); })();\n"
        "log('BetterDT " BETTERDT_VERSION " ready, mods: ' + mods.length);\n"
        "})();\n";
  Log("script: %d mods", loaded);
  return Widen(js);
}

// ── inject the script into the new webview ───────────────────────────────────────────────────────
static void Inject(ICoreWebView2Controller *ctl) {
  ComPtr<ICoreWebView2> wv;
  if (FAILED(ctl->get_CoreWebView2(&wv)) || !wv) { Log("get_CoreWebView2 selhalo"); return; }
  std::wstring script = BuildScript();
  g_scriptBuilt = true;
  HRESULT hr = wv->AddScriptToExecuteOnDocumentCreated(script.c_str(),
    Callback<ICoreWebView2AddScriptToExecuteOnDocumentCreatedCompletedHandler>(
      [](HRESULT hr, LPCWSTR) -> HRESULT { Log("script registered (hr=0x%08lx)", hr); return S_OK; }).Get());
  Log("AddScriptToExecuteOnDocumentCreated: hr=0x%08lx, %zu chars", hr, script.size());
}

// API only after the game wrapper: it has its own WebResourceRequested handler that runs for every
// request and overwrites the response of an earlier handler; the last registered one wins.
static void InjectApi(ICoreWebView2Controller *ctl) {
  ComPtr<ICoreWebView2> wv;
  if (SUCCEEDED(ctl->get_CoreWebView2(&wv)) && wv) InstallApi(wv.Get());
}

// ── hooks on controller creation (patched environment vtable entries) ─────────────────────────────
// The game may use any of the four methods (plain/composition controller, with or without options).
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
    ComPtr<ICoreWebView2Controller> ctl;
    if (SUCCEEDED(hr) && c && SUCCEEDED(c->QueryInterface(IID_PPV_ARGS(&ctl)))) Inject(ctl.Get());
    else Log("composition controller not created (hr=0x%08lx)", hr);
    HRESULT r = inner ? inner->Invoke(hr, c) : S_OK;
    if (ctl) InjectApi(ctl.Get());
    return r;
  });
}

static ComPtr<CtlHandler> WrapCtl(CtlHandler *h) {
  ComPtr<CtlHandler> inner(h);
  return Callback<CtlHandler>([inner](HRESULT hr, ICoreWebView2Controller *c) -> HRESULT {
    if (SUCCEEDED(hr) && c) Inject(c);
    else Log("controller not created (hr=0x%08lx)", hr);
    HRESULT r = inner ? inner->Invoke(hr, c) : S_OK;
    if (SUCCEEDED(hr) && c) InjectApi(c);
    return r;
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
  if (vt[idx] == repl) return;           // same class already patched
  DWORD old;
  VirtualProtect(&vt[idx], sizeof(void *), PAGE_READWRITE, &old);
  *orig = (T)vt[idx];
  vt[idx] = repl;
  VirtualProtect(&vt[idx], sizeof(void *), old, &old);
}

// ── graphics adapters (log only) ─────────────────────────────────────────────────────────────
// The switch does not pick a vendor: Chromium asks Windows (DXGI) for the "high performance" adapter.
// With a single GPU that is the one; with integrated + dedicated (NVIDIA/AMD/Intel Arc) the dedicated one.
static void LogAdapters() {
  ComPtr<IDXGIFactory6> f;
  if (FAILED(CreateDXGIFactory1(IID_PPV_ARGS(&f)))) { Log("DXGI: IDXGIFactory6 not available"); return; }
  for (UINT i = 0;; i++) {
    ComPtr<IDXGIAdapter1> a;
    if (f->EnumAdapterByGpuPreference(i, DXGI_GPU_PREFERENCE_HIGH_PERFORMANCE, IID_PPV_ARGS(&a)) != S_OK) break;
    DXGI_ADAPTER_DESC1 d{};
    a->GetDesc1(&d);
    if (d.Flags & DXGI_ADAPTER_FLAG_SOFTWARE) continue;
    Log("GPU %u: %ls (%llu MB dedicated memory)%s", i, d.Description,
        (unsigned long long)(d.DedicatedVideoMemory >> 20), i == 0 ? " <- high-performance choice" : "");
  }
}

// ── wrapper of CreateWebViewEnvironmentWithOptionsInternal (from EmbeddedBrowserWebView.dll) ─────────────
typedef HRESULT(STDAPICALLTYPE *CreateEnvFn)(bool, int, PCWSTR, IUnknown *, ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler *);
static CreateEnvFn g_realCreateEnv;

static HRESULT STDAPICALLTYPE HookCreateEnv(bool checkRunning, int runtimeType, PCWSTR userData, IUnknown *options,
                                           ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler *h) {
  Log("CreateWebViewEnvironmentWithOptionsInternal");
  WaitForPreviousInstance();
  LoadIni();
  LoadCrash();
  if (IniOn("autoupdate", true)) StartUpdate();
  else Log("automatic updates disabled");
  const bool gpu = IniOn("gpu", true);
  if (gpu) LogAdapters(); else Log("high-performance GPU disabled");
  ComPtr<ICoreWebView2EnvironmentOptions> opts;
  if (options && SUCCEEDED(options->QueryInterface(IID_PPV_ARGS(&opts))) && gpu) {
    LPWSTR cur = nullptr;
    opts->get_AdditionalBrowserArguments(&cur);
    std::wstring args = cur ? cur : L"";
    if (cur) CoTaskMemFree(cur);
    if (args.find(kGpuFlag) == std::wstring::npos) {
      args = std::wstring(kGpuFlag) + (args.empty() ? L"" : L" ") + args;
      HRESULT hr = opts->put_AdditionalBrowserArguments(args.c_str());
      Log("high-performance GPU switch added (hr=0x%08lx)", hr);
    }
  }
  ComPtr<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler> inner(h);
  auto wrapped = Callback<ICoreWebView2CreateCoreWebView2EnvironmentCompletedHandler>(
    [inner](HRESULT hr, ICoreWebView2Environment *env) -> HRESULT {
      if (SUCCEEDED(hr) && env) {
        g_env = env;
        PatchVtbl(env, VT_ENV_CREATE_CONTROLLER, (void *)HookCreateCtl, &g_origCreateCtl);
        ComPtr<ICoreWebView2Environment3> env3;
        if (SUCCEEDED(env->QueryInterface(IID_PPV_ARGS(&env3))))
          PatchVtbl(env3.Get(), VT_ENV3_CREATE_COMPOSITION, (void *)HookCreateComp, &g_origCreateComp);
        ComPtr<ICoreWebView2Environment10> env10;
        if (SUCCEEDED(env->QueryInterface(IID_PPV_ARGS(&env10)))) {
          PatchVtbl(env10.Get(), VT_ENV10_CREATE_CONTROLLER_OPT, (void *)HookCreateCtlOpt, &g_origCreateCtlOpt);
          PatchVtbl(env10.Get(), VT_ENV10_CREATE_COMPOSITION_OPT, (void *)HookCreateCompOpt, &g_origCreateCompOpt);
        }
        Log("WebView2 environment created, controller hooks installed");
      } else Log("WebView2 environment not created (hr=0x%08lx)", hr);
      return inner ? inner->Invoke(hr, env) : S_OK;
    });
  return g_realCreateEnv(checkRunning, runtimeType, userData, options, wrapped.Get());
}

// ── GetProcAddress in the exe's import table ───────────────────────────────────────────────────────
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

// ── Construct extension interface ────────────────────────────────────────────────────────────────
// The extension manager (WV2ExtManager.dll) calls WrapperExtInit(IApplication*) and keeps the returned
// object (null means no extension). It calls vtable methods on it (0 = Release, 2 = OnMainWindowCreated…).
// We register no component, so no messages arrive; methods that do nothing are enough.
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
  g_t0 = GetTickCount64();
  wchar_t path[MAX_PATH];
  DWORD n = GetModuleFileNameW(h, path, MAX_PATH);
  g_selfPath.assign(path, n);
  g_gameDir = g_selfPath.substr(0, g_selfPath.find_last_of(L"\\/") + 1);
  g_modsDir = g_gameDir + L"mods\\";
  DeleteFileW((g_modsDir + L"betterdt.log").c_str());
  DeleteFileW((g_gameDir + L"BetterDT_x64.old").c_str());     // leftover from an update
  // the previous loader (DTModLoader) would run next to us → disable it by renaming
  std::wstring old = g_gameDir + kOldDll;
  if (_wcsicmp(g_selfPath.c_str(), old.c_str()) != 0 && GetFileAttributesW(old.c_str()) != INVALID_FILE_ATTRIBUTES) {
    BOOL mv = MoveFileExW(old.c_str(), (g_gameDir + L"DTModLoader_x64.disabled").c_str(), MOVEFILE_REPLACE_EXISTING);
    Log("old DTModLoader %s", mv ? "disabled (renamed to .disabled)" : "cannot be renamed");
  }
  bool ok = PatchIat(GetModuleHandleW(nullptr), "KERNEL32.dll", "GetProcAddress", (void *)HookGpa, (void **)&g_realGpa);
  Log("BetterDT " BETTERDT_VERSION " loaded, GetProcAddress hook: %s", ok ? "yes" : "NO");
  return TRUE;
}

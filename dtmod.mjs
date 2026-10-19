#!/usr/bin/env node
// Devices Tycoon modding toolkit (Construct 3 / WebView2 export).
// Bez závislostí, stačí Node 18+.
//
//   node dtmod.mjs list    <assets.dat> [regex]
//   node dtmod.mjs unpack  <assets.dat> <výstupní složka> [regex]
//   node dtmod.mjs pack    <původní assets.dat> <složka s modem> <nový assets.dat>
//   node dtmod.mjs install <složka hry> <složka s modem>
//   node dtmod.mjs restore <složka hry>
//   node dtmod.mjs gpu     <složka hry> [on|off]   (kreslení na výkonné grafice u notebooků se 2 GPU)

import fs from 'node:fs';
import path from 'node:path';

// ---------- assets.dat ----------
// "c3ab" + 12 B hlavičky | "fdir" u64 délka | u32 počet | záznamy | "blob" u64 délka | data
// záznam: u64 0 | u64 offset | u64 velikost | u64 velikost | u8 0 | u32 délka jména | jméno (UTF-8)

function readBundle(file) {
  const fd = fs.openSync(file, 'r');
  const head = Buffer.alloc(32);
  fs.readSync(fd, head, 0, 32, 0);
  if (head.toString('latin1', 0, 4) !== 'c3ab' || head.toString('latin1', 16, 20) !== 'fdir')
    throw new Error(`${file}: není Construct asset bundle`);
  const dirLen = Number(head.readBigUInt64BE(20));
  const count = head.readUInt32BE(28);
  const dir = Buffer.alloc(dirLen - 4);
  fs.readSync(fd, dir, 0, dir.length, 32);
  const entries = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    const off = Number(dir.readBigUInt64BE(p + 8));
    const size = Number(dir.readBigUInt64BE(p + 16));
    const nameLen = dir.readUInt32BE(p + 33);
    const name = dir.toString('utf8', p + 37, p + 37 + nameLen);
    p += 37 + nameLen;
    entries.push({ name, off, size });
  }
  const blobHead = Buffer.alloc(12);
  fs.readSync(fd, blobHead, 0, 12, 32 + dir.length);
  if (blobHead.toString('latin1', 0, 4) !== 'blob') throw new Error('chybí sekce blob');
  return { fd, header: head.subarray(0, 16), entries, base: 32 + dir.length + 12 };
}

function readEntry(b, e) {
  const buf = Buffer.alloc(e.size);
  fs.readSync(b.fd, buf, 0, e.size, b.base + e.off);
  return buf;
}

function copyRange(srcFd, pos, len, dstFd) {
  const chunk = Buffer.alloc(Math.min(len, 8 << 20) || 1);
  while (len > 0) {
    const n = fs.readSync(srcFd, chunk, 0, Math.min(len, chunk.length), pos);
    fs.writeSync(dstFd, chunk, 0, n);
    pos += n; len -= n;
  }
}

function walk(dir, rel = '') {
  const out = [];
  for (const d of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = rel ? `${rel}/${d.name}` : d.name;
    if (d.isDirectory()) out.push(...walk(dir, r));
    else out.push(r);
  }
  return out;
}

const MARK = 'dtmod.json';
// Je balík už přebalený námi? (starší instalace značku nemají, ale mají loader)
function isModded(file) {
  const b = readBundle(file);
  fs.closeSync(b.fd);
  return b.entries.some(e => e.name === MARK || e.name === 'mods/loader.js');
}

function pack(origFile, modDir, outFile) {
  const b = readBundle(origFile);
  const overlay = new Map(walk(modDir).map(r => [r, path.join(modDir, r)]));
  const known = new Set(b.entries.map(e => e.name));
  const items = b.entries.map(e => overlay.has(e.name)
    ? { name: e.name, file: overlay.get(e.name), size: fs.statSync(overlay.get(e.name)).size }
    : { name: e.name, src: e, size: e.size });

  // Když mod obsahuje mods/loader.js a vlastní index.html ne, vložíme do původního
  // index.html jeden <script> před hlavní skript hry.
  if (overlay.has('mods/loader.js') && !overlay.has('index.html')) {
    const i = items.findIndex(it => it.name === 'index.html');
    const html = readEntry(b, b.entries[i]).toString('utf8');
    const tag = '<script src="mods/loader.js"></script>\n\t<script src="scripts/main.js" type="module">';
    const patched = html.replace('<script src="scripts/main.js" type="module">', tag);
    if (patched === html) throw new Error('index.html: nenašel jsem místo pro vložení loaderu');
    items[i] = { name: 'index.html', data: Buffer.from(patched, 'utf8') };
    items[i].size = items[i].data.length;
  }
  const added = [...overlay.keys()].filter(r => !known.has(r));
  for (const r of added) items.push({ name: r, file: overlay.get(r), size: fs.statSync(overlay.get(r)).size });
  // značka „tenhle balík je přebalený“: podle ní install/restore poznají, že Steam mezitím nahrál novou verzi
  if (!known.has(MARK) && !overlay.has(MARK)) {
    const data = Buffer.from(JSON.stringify({ tool: 'dtmod', baseSize: fs.statSync(origFile).size }));
    items.push({ name: MARK, data, size: data.length });
  }

  const recs = [];
  let off = 0;
  for (const it of items) {
    const name = Buffer.from(it.name, 'utf8');
    const rec = Buffer.alloc(37 + name.length);
    rec.writeBigUInt64BE(BigInt(off), 8);
    rec.writeBigUInt64BE(BigInt(it.size), 16);
    rec.writeBigUInt64BE(BigInt(it.size), 24);
    rec.writeUInt32BE(name.length, 33);
    name.copy(rec, 37);
    recs.push(rec);
    off += it.size;
  }
  const dir = Buffer.concat(recs);
  const fdirHead = Buffer.alloc(16);
  fdirHead.write('fdir', 0, 'latin1');
  fdirHead.writeBigUInt64BE(BigInt(dir.length + 4), 4);
  fdirHead.writeUInt32BE(items.length, 12);
  const blobHead = Buffer.alloc(12);
  blobHead.write('blob', 0, 'latin1');
  blobHead.writeBigUInt64BE(BigInt(off), 4);

  const tmp = outFile + '.tmp';
  const out = fs.openSync(tmp, 'w');
  for (const part of [b.header, fdirHead, dir, blobHead]) fs.writeSync(out, part);
  for (const it of items) {
    if (it.src) copyRange(b.fd, b.base + it.src.off, it.size, out);
    else fs.writeSync(out, it.data ?? fs.readFileSync(it.file));
  }
  fs.closeSync(out);
  fs.closeSync(b.fd);
  fs.renameSync(tmp, outFile);
  const replaced = items.filter(i => i.file).length - added.length;
  console.log(`zabaleno ${items.length} souborů (${replaced} nahrazeno, ${added.length} přidáno) → ${outFile}`);
  for (const r of added) console.log(`  + ${r}`);
}

// ---------- výkonná grafika ----------
// WebView2 jinak kreslí na úsporné integrované grafice. Přepínač Chromia patří do "chromium-args"
// v package.json vedle exe (kontrola hry tam odmítá jen přepínače pro DevTools/vzdálené ladění).
// Mění se jen tenhle jeden přepínač, takže vypnutí funguje i po aktualizaci hry (žádná stará záloha).
function setGpu(gameDir, on) {
  const pkg = path.join(gameDir, 'package.json');
  const FLAG = '--force_high_performance_gpu';
  const txt = fs.readFileSync(pkg, 'utf8');
  const m = txt.match(/("chromium-args"\s*:\s*")((?:[^"\\]|\\.)*)"/);
  if (!m) { console.error('v package.json chybí "chromium-args"'); process.exit(1); }
  const flags = m[2].split(/\s+/).filter(f => f && f !== FLAG);
  if (on) flags.unshift(FLAG);
  const next = txt.replace(m[0], () => m[1] + flags.join(' ') + '"');
  if (next === txt) { if (on) console.log('výkonná grafika už je zapnutá'); return; }
  if (on) { fs.copyFileSync(pkg, pkg + '.orig'); console.log(`záloha originálu: ${pkg}.orig`); }
  fs.writeFileSync(pkg, next);
  console.log(on ? 'zapnuta výkonná grafika (projeví se po novém spuštění hry)' : 'výkonná grafika vypnuta');
}

// ---------- příkazy ----------

const [cmd, ...args] = process.argv.slice(2);
const need = n => { if (args.length < n) { console.error('málo argumentů, viz hlavička dtmod.mjs'); process.exit(1); } };

switch (cmd) {
  case 'list': {
    need(1);
    const b = readBundle(args[0]);
    const re = args[1] ? new RegExp(args[1], 'i') : null;
    for (const e of b.entries) if (!re || re.test(e.name)) console.log(String(e.size).padStart(10), e.name);
    console.log(`${b.entries.length} souborů celkem`);
    break;
  }
  case 'unpack': {
    need(2);
    const b = readBundle(args[0]);
    const re = args[2] ? new RegExp(args[2], 'i') : null;
    let n = 0;
    for (const e of b.entries) {
      if (re && !re.test(e.name)) continue;
      const dst = path.join(args[1], e.name);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.writeFileSync(dst, readEntry(b, e));
      n++;
    }
    console.log(`rozbaleno ${n} souborů do ${args[1]}`);
    break;
  }
  case 'pack':
    need(3);
    pack(args[0], args[1], args[2]);
    break;
  case 'install': {
    need(2);
    const dat = path.join(args[0], 'www', 'assets.dat');
    const orig = dat + '.orig';
    // nepřebalený assets.dat = originál ze Steamu (první instalace nebo nová verze hry) → ten je nová záloha;
    // jinak by se balilo ze staré zálohy a hra by se vrátila na předchozí verzi
    if (!fs.existsSync(orig)) { fs.copyFileSync(dat, orig); console.log(`záloha originálu: ${orig}`); }
    else if (!isModded(dat)) { fs.copyFileSync(dat, orig); console.log(`nová verze hry, záloha aktualizována: ${orig}`); }
    pack(orig, args[1], dat);
    break;
  }
  case 'restore': {
    need(1);
    const dat = path.join(args[0], 'www', 'assets.dat');
    if (!isModded(dat)) console.log('assets.dat už je původní (třeba po aktualizaci hry), nic neměním');
    else if (!fs.existsSync(dat + '.orig')) { console.error('záloha assets.dat.orig neexistuje'); process.exit(1); }
    else { fs.copyFileSync(dat + '.orig', dat); console.log('obnoven původní assets.dat'); }
    setGpu(args[0], false);
    break;
  }
  case 'gpu':
    need(1);
    setGpu(args[0], (args[1] || 'on') !== 'off');
    break;
  default:
    console.error('příkazy: list, unpack, pack, install, restore, gpu');
    process.exit(1);
}

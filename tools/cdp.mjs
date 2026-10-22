// usage: node tools/cdp.mjs '<expression>' | --file <file.js> | --shot <file.png> | --click <x,y> | --key Escape  [--port 9222]
// Test copy only: evaluates in the game page over the local debugging port. A file is wrapped in an async function,
// so it can use await and return a value; `rt` is the runtime. --shot saves a screenshot of the page; --click sends a
// mouse click to the page at CSS pixels x, y and --key a key press (input events of the page only, the system cursor does not move).
import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : undefined;
const port = opt('--port') || '9222';
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find(t => t.type === 'page' && t.url.startsWith('https://app.localhost/'));
if (!page) { console.error('no game page'); process.exit(2); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
const send = (method, params) => new Promise((resolve) => {
  ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id === 1) resolve(d); };
  ws.send(JSON.stringify({ id: 1, method, params }));
});
if (opt('--shot')) {
  const d = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(opt('--shot'), Buffer.from(d.result.data, 'base64'));
  console.log('saved', opt('--shot'));
} else if (opt('--click')) {
  const [x, y] = opt('--click').split(',').map(Number);
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x, y, button: type === 'mouseMoved' ? 'none' : 'left', clickCount: 1 });
  console.log('clicked', x, y);
} else if (opt('--key')) {
  const key = opt('--key'), code = { Escape: 27, Enter: 13 }[key] || 0;
  for (const type of ['rawKeyDown', 'keyUp'])
    await send('Input.dispatchKeyEvent', { type, key, code: key, windowsVirtualKeyCode: code, nativeVirtualKeyCode: code });
  console.log('pressed', key);
} else {
  let expr = opt('--file') ? readFileSync(opt('--file'), 'utf8') : args[0];
  if (opt('--file')) expr = `(async () => { const rt = globalThis.runtime;\n${expr}\n})()`;
  const d = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  const r = d.result;
  if (r.exceptionDetails) { console.log('ERR ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text)); process.exitCode = 1; }
  else console.log(JSON.stringify(r.result.value, null, 1));
}
ws.close();

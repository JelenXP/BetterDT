import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
// runs a mod helper file (path from the repo root) and returns the global it defines
export function load(file, name) {
  vm.runInThisContext(readFileSync(ROOT + file, 'utf8'), { filename: file });
  return globalThis[name];
}

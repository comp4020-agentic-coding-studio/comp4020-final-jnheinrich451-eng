import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
const manifest = JSON.parse(await readFile(path.join(root, 'assets/used-assets.json'), 'utf8'));
const expected = new Set(['assets/README.md', 'assets/used-assets.json']);
const checkedPath = (value, prefix) => {
  if (typeof value !== 'string' || !value.startsWith(prefix) || value.includes('\\') || value.split('/').includes('..')) throw Error(`Invalid manifest path: ${value}`);
  return path.join(root, value);
};
for (const entry of manifest.files) {
  if (expected.has(entry.source)) throw Error(`Duplicate source: ${entry.source}`);
  expected.add(entry.source);
  const source = await readFile(checkedPath(entry.source, 'assets/'));
  const runtime = await readFile(checkedPath(entry.runtime, 'public/'));
  if (source.length !== entry.bytes || digest(source) !== entry.sha256) throw Error(`Source changed: ${entry.source}`);
  if (entry.relation === 'license') {
    if (source.toString().replace(/\s+/g, '') !== runtime.toString().replace(/\s+/g, '')) throw Error(`License text differs: ${entry.source}`);
  } else {
    if (digest(runtime) !== entry.runtimeSha256) throw Error(`Runtime hash differs: ${entry.runtime}`);
    if (entry.relation === 'copy' && !source.equals(runtime)) throw Error(`Copy differs: ${entry.source}`);
  }
}
const visible = new Set(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', 'assets']).split('\0').filter(Boolean));
for (const file of visible) if (!expected.has(file)) throw Error(`Unselected asset is visible to Git: ${file}`);
for (const file of expected) if (!visible.has(file)) throw Error(`Selected asset is ignored or missing: ${file}`);
console.log(`Verified ${manifest.files.length} source hashes and runtime/license mappings; exactly ${expected.size} assets/ files visible to Git.`);

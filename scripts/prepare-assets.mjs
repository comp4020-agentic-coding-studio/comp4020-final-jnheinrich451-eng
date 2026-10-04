import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pack = 'assets/2D assets/Topdown Tanks Remastered';
const output = path.join(root, 'public/assets/kenney');
const names = ['tileGrass1.png', 'tileGrass2.png', 'tileSand1.png', 'tileSand2.png', 'tankBody_sand.png', 'tankSand_barrel1.png', 'tankBody_dark.png', 'tankDark_barrel1.png', 'treeBrown_small.png', 'treeGreen_small.png', 'sandbagBeige.png'];
await mkdir(output, { recursive: true });
const files = [];
for (const name of names) {
  const source = `${pack}/PNG/Default size/${name}`;
  const bytes = await readFile(path.join(root, source));
  await copyFile(path.join(root, source), path.join(output, name));
  files.push({ file: name, source, sha256: createHash('sha256').update(bytes).digest('hex'), modified: false });
}
await copyFile(path.join(root, pack, 'License.txt'), path.join(output, 'LICENSE.txt'));
await writeFile(path.join(output, 'manifest.json'), JSON.stringify({ author: 'Kenney', pack: 'Topdown Tanks Remastered', license: 'CC0', source: 'https://kenney.nl/assets/topdown-tanks-redux', export: 'Byte-for-byte copy of selected default-size PNGs; run node scripts/prepare-assets.mjs with the local library present.', files }, null, 2) + '\n');
console.log(`Copied ${files.length} assets with license and hashes.`);

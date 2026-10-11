import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resetWorld } from '../world-maintenance.js';

const args = process.argv.slice(2);
if (args.length !== 3 || args[0] !== '--data-dir' || args[2] !== '--confirm-reset') {
  console.error('Usage: node scripts/reset-world.mjs --data-dir <directory> --confirm-reset\nStop the server first. This backs up and clears the LEGACY shared world and unlinked legacy guests. Named campaigns, accounts and linked identities remain; account sessions are signed out and invitation codes revoked.');
  process.exitCode = 1;
} else {
  const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const dataDir = path.resolve(root, args[1]);
  try {
    const saved = await resetWorld(dataDir);
    console.log(`Reset world: ${dataDir}\nBackup: ${saved}\nRestart Frontier and reload every client. Terrain uses the existing world template; progress starts fresh.`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

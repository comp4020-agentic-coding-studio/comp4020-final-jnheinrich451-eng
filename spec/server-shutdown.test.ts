import { expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { createApp } from '../server.js';

it('shuts down while a browser holds a spare socket open', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-shutdown-'));
  const app = createApp({ dataDir: dir, logSink: () => {} });
  try {
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', () => resolve()));
    const { port } = app.server.address() as net.AddressInfo;
    // Chrome opens sockets ahead of need, and this one never sends a request.
    const spare = net.connect(port, '127.0.0.1').on('error', () => {});
    await new Promise(resolve => spare.once('connect', resolve));
    const outcome = await Promise.race([app.close().then(() => 'closed'), new Promise(resolve => setTimeout(resolve, 5000, 'stalled'))]);
    spare.destroy();
    expect(outcome).toBe('closed');
  } finally {
    await app.close();
    await rm(dir, { recursive: true, force: true });
  }
});

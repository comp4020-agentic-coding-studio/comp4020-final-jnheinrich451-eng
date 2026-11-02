import { it, expect } from 'vitest';
import { mkdtemp, rm, open, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server.js';

it('streams the colony movie with correct bounded ranges, HEAD and rejected invalid ranges', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-media-'));
  const app = createApp({ dataDir: dir, logSink: () => {} });
  const file = path.resolve('public/assets/colony-cinema/big-buck-bunny.mp4');
  const size = (await stat(file)).size;
  const handle = await open(file, 'r');
  try {
    await new Promise<void>(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${(app.server.address() as any).port}`;
    const url = base + '/assets/colony-cinema/big-buck-bunny.mp4';
    const head = await fetch(url, { method: 'HEAD', headers: { Range: 'bytes=0-31' } });
    expect(head.status).toBe(200);
    expect(head.headers.get('content-type')).toBe('video/mp4');
    expect(head.headers.get('content-length')).toBe(String(size));
    expect(head.headers.get('accept-ranges')).toBe('bytes');
    expect(await head.text()).toBe('');
    for (const [range, start, end] of [
      ['bytes=0-31', 0, 31], ['bytes=-64', size - 64, size - 1],
      [`bytes=${size - 25}-`, size - 25, size - 1],
      [`bytes=${size - 20}-${size + 100}`, size - 20, size - 1],
    ] as [string, number, number][]) {
      const response = await fetch(url, { headers: { Range: range } });
      expect(response.status, range).toBe(206);
      expect(response.headers.get('content-range')).toBe(`bytes ${start}-${end}/${size}`);
      expect(response.headers.get('content-length')).toBe(String(end - start + 1));
      const expected = Buffer.alloc(end - start + 1); await handle.read(expected, 0, expected.length, start);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(expected);
    }
    for (const range of ['bytes=0-1,8-9', 'bytes=-0', 'bytes=-', 'bytes=10-2', `bytes=${size}-`, 'bytes=99999999999999999999-']) {
      const response = await fetch(url, { headers: { Range: range } });
      expect(response.status, range).toBe(416);
      expect(response.headers.get('content-range')).toBe(`bytes */${size}`);
      expect(await response.text()).toBe('');
    }
    // Starting a full-file request and closing it releases the source stream.
    const response = await fetch(url);
    expect(response.status).toBe(200); expect(response.headers.get('content-length')).toBe(String(size));
    await response.body?.cancel();
    const afterAbort = await fetch(url, { headers: { Range: 'bytes=0-3' } });
    expect(afterAbort.status).toBe(206); expect((await afterAbort.arrayBuffer()).byteLength).toBe(4);
    const credits = await fetch(base + '/assets/colony-cinema/CREDITS.txt');
    expect(await credits.text()).toContain('Creative Commons Attribution 3.0');
  } finally {
    await handle.close(); await app.close();
    if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-media-')) throw new Error('Unsafe fixture path');
    await rm(dir, { recursive: true, force: true });
  }
}, 30_000);

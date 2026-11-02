import { expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../../server.js';

// Observe the actual app-to-renderer boundary without a production debug API.
// The real renderer still runs. EventSource observation never edits a packet.
export async function observeColonyPresentation(page, baselineSource) {
  if (baselineSource) await page.route('**/colony-app.js', route => route.fulfill({ contentType: 'text/javascript', body: baselineSource }));
  await page.addInitScript(() => {
    window.colonyFrames = []; window.colonyPackets = [];
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', event => {
          const value = JSON.parse(event.data);
          if (value.colony) window.colonyPackets.push({ at: performance.now(), players: value.players, me: value.me, paused: value.room?.paused, time: value.colony.time });
        });
      }
    };
  });
  await page.route('**/colony-art.js', async route => {
    const response = await route.fetch();
    const source = (await response.text()).replace('export function createColonyRenderer(canvas)', 'function createObservedRenderer(canvas)');
    expect(source).toContain('function createObservedRenderer(canvas)');
    await route.fulfill({ response, body: source + `
export function createColonyRenderer(canvas) {
  const renderer = createObservedRenderer(canvas);
  return { ...renderer, draw(args) {
    window.colonyFrames.push({ at: performance.now(), packet: window.colonyPackets.length - 1,
      players: args.players.map(p => ({ id: p.id, x: p.x, y: p.y, vx: p.vx, vy: p.vy, walkPhase: p.walkPhase, walkAmount: p.walkAmount })),
      me: args.me?.id, camera: { ...args.camera }, time: args.time, reduced: args.reduced,
      environment: args.environment, ambientTime: args.ambientTime,
      movie: args.movie ? { time: args.movie.currentTime, paused: args.movie.paused, muted: args.movie.muted, ready: args.movie.readyState } : null });
    renderer.draw(args);
  } };
}` });
  });
}

export async function colonyFixture(browser, { reduced = false, viewport = { width: 1920, height: 1080 }, baselineSource } = {}) {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-colony-motion-'));
  const app = createApp({ dataDir: dir, logSink: () => {} });
  const contexts = [], errors = [];
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${app.server.address().port}`;
  const post = async (context, route, data) => {
    const response = await context.request.post(base + route, { data, headers: { Origin: base } });
    const value = await response.json(); expect(response.ok(), JSON.stringify(value)).toBe(true); return value;
  };
  const account = async name => {
    const context = await browser.newContext({ viewport, reducedMotion: reduced ? 'reduce' : 'no-preference' }); contexts.push(context);
    const credentials = { name, email: `${name.toLowerCase()}@frontier.test`, password: 'disposable colony motion password 123!', kind: 'demo' };
    await post(context, '/api/auth/register', credentials);
    const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
    await post(context, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
    await post(context, '/api/auth/login', credentials); return context;
  };
  const open = async context => {
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await observeColonyPresentation(page, baselineSource);
    await page.goto(base + entered.next);
    await expect(page.locator('#colony-loading')).toBeHidden();
    await expect(page.locator('#colony-connection')).toHaveText('Together, growing');
    return page;
  };
  const owner = await account('Aster');
  const campaign = await post(owner, '/api/campaigns/create', { name: 'Motion fixture', mode: 'colonization', template: 'morrow-v1' });
  const entered = await post(owner, '/api/campaigns/enter', { id: campaign.id });
  const page = await open(owner);
  return { page, owner, campaign, errors, account, open, post,
    world: async (context = owner) => (await context.request.get(`${base}/api/campaign-world/${campaign.id}/world`)).json(),
    close: async () => {
      await Promise.all(contexts.map(context => context.close())); await app.close();
      if (path.dirname(path.resolve(dir)) !== path.resolve(tmpdir()) || !path.basename(dir).startsWith('frontier-colony-motion-')) throw Error('Unsafe fixture directory');
      await rm(dir, { recursive: true, force: true });
    },
  };
}

export async function captureMovement(page, playerId, duration = 1800) {
  return page.evaluate(async ({ playerId, duration }) => {
    const start = performance.now();
    // Observation interval deliberately spans several 250 ms authoritative packets.
    await new Promise(resolve => setTimeout(resolve, duration));
    const frames = window.colonyFrames.filter(f => f.at >= start);
    const packets = window.colonyPackets;
    return { frames, packets, playerId };
  }, { playerId, duration });
}

export function motionSummary({ frames, packets, playerId }) {
  const speeds = [], cameraSpeeds = [], errors = [], intervals = [], packetIds = new Set();
  for (let i = 1; i < frames.length; i++) {
    const a = frames[i - 1], b = frames[i], dt = (b.at - a.at) / 1000;
    const p = a.players.find(p => p.id === playerId), q = b.players.find(p => p.id === playerId);
    const packet = packets[b.packet], prior = packets[b.packet - 1];
    if (!p || !q || !packet || !prior || dt <= 0 || dt > .12) continue;
    const known = packet.players.find(p => p.id === playerId), previous = prior.players.find(p => p.id === playerId);
    if (!known || !previous || Math.hypot(known.x - previous.x, known.y - previous.y) < .1) continue;
    speeds.push(Math.hypot(q.x - p.x, q.y - p.y) / dt);
    cameraSpeeds.push(Math.hypot(b.camera.x - a.camera.x, b.camera.y - a.camera.y) / dt);
    errors.push(Math.hypot(q.x - known.x, q.y - known.y));
    if (!packetIds.has(b.packet)) { packetIds.add(b.packet); intervals.push(packet.at - prior.at); }
  }
  const sorted = [...speeds].sort((a, b) => a - b), cameras = [...cameraSpeeds].sort((a, b) => a - b);
  const quantile = (a, p) => a[Math.floor((a.length - 1) * p)] ?? 0;
  return { samples: speeds.length, packetIntervalsMs: intervals,
    movingFrameFraction: speeds.filter(v => v > .1).length / speeds.length,
    speedP10: quantile(sorted, .1), speedP90: quantile(sorted, .9),
    speedRatio: quantile(sorted, .9) / Math.max(.001, quantile(sorted, .1)),
    cameraMovingFrameFraction: cameras.filter(v => v > .1).length / cameras.length,
    cameraSpeedRatio: quantile(cameras, .9) / Math.max(.001, quantile(cameras, .1)),
    maximumPacketDistance: Math.max(...errors) };
}

import { angleDelta } from '../../public/turret.js';

// Reading the world through the page takes about 18 ms even as text, while the server
// answers in about 5 ms. Use this inside any timed control loop.
export const serverState = async (page, url) => (await page.request.get(url + '/api/world')).json();

// A state read reports a turn the hull finished a moment ago, so holding A or D
// until the heading looks right overshoots badly. Drive as a player does instead:
// correct the nose towards the goal and reread the hull between corrections.
export async function driveTo(page, read, goal, { timeout = 15000, reach = .5, press = key => page.keyboard.down(key), release = key => page.keyboard.up(key) } = {}) {
  const held = new Set(), deadline = Date.now() + timeout;
  const hold = async keys => {
    for (const key of [...held]) if (!keys.includes(key)) { held.delete(key); await release(key); }
    for (const key of keys) if (!held.has(key)) { held.add(key); await press(key); }
  };
  try {
    while (Date.now() < deadline) {
      const body = await read(), dx = goal.x - body.x, dy = goal.y - body.y;
      if (Math.hypot(dx, dy) <= reach) return body;
      const error = angleDelta(body.angle || 0, Math.atan2(dx, -dy)), keys = [];
      if (Math.abs(error) < .5) keys.push('w');
      if (Math.abs(error) > .06) keys.push(error > 0 ? 'd' : 'a');
      await hold(keys);
    }
    throw new Error(`Vehicle did not reach ${goal.x}, ${goal.y}: stopped at ${JSON.stringify(await read().then(b => ({ x: b.x, y: b.y, angle: b.angle, speed: b.speed })))}`);
  } finally { await hold([]); }
}

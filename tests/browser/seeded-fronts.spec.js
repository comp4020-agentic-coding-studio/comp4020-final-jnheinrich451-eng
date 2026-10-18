import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createApp } from '../../server.js';
import { newGroundEnemy } from '../../public/enemy-profiles.js';
import { freshLife } from '../../public/survival.js';

for (const mobile of [false, true]) test('survey seeded compounds and render distinct defenders / ' + (mobile ? 'phone' : 'desktop'), async ({ browser }) => {
  const dir = await mkdtemp(path.join(tmpdir(), 'frontier-seeded-'));
  const app = createApp({ dataDir: dir, logSink: () => {} }); let context;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, isMobile: mobile, hasTouch: mobile });
    const post = async (route, data) => { const r = await context.request.post(origin + route, { data, headers: { Origin: origin } }); expect(r.status(), await r.text()).toBeLessThan(300); return r.json(); };
    const credentials = { name: 'Surveyor', kind: 'demo', email: 'survey@frontier.test', password: 'unique seeded test password 123!' };
    await post('/api/auth/register', credentials);
    const inbox = await (await context.request.get(origin + '/api/auth/inbox')).json();
    await post('/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] }); await post('/api/auth/login', credentials);
    const { id } = await post('/api/campaigns/create', { name: 'Seeded survey' }); await post('/api/campaigns/enter', { id });
    const route = `/api/campaign-world/${id}/world`, initial = await (await context.request.get(origin + route)).json();
    expect(initial.combat.sites.some(s => s.guardRoster?.includes('bulwark'))).toBe(true);
    const site = initial.combat.sites.find(s => s.encounter), group = site.encounter;
    await post('/api/campaigns/leave', {});
    const db = new DatabaseSync(path.join(dir, 'campaigns', id, 'world.sqlite'));
    try {
      db.prepare('INSERT INTO cores VALUES (?,?,?,?,?)').run('survey-core', initial.me.id, 24, 18, 99);
      db.prepare('UPDATE scouts SET x=?,y=? WHERE id=?').run(group.x, group.y + 12, initial.me.id);
      db.prepare('INSERT OR REPLACE INTO robot_states VALUES (?,?)').run(initial.me.id, JSON.stringify({ ...freshLife(), deployed: true, shield: 99 }));
      const saved = JSON.parse(db.prepare("SELECT value FROM meta WHERE key='combat-checkpoint-v1'").get().value);
      saved.enemies = ['hunter', 'breaker', 'bulwark'].map((kind, i) => ({ ...newGroundEnemy(kind, ++saved.serial, { x: group.x - 4 + i * 4, y: group.y + 4 }), frenzyRecoveryUntil: 1e6 }));
      db.prepare("UPDATE meta SET value=? WHERE key='combat-checkpoint-v1'").run(JSON.stringify(saved));
    } finally { db.close(); }
    await post('/api/campaigns/enter', { id });
    const page = await context.newPage(), errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(origin + '/?campaign=' + id); await expect(page.locator('#connection')).toContainText('live');
    if (await page.getByRole('button', { name: 'Close site controls' }).isVisible()) await page.getByRole('button', { name: 'Close site controls' }).click();
    await page.locator('#planet-open').click();
    expect(await page.locator('#planet-fronts option').count()).toBeGreaterThan(3);
    await page.locator('#planet-fronts').selectOption(group.id);
    await page.screenshot({ path: `.local/seeded-globe-${mobile}.png` });
    await page.locator('#planet-visit').click(); await expect(page.locator('#planet-dialog')).toBeHidden();
    await expect(page.locator('#settlement-progress')).toContainText(group.name);
    await expect(page.locator('#tile-x')).toHaveValue(String(Math.floor(group.x)));
    await expect(page.locator('#tile-y')).toHaveValue(String(Math.floor(group.y)));
    if (await page.getByRole('button', { name: 'Close site controls' }).isVisible()) await page.getByRole('button', { name: 'Close site controls' }).click();
    if (mobile) { await page.locator('#zoom-out').click(); await page.locator('#zoom-out').click(); }
    await page.waitForTimeout(250);
    await page.screenshot({ path: `.local/seeded-surface-${mobile}.png` });
    const state = await (await context.request.get(origin + route)).json();
    expect(state.combat.enemies.find(e => e.kind === 'breaker')).toMatchObject({ hp: 180, maxHp: 180 });
    expect(state.combat.enemies.find(e => e.kind === 'bulwark')).toMatchObject({ hp: 450, maxHp: 450 });
    expect(state.combat.sites.map(s => s.id)).toEqual(initial.combat.sites.map(s => s.id));
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  } finally {
    await context?.close(); await app.close();
    if (!path.resolve(dir).startsWith(path.resolve(tmpdir()) + path.sep + 'frontier-seeded-')) throw new Error('Unexpected test directory');
    await rm(dir, { recursive: true, force: true });
  }
});

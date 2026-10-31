import { test, expect } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createApp } from '../../server.js';

async function fixture(browser, viewport, run) {
  const prefix = path.join(tmpdir(), 'frontier-save-management-');
  const dataDir = await mkdtemp(prefix), contexts = [];
  const app = createApp({ dataDir, logSink: () => {} });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const base = `http://127.0.0.1:${app.server.address().port}`;
    const post = async (context, route, data) => {
      const response = await context.request.post(base + route, { data, headers: { Origin: base } });
      const result = await response.json();
      expect(response.ok(), JSON.stringify(result)).toBe(true);
      return result;
    };
    const account = async label => {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce' }); contexts.push(context);
      const credentials = { name: `${label} Pilot`, email: `${label.toLowerCase()}@frontier.test`, password: 'isolated save management password 123!', kind: 'demo' };
      await post(context, '/api/auth/register', credentials);
      const inbox = await (await context.request.get(base + '/api/auth/inbox')).json();
      await post(context, '/api/auth/verify', { token: inbox.messages[0].href.split('#token=')[1] });
      await post(context, '/api/auth/login', credentials);
      return context;
    };
    const owner = await account('Owner'), teammate = await account('Teammate');
    const create = (context, name, template = 'caldera-v1') => post(context, '/api/campaigns/create', { name, template });
    const saves = {
      remove: { name: 'Discarded expedition "Alpha"', ...(await create(owner, 'Discarded expedition "Alpha"')) },
      keep: { name: 'Keep my Caldera foothold', ...(await create(owner, 'Keep my Caldera foothold')) },
      vesper: { name: 'Keep Vesper dunes', ...(await create(owner, 'Keep Vesper dunes', 'vesper-v1')) },
      member: { name: 'Teammate colony', ...(await create(teammate, 'Teammate colony')) },
    };
    // Real membership persists after both accounts leave the teammate's room.
    const opened = await post(teammate, '/api/campaigns/enter', { id: saves.member.id });
    const host = await teammate.newPage();
    await host.goto(base + opened.next);
    await expect(host.locator('#connection')).toContainText('live');
    const invitation = await post(teammate, '/api/campaigns/invite', { id: saves.member.id });
    await post(owner, '/api/campaigns/join', { code: invitation.code });
    await post(owner, '/api/campaigns/leave', {});
    await post(teammate, '/api/campaigns/leave', {});
    await host.close();
    await run({ base, owner, teammate, post, saves });
  } finally {
    await Promise.all(contexts.map(context => context.close()));
    await app.close();
    const resolved = path.resolve(dataDir);
    if (!resolved.startsWith(path.resolve(prefix))) throw new Error('Refusing to remove an unexpected save-management fixture path.');
    await rm(resolved, { recursive: true, force: true });
  }
}

const saveCard = (page, name) => page.locator('.campaign-card').filter({ has: page.locator('strong', { hasText: name }) });

async function layout(page) {
  return page.evaluate(() => {
    const bounds = selector => {
      const box = document.querySelector(selector).getBoundingClientRect();
      return { x: box.x + scrollX, y: box.y + scrollY, width: box.width, height: box.height };
    };
    return { title: bounds('#planet-heading'), slots: bounds('#continue-view'), stage: bounds('#destination') };
  });
}

function sameLayout(before, after) {
  for (const section of Object.keys(before)) for (const key of ['x', 'y', 'width', 'height']) {
    expect(Math.abs(after[section][key] - before[section][key]), `A floating reminder must not move ${section}.${key}`).toBeLessThan(1);
  }
}

async function borderlessReminder(page) {
  const styles = await page.locator('#message').evaluate(element => {
    const message = getComputedStyle(element), area = getComputedStyle(element.parentElement);
    return {
      messageBackground: message.backgroundColor, areaBackground: area.backgroundColor,
      borders: [message.borderTopWidth, message.borderRightWidth, message.borderBottomWidth, message.borderLeftWidth,
        area.borderTopWidth, area.borderRightWidth, area.borderBottomWidth, area.borderLeftWidth],
      position: area.position, pointerEvents: area.pointerEvents,
      signInPointerEvents: getComputedStyle(document.getElementById('signin')).pointerEvents,
    };
  });
  expect(styles.messageBackground).toBe('rgba(0, 0, 0, 0)');
  expect(styles.areaBackground).toBe('rgba(0, 0, 0, 0)');
  expect(styles.borders.every(width => width === '0px')).toBe(true);
  expect(styles.position).toBe('fixed');
  expect(styles.pointerEvents).toBe('none');
  expect(styles.signInPointerEvents).toBe('auto');
}

for (const viewport of [{ width: 1280, height: 900, label: 'desktop' }, { width: 390, height: 844, label: 'phone' }]) {
  test(`save deletion is explicit and reminders do not shift the ${viewport.label} layout`, async ({ browser }, info) => {
    test.setTimeout(60000);
    await fixture(browser, { width: viewport.width, height: viewport.height }, async ({ base, owner, teammate, post, saves }) => {
      const page = await owner.newPage(), errors = [], dialogs = [], deletes = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('dialog', dialog => { dialogs.push(dialog.type()); void dialog.dismiss(); });
      page.on('request', request => {
        if (new URL(request.url()).pathname === '/api/campaigns/delete' && request.method() === 'POST') deletes.push(request.postDataJSON());
      });
      const list = async context => (await (await context.request.get(base + '/api/campaigns/list')).json()).campaigns;
      await page.clock.install();
      await page.goto(base + '/campaigns/#view=continue&planet=caldera-v1');
      await expect(page.locator('#owned-count')).toContainText('3 / 3');
      await expect(saveCard(page, saves.member.name)).toContainText('Member');
      await expect(saveCard(page, saves.member.name).getByRole('button', { name: /^Delete/ })).toHaveCount(0);

      // Opening an owned world marks it unavailable for deletion, even during
      // the reconnect grace before any game stream has connected.
      await post(owner, '/api/campaigns/enter', { id: saves.keep.id });
      await page.locator('#refresh').click();
      await expect(page.locator('#active')).toBeVisible();
      await expect(saveCard(page, saves.keep.name).getByRole('button', { name: /^Delete/ })).toBeDisabled();
      await page.locator('#leave').click();
      await expect(page.locator('#active')).toBeHidden();
      await expect(saveCard(page, saves.keep.name).getByRole('button', { name: /^Delete/ })).toBeEnabled();

      await page.clock.fastForward(6000);
      await expect(page.locator('#message')).toBeHidden();
      const beforeRefresh = await layout(page);
      await page.locator('#refresh').click();
      await expect(page.locator('#message')).toContainText('Room list updated');
      sameLayout(beforeRefresh, await layout(page));
      await borderlessReminder(page);
      await page.screenshot({ path: info.outputPath('floating-room-message.png'), fullPage: viewport.width > 760 });
      await page.clock.fastForward(6000);
      await expect(page.locator('#message')).toBeHidden();
      sameLayout(beforeRefresh, await layout(page));

      await page.locator('#back').click(); await page.locator('#new-game').click();
      await expect(page.locator('#select-planet')).toBeDisabled();
      await page.locator('#back').click(); await page.locator('#continue-game').click();

      const target = saveCard(page, saves.remove.name);
      const deleteButton = () => target.locator('.delete-campaign');
      const confirmation = () => target.locator('.delete-confirmation');
      await deleteButton().click();
      await expect(confirmation()).toContainText(saves.remove.name);
      await expect(confirmation()).toContainText(/permanent|cannot be undone/i);
      expect(deletes).toHaveLength(0);
      await confirmation().getByRole('button', { name: 'Cancel', exact: true }).click();
      await expect(confirmation()).toHaveCount(0);
      expect(deletes).toHaveLength(0);
      await deleteButton().click();
      await page.keyboard.press('Escape');
      await expect(confirmation()).toHaveCount(0);
      await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'continue');
      await expect(deleteButton()).toBeFocused();
      expect(deletes).toHaveLength(0);

      await page.route('**/api/campaigns/delete', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Save storage unavailable. Please retry.' }) }), { times: 1 });
      await deleteButton().click();
      await confirmation().getByRole('button', { name: 'Delete save', exact: true }).click();
      await expect(page.locator('#message')).toContainText('Save storage unavailable');
      await expect(target).toBeVisible();
      await expect(page.locator('#owned-count')).toContainText('3 / 3');
      expect((await list(owner)).map(save => save.id)).toContain(saves.remove.id);
      await borderlessReminder(page);
      await page.clock.fastForward(6000);
      await expect(page.locator('#message')).toContainText('Save storage unavailable');
      if (await confirmation().count()) await confirmation().getByRole('button', { name: 'Cancel', exact: true }).click();

      await deleteButton().click();
      await expect(confirmation()).toContainText(saves.remove.name);
      await page.screenshot({ path: info.outputPath('delete-save-confirmation.png'), fullPage: viewport.width > 760 });
      await confirmation().getByRole('button', { name: 'Delete save', exact: true }).click();
      await expect(target).toHaveCount(0);
      await expect(page.locator('#owned-count')).toContainText('2 / 3');
      expect(deletes).toEqual([{ id: saves.remove.id, confirm: true }, { id: saves.remove.id, confirm: true }]);
      expect((await list(owner)).map(save => save.id).sort()).toEqual([saves.keep.id, saves.vesper.id, saves.member.id].sort());
      expect((await list(teammate)).map(save => save.id)).toEqual([saves.member.id]);
      await page.reload();
      await expect(target).toHaveCount(0);
      await expect(page.locator('#owned-count')).toContainText('2 / 3');
      await expect(saveCard(page, saves.keep.name)).toBeVisible();
      await expect(saveCard(page, saves.member.name)).toBeVisible();
      await page.locator('#back').click(); await page.locator('#new-game').click();
      await expect(page.locator('#select-planet')).toBeEnabled();
      await page.locator('#select-planet').click();
      await expect(page.locator('#create-submit')).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(dialogs).toEqual([]);
      expect(errors).toEqual([]);
    });
  });
}

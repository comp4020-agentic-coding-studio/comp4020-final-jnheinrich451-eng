import { test, expect } from '@playwright/test';

test('a mismatched page build refreshes once and keeps the same guest', async ({ page }) => {
  let documents = 0;
  await page.route('http://localhost:8082/', async route => {
    const response = await route.fetch(); let html = await response.text();
    if (++documents === 1) html = html.replace(/name="frontier-build" content="[^"]+"/, 'name="frontier-build" content="old-renderer"');
    await route.fulfill({ response, body: html });
  });
  await page.goto('/');
  await expect.poll(() => documents).toBe(2);
  await expect(page.locator('#connection')).toContainText('live');
  const meta = await page.locator('meta[name="frontier-build"]').getAttribute('content');
  const state = await page.evaluate(async () => (await (await fetch('/api/world')).json()));
  expect(meta).toBe(state.clientBuild);
  expect(state.players.filter(p => p.id === state.me.id)).toHaveLength(1);
  await page.waitForTimeout(500); expect(documents).toBe(2);
});

for (const reduced of [false, true]) test(`aged fire and gas stay visible over craters (${reduced ? 'reduced' : 'normal'} effects)`, async ({ page }) => {
  await page.goto('/'); await expect(page.locator('#connection')).toContainText('live');
  const counts = await page.evaluate(async reduced => {
    const { CombatEffects } = await import('/effects.js');
    const { drawHazards } = await import('/hazard-effects.js');
    const { makeBarrage } = await import('/missile.js');
    const { makeBarrageField, landBarrageSector, tickField } = await import('/missile-fields.js');
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 640;
    canvas.id = 'hazard-proof'; canvas.style.cssText = 'position:fixed;inset:0;z-index:9999;width:960px;height:640px'; document.body.append(canvas);
    const c = canvas.getContext('2d'), result = [];
    for (const [index, ammo] of ['INCENDIARY', 'GAS'].entries()) {
      const volley = makeBarrage({ id:'proof', x:0, y:0, ammo }, { x:10,y:10 }, false, 42);
      const field = makeBarrageField(volley, 0), effects = new CombatEffects(32);
      for (const m of volley.missiles) landBarrageSector(field, m, 0);
      tickField(field, 6); // FIRE 12s / GAS 18/18, after all landing flashes have ended.
      effects.marks = volley.missiles.map((m,i)=>({ id:i, kind:'crater', x:m.x,y:m.y,size:m.craterSize }));
      c.save(); c.beginPath(); c.rect(index*480,0,480,640); c.clip(); c.fillStyle='#93a17c'; c.fillRect(index*480,0,480,640);
      c.translate(index*480-80,0);
      effects.drawGround(c,6000,'crater'); drawHazards(c,[field],32,6000,reduced,1); effects.drawGround(c,6000,'remains');
      c.restore();
      const pixels=c.getImageData(index*480,32,480,570).data; let visible=0;
      for(let i=0;i<pixels.length;i+=4) {
        const [r,g,b]=[pixels[i],pixels[i+1],pixels[i+2]];
        if(ammo==='INCENDIARY' ? r>150 && g>45 && g<200 && b<120 && r>g*1.2 : g-r>20 && g-b>55) visible++;
      }
      result.push(visible);
    }
    return result;
  }, reduced);
  expect(counts[0]).toBeGreaterThan(1000); expect(counts[1]).toBeGreaterThan(1000);
  await page.locator('#hazard-proof').screenshot({ path:`docs/previews/hazard-visibility-${reduced ? 'reduced' : 'normal'}.png` });
});

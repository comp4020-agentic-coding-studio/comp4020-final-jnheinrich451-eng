// Initial overview transform. Use real pointer/touch input, never a debug camera.
export async function aimOverview(page, x, y, mobile = false) {
  await page.locator('#facility-controls').waitFor({ state: 'visible' });
  // Matches fitOrbitalView in app.js for the saved world size.
  const world = await page.evaluate(async () => { const w = (await (await fetch('/api/world')).json()).world; return { width: w.width, height: w.height }; });
  const { width, height } = page.viewportSize(), top = 90, bottom = width > 760 ? 180 : 250;
  const zoom = Math.min(.7, (width - 40) / (world.width * 48), Math.max(120, height - top - bottom) / (world.height * 48));
  const px = width / 2 + (x - world.width / 2) * 48 * zoom, py = (height + top - bottom) / 2 + (y - world.height / 2) * 48 * zoom;
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, { x: px, y: py });
  if (hit !== 'world-canvas') throw new Error('Aim fixture is obscured by a HUD control: ' + hit);
  if (mobile) await page.touchscreen.tap(px, py); else await page.mouse.move(px, py);
  return { x: px, y: py };
}

// Initial overview transform. Use real pointer/touch input, never a debug camera.
export async function aimOverview(page, x, y, mobile = false) {
  await page.locator('#facility-controls').waitFor({ state: 'visible' });
  const { width, height } = page.viewportSize(), top = 90, bottom = width > 760 ? 180 : 250;
  const zoom = Math.min(.7, (width - 40) / (128 * 48), Math.max(120, height - top - bottom) / (96 * 48));
  const px = width / 2 + (x - 64) * 48 * zoom, py = (height + top - bottom) / 2 + (y - 48) * 48 * zoom;
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, { x: px, y: py });
  if (hit !== 'world-canvas') throw new Error('Aim fixture is obscured by a HUD control: ' + hit);
  if (mobile) await page.touchscreen.tap(px, py); else await page.mouse.move(px, py);
  return { x: px, y: py };
}

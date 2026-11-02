// Field equipment sits in the logistics dialog, behind the folded menu. Orbital
// strikes and air support also have the V and H keys; phones take this route.
export async function openFieldTool(page, id) {
  await page.locator('#hud-menu-button').click();
  await page.locator('#supplies-button').click();
  await page.locator('#' + id).click();
}

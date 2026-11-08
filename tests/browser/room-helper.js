// Joining and closing a room now have their own scenes. Specs about something
// else use these to pass through them; room-arrival.spec.js tests the scenes.
import { expect } from '@playwright/test';

// A join skips only once the server has admitted the guest and the arrival began.
export async function skipArrival(page) {
  await expect(page.locator('body')).toHaveAttribute('data-entry-view', 'arrival');
  await page.keyboard.press('Shift');
}

// Each player in a closed room is told why before going back to the lobby.
export function leaveClosedRoom(...pages) {
  return Promise.all(pages.map(async page => {
    await page.locator('#room-ended-return').click();
    await expect(page).toHaveURL(/\/campaigns\//);
  }));
}

import { expect, it } from 'vitest';
import { DROP, JUMP, WARP, dropCamera, dropState, jumpPose, jumpState, podPose, shipDeparture, shipPose, warpPose, warpState } from '../public/entry-ship.js';

const globe = { x: 800, y: 500, r: 360 };

it('holds the warp until the host\'s world has arrived, then ends exactly on the hover pose', () => {
  const { approach, line, expand, hold, total } = WARP;
  expect(approach + line + expand + hold).toBe(total);
  expect(warpState(0)).toMatchObject({ phase: 'approach', line: 0, expand: 0, done: false });
  expect(warpState(approach)).toMatchObject({ phase: 'line', line: 0, expand: 0 });
  expect(warpState(approach + line)).toMatchObject({ phase: 'expand', line: 1, expand: 0 });
  expect(warpState(total - 1).done).toBe(false);
  expect(warpState(total)).toMatchObject({ expand: 1, stretch: 1, flash: 0, done: true });
  const pose = shipPose(globe, 0), settled = warpPose(pose, warpState(total));
  expect(settled.x).toBeCloseTo(pose.x); expect(settled.y).toBeCloseTo(pose.y);
  // The stretched hull trails behind the nose, which never moves.
  const early = warpState(approach + line + 40), trailing = warpPose(pose, early);
  expect(early.stretch).toBeGreaterThan(10);
  expect(trailing.x + Math.cos(pose.angle) * pose.length * early.stretch / 2).toBeCloseTo(pose.x + Math.cos(pose.angle) * pose.length / 2);
  expect(trailing.y + Math.sin(pose.angle) * pose.length * early.stretch / 2).toBeCloseTo(pose.y + Math.sin(pose.angle) * pose.length / 2);
});

it('keeps the hovering ship near its sketched spot with only minor swings, and follows the globe', () => {
  for (let time = 0; time < 30000; time += 137) {
    const pose = shipPose(globe, time);
    expect(Math.abs(pose.x - (globe.x - globe.r * .3))).toBeLessThan(globe.r * .02);
    expect(Math.abs(pose.y - (globe.y + globe.r * .08))).toBeLessThan(globe.r * .025);
    expect(Math.abs(pose.angle + Math.PI / 2 - .2)).toBeLessThan(.021);
  }
  const moved = shipPose({ ...globe, y: globe.y - 300 }, 500), still = shipPose(globe, 500);
  expect(still.y - moved.y).toBeCloseTo(300);
  expect(shipPose({ ...globe, r: 180 }, 0).length).toBeCloseTo(144);
  // On phones the nose stays below the title, which covers the globe's upper half.
  const phone = { x: 195, y: 250, r: 172 }, compact = shipPose(phone, 0, true);
  expect(compact.y - Math.abs(Math.sin(compact.angle)) * compact.length / 2).toBeGreaterThan(phone.y - phone.r * .12);
  expect(compact.length).toBeLessThan(phone.r);
});

it('swaps the globes only at the peak of the flash, then settles back into the hover', () => {
  const { charge, streak, total } = JUMP;
  expect(total).toBe(1600);
  expect(jumpState(0)).toMatchObject({ phase: 'charge', swapped: false, flash: 0, offset: 0, stretch: 1 });
  expect(jumpState(charge + streak - 1).swapped).toBe(false);
  expect(jumpState(charge + streak - 1).flash).toBeGreaterThan(.98);
  const swap = jumpState(charge + streak);
  expect(swap).toMatchObject({ phase: 'arrive', swapped: true, flash: 1 });
  // The ship left along the direction of travel and re-enters from behind.
  expect(jumpState(charge + streak - 1).offset).toBeGreaterThan(8);
  expect(swap.offset).toBeLessThan(-6);
  expect(jumpState(total)).toMatchObject({ phase: 'done', turn: 0, stretch: 1, offset: 0, flash: 0, stars: 0, glow: 0 });
});

it('turns toward the pressed arrow the short way and leaves along that side', () => {
  const pose = shipPose(globe, 0), right = jumpPose(pose, { turn: 1, offset: 2 }, 1), left = jumpPose(pose, { turn: 1, offset: 2 }, -1);
  expect(Math.cos(right.angle)).toBeCloseTo(1); expect(right.x - pose.x).toBeCloseTo(pose.length * 2);
  expect(Math.cos(left.angle)).toBeCloseTo(-1); expect(left.x - pose.x).toBeCloseTo(-pose.length * 2);
  expect(right.y).toBeCloseTo(pose.y); expect(left.y).toBeCloseTo(pose.y);
  expect(Math.abs(right.angle - pose.angle)).toBeLessThan(Math.PI);
  expect(Math.abs(left.angle - pose.angle)).toBeLessThan(Math.PI);
  expect(jumpPose(pose, { turn: 0, offset: 0 }, 1)).toEqual(pose);
});

it('runs the dive phases in order for seven seconds', () => {
  const { zoom, release, dive, total } = DROP;
  expect(zoom + release + dive).toBe(total); expect(total).toBe(7000);
  expect(dropState(0)).toMatchObject({ phase: 'zoom', zoom: 0, release: 0, dive: 0, done: false });
  expect(dropState(zoom)).toMatchObject({ phase: 'release', zoom: 1, release: 0 });
  expect(dropState(zoom + release)).toMatchObject({ phase: 'dive', release: 1, dive: 0 });
  expect(dropState(total - 1).done).toBe(false);
  expect(dropState(total)).toMatchObject({ phase: 'dive', dive: 1, done: true });
  expect(dropState(total + 5000).dive).toBe(1);
});

it('starts the camera exactly on the hover, so the cut into the dive cannot jump', () => {
  const pose = shipPose(globe, 1234), start = dropState(0), camera = dropCamera(pose, start, podPose(pose, start), 1920, 1080);
  expect(camera.z).toBe(1);
  expect(camera.x).toBeCloseTo(camera.fx); expect(camera.y).toBeCloseTo(camera.fy);
});

it('fills the frame with the ship, hands over to the pod and keeps diving on every screen', () => {
  for (const [width, height] of [[1920, 1080], [390, 844]]) {
    const pose = shipPose(globe, 0), zoomed = dropState(DROP.zoom), camera = dropCamera(pose, zoomed, podPose(pose, zoomed), width, height);
    expect(pose.length * camera.z).toBeGreaterThanOrEqual(height);
    expect(camera.x).toBe(width / 2);
    const released = dropState(DROP.zoom + DROP.release), pod = podPose(pose, released), handover = dropCamera(pose, released, pod, width, height);
    expect(handover.fx).toBeCloseTo(pod.x); expect(handover.fy).toBeCloseTo(pod.y);
    let last = handover.z;
    for (const progress of [.25, .5, .75, 1]) { const later = dropCamera(pose, dropState(DROP.zoom + DROP.release + DROP.dive * progress), pod, width, height); expect(later.z).toBeGreaterThan(last); last = later.z; }
  }
});

it('keeps the pod under the hull at first, clears it, and turns its shield to the planet', () => {
  const pose = shipPose(globe, 0), offset = (state: any) => { const pod = podPose(pose, state); return Math.hypot(pod.x - pose.x, pod.y - pose.y) / pose.length; };
  expect(offset({ release: 0 })).toBeLessThan(.07);
  expect(offset({ release: 1 })).toBeGreaterThan(.13);
  expect(podPose(pose, { release: 1 }).angle).toBeCloseTo(Math.PI / 2);
  expect(shipDeparture(pose, { release: 0 }).pose).toEqual(pose);
  const away = shipDeparture(pose, { release: 1 }).pose;
  expect(Math.hypot(away.x - pose.x, away.y - pose.y)).toBeCloseTo(pose.length * 1.6);
});

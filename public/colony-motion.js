import { COLONY, stepColonyRobot } from './colonization.js';

// Rendering only: snapshots and the server still own the saved robot position.
// The garden sends four snapshots a second. Short, collision-checked prediction
// bridges those packets; cosmetic reduced motion must not turn this into 4 FPS.
const PREDICT_SECONDS = .25;
const STRIDE = Math.PI * 2 / .8;

export function receiveColonyPlayers(rendered, records, now, reset = false) {
  const present = new Set();
  for (const record of records) {
    present.add(record.id);
    const previous = rendered.get(record.id);
    if (reset || !previous || Math.hypot(previous.x - record.x, previous.y - record.y) > 5) {
      rendered.set(record.id, { ...record, targetX: record.x, targetY: record.y,
        receivedAt: now, vx: 0, vy: 0, walkPhase: 0, walkAmount: 0 });
      continue;
    }
    const interval = Math.max(.05, (now - previous.receivedAt) / 1000);
    let vx = interval > 1 ? 0 : (record.x - previous.targetX) / interval;
    let vy = interval > 1 ? 0 : (record.y - previous.targetY) / interval;
    const speed = Math.hypot(vx, vy);
    if (speed > COLONY.robotSpeed) { vx *= COLONY.robotSpeed / speed; vy *= COLONY.robotSpeed / speed; }
    Object.assign(previous, { targetX: record.x, targetY: record.y, receivedAt: now,
      angle: record.angle, name: record.name, vx, vy });
  }
  for (const id of rendered.keys()) if (!present.has(id)) rendered.delete(id);
}

export function advanceColonyPlayers(rendered, state, now, dt, predict = true) {
  const seconds = Math.max(0, Math.min(.1, dt));
  const blend = 1 - Math.exp(-seconds * 18), settle = 1 - Math.exp(-seconds * 16);
  for (const player of rendered.values()) {
    const goal = { x: player.targetX, y: player.targetY, angle: player.angle };
    const age = predict ? Math.max(0, Math.min(PREDICT_SECONDS, (now - player.receivedAt) / 1000)) : 0;
    if (age && (player.vx || player.vy)) {
      stepColonyRobot(state, goal, player.vx / COLONY.robotSpeed, player.vy / COLONY.robotSpeed, age);
    }
    const dx = (goal.x - player.x) * blend, dy = (goal.y - player.y) * blend;
    player.x += dx; player.y += dy;
    const distance = Math.hypot(dx, dy);
    // Advance feet by real rendered travel, so they do not walk in place when
    // updates stop or when a wall prevents movement.
    player.walkPhase = (player.walkPhase + distance * STRIDE) % (Math.PI * 2);
    const amount = seconds && distance / seconds > .025 ? Math.min(1, distance / seconds / COLONY.robotSpeed) : 0;
    player.walkAmount += (amount - player.walkAmount) * settle;
    if (!amount && player.walkAmount < .002) player.walkAmount = 0;
  }
}

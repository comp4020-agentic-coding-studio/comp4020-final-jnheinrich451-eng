import { airRecords } from './air-traffic.js';
import { gunPosition } from './rail.js';

export const EMOTES = Object.freeze([
  { id: 'hello', label: 'Hello', image: 'emote_faceHappy.png' },
  { id: 'thanks', label: 'Thanks', image: 'emote_heart.png' },
  { id: 'help', label: 'Help', image: 'emote_question.png' },
  { id: 'danger', label: 'Danger', image: 'emote_alert.png' },
  { id: 'follow', label: 'Follow me', image: 'emote_exclamation.png' },
  { id: 'celebrate', label: 'Celebrate', image: 'emote_stars.png' },
]);

// Authority comes from live seats/leases, never a client-supplied asset ID.
export function emoteAnchor(world, player) {
  const gun = world.artillery?.find(g => g.operator === player.id && g.lease > 0);
  if (gun) return { kind: 'artillery', id: gun.id };
  const plane = airRecords(world).map(b => b.aircraft).find(p => p?.occupant === player.id && p.state !== 'destroyed');
  if (plane) return { kind: 'aircraft', id: plane.id };
  for (const [kind, list] of [['ship', world.ships], ['tank', world.tanks], ['recycler', world.logistics?.recyclers]]) {
    const asset = list?.find(a => a.occupant === player.id && !a.destroyed);
    if (asset) return { kind, id: asset.id };
  }
  return { kind: 'player', id: player.id };
}

export function emotePoint(world, players, anchor) {
  if (anchor.kind === 'player') return players.find(p => p.id === anchor.id && p.body !== 'orbital');
  if (anchor.kind === 'artillery') {
    const gun = world.artillery?.find(g => g.id === anchor.id);
    return gun && !gun.destroyed ? gunPosition(gun) : null;
  }
  const list = anchor.kind === 'aircraft' ? airRecords(world).map(b => b.aircraft)
    : anchor.kind === 'ship' ? world.ships : anchor.kind === 'tank' ? world.tanks : world.logistics?.recyclers;
  return list?.find(a => a?.id === anchor.id && !a.destroyed && a.state !== 'destroyed');
}

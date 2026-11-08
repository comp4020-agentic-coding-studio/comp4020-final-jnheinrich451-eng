import { describe, expect, it } from 'vitest';
import { createColony } from '../public/colonization.js';
import { REST, activityView, isRestAction, nearestRest, restAction, restSpot, restValid, standUp } from '../public/colony-rest.js';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value));
function garden(): any {
  const state: any = createColony('morrow-v1');
  const ready = (id: string, kind: string, x: number, y: number, dir = 0, status = 'ready') => ({ id, kind, x, y, dir, variant: 'ivory', status, revision: 0, owner: 'seed' });
  state.settlement = { version: 1, revision: 0, stored: {}, deliveries: [], completed: [], undo: null, items: [
    ready('f-bench', 'bench', 37, 31), ready('f-pad', 'parking-seat', 30, 30), ready('f-post', 'charging-post', 40, 33), ready('f-kettle', 'kettle', 33, 33), ready('f-arriving', 'bench', 44, 36, 0, 'delivery'),
  ] };
  state.time = 12;
  return state;
}
const worker = (x: number, y: number): any => ({ id: 'worker', x, y, angle: 1, regionId: 'home' });
const free = () => true;

describe('resting', () => {
  it('names a spot on a seat facing south, or in front of a post or kettle facing north', () => {
    const state = garden();
    expect(restSpot(state.settlement.items[0])).toEqual({ x: 38, y: 31.5, angle: Math.PI });
    expect(restSpot(state.settlement.items[1])).toEqual({ x: 30.5, y: 30.5, angle: Math.PI });
    expect(restSpot(state.settlement.items[2])).toEqual({ x: 40.5, y: 34.5, angle: 0 });
    // A turned bench seats its worker facing away from the turned backrest.
    expect(restSpot({ ...state.settlement.items[0], dir: 1 })).toEqual({ x: 37.5, y: 32, angle: Math.PI * 1.5 });
  });

  it('finds the nearest ready furnishing within reach and ignores one still arriving', () => {
    const state = garden();
    expect(nearestRest(state, 36.5, 31.5)?.id).toBe('f-bench');
    expect(nearestRest(state, 36.5, 31.5, .4)).toBeNull();
    expect(nearestRest(state, 44.5, 37.5)).toBeNull();
    expect(nearestRest(state, 40.5, 34.6)?.id).toBe('f-post');
    expect(nearestRest(state, NaN, 2)).toBeNull();
    expect(isRestAction('rest') && isRestAction('stand') && !isRestAction('collect-crate')).toBe(true);
  });

  it('seats a worker in reach, idempotently, and stands it back where it came from', () => {
    const state = garden(), person = worker(36.5, 31.5), before = copy(state);
    expect(() => restAction(state, worker(20.5, 20.5), 'rest', { itemId: 'f-bench' }, free)).toThrow('Walk up to it');
    expect(() => restAction(state, person, 'rest', { itemId: 'f-arriving' }, free)).toThrow('not ready');
    expect(() => restAction(state, person, 'rest', { itemId: 7 } as any, free)).toThrow('Choose a seat');
    expect(() => restAction(state, { ...person, regionId: 'blossom-grove' }, 'rest', { itemId: 'f-bench' }, free)).toThrow('home district');
    expect(() => restAction(state, { id: '' }, 'rest', { itemId: 'f-bench' }, free)).toThrow('Join');
    expect(restAction(state, person, 'stand', {}, free)).toMatchObject({ message: 'Already standing.' });
    const result = restAction(state, person, 'rest', { itemId: 'f-bench' }, free);
    expect(result).toMatchObject({ ok: true, message: 'Taking a seat.', targetId: 'f-bench' });
    expect(person).toMatchObject({ x: 38, y: 31.5, angle: Math.PI, activity: { kind: 'sit', itemId: 'f-bench', since: 12, from: { x: 36.5, y: 31.5, angle: 1 } } });
    expect(activityView(person)).toEqual({ kind: 'sit', itemId: 'f-bench', since: 12 });
    expect(restAction(state, person, 'rest', { itemId: 'f-bench' }, free)).toMatchObject({ ok: true, targetId: 'f-bench' });
    expect(person.x).toBe(38);
    // The colony save is untouched: resting is per person.
    expect(state).toEqual(before);
    expect(restAction(state, person, 'stand', {}, free)).toMatchObject({ message: 'Back to the garden.' });
    expect(person).toMatchObject({ x: 36.5, y: 31.5, angle: 1, activity: null });
    expect(activityView(person)).toBeNull();
  });

  it('needs clear ground in front of a post or kettle and keeps the original return point across a change of seat', () => {
    const state = garden(), person = worker(40.5, 34.8);
    const blocked = (x: number, y: number) => !(x === 40.5 && y === 34.5);
    expect(() => restAction(state, person, 'rest', { itemId: 'f-post' }, blocked)).toThrow('Clear the space');
    expect(person.activity).toBeUndefined();
    restAction(state, person, 'rest', { itemId: 'f-post' }, free);
    expect(person).toMatchObject({ x: 40.5, y: 34.5, angle: 0, activity: { kind: 'charge' } });
    // Sitting on the bench from the post keeps the first return point, not the post's spot.
    person.x = 38.2; person.y = 32.6;
    restAction(state, person, 'rest', { itemId: 'f-bench' }, free);
    expect(person.activity).toMatchObject({ kind: 'sit', from: { x: 40.5, y: 34.8 } });
    standUp(person, free);
    expect(person).toMatchObject({ x: 40.5, y: 34.8, activity: null });
  });

  it('stands on the nearest clear tile when the return point and the seat are blocked, and ends when the furnishing goes', () => {
    const state = garden(), person = worker(36.5, 31.5);
    restAction(state, person, 'rest', { itemId: 'f-bench' }, free);
    // The bench itself is solid and the return point has been built over: the ring search finds a tile.
    const canStand = (x: number, y: number) => !(x === 36.5 && y === 31.5) && !(x >= 37 && x < 39 && y >= 31 && y < 32);
    expect(standUp(person, canStand)).toBe(true);
    expect(person.activity).toBeNull(); expect(canStand(person.x, person.y)).toBe(true);
    expect(Math.max(Math.abs(person.x - 38), Math.abs(person.y - 31.5))).toBeLessThanOrEqual(1.5);
    expect(standUp(person, canStand)).toBe(false);
    restAction(state, worker(33.5, 34.6), 'rest', { itemId: 'f-kettle' }, free);
    const brewing = worker(33.5, 34.6); restAction(state, brewing, 'rest', { itemId: 'f-kettle' }, free);
    expect(brewing.activity.kind).toBe('brew'); expect(restValid(state, brewing)).toBe(true);
    state.settlement.items = state.settlement.items.filter((item: any) => item.id !== 'f-kettle');
    expect(restValid(state, brewing)).toBe(false);
    expect(restValid(state, worker(1, 1))).toBe(false);
    expect(REST.kinds.kettle).toBe('brew');
  });
});

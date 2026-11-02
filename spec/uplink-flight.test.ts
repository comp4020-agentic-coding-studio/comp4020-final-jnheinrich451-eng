import { describe, expect, it } from 'vitest';
import { drawUplinkFlights } from '../public/logistics-effects.js';
import { ECONOMY } from '../public/logistics.js';

// A canvas stand-in that fails the way a real one does: a gradient with a non-finite
// coordinate throws, which aborted the frame while it was still rotated.
function fakeCanvas() {
  const calls: { name: string; alpha: number; args: unknown[] }[] = [];
  const state = { globalAlpha: 1 }, stack: number[] = [];
  const target: Record<string, unknown> = state;
  const gradient = (...args: number[]) => {
    if (!args.every(Number.isFinite)) throw new TypeError('The provided double value is non-finite.');
    return { addColorStop() {} };
  };
  target.createLinearGradient = gradient; target.createRadialGradient = gradient;
  target.save = () => { stack.push(state.globalAlpha); };
  target.restore = () => { state.globalAlpha = stack.pop() ?? 1; };
  return { calls, stack, c: new Proxy(target, {
    get: (object, name: string) => name in object ? object[name] : (...args: unknown[]) => { calls.push({ name, alpha: state.globalAlpha, args }); },
    set: (object, name: string, value) => { object[name] = value; return true; },
  }) };
}
const world = (station: object) => ({ logistics: { facilities: [{ id: 'station', kind: 'uplink', x: 60, y: 20, remaining: 0, cargo: 0, ...station }] } });

describe('rocket flight drawing', () => {
  it('draws nothing for an idle station when a snapshot arrives mid-frame', () => {
    // Blinking bars: a negative snapshot age made an idle timer look like a live flight.
    const { c, calls } = fakeCanvas();
    drawUplinkFlights(c, world({ launch: 0, cooldown: 0 }), 48, 1, false, -.005);
    expect(calls.filter(call => call.name === 'rotate' || call.name === 'translate')).toEqual([]);
  });

  it('survives the first launch frame arriving before the frame clock', () => {
    // Rotated map: a timer just above launchTime made the flight progress negative.
    const { c, stack } = fakeCanvas();
    expect(() => drawUplinkFlights(c, world({ launch: ECONOMY.launchTime, cooldown: ECONOMY.rocketCycle }), 48, 1, false, -.005)).not.toThrow();
    expect(stack).toEqual([]);
  });

  it('fades the stage stripes with the body at the end of the climb', () => {
    const { c, calls } = fakeCanvas();
    drawUplinkFlights(c, world({ launch: .01, cooldown: ECONOMY.rocketCycle }), 48, 1, false, 0);
    const stripes = calls.filter(call => call.name === 'fillRect').slice(-2);
    expect(stripes).toHaveLength(2);
    for (const stripe of stripes) expect(stripe.alpha).toBeLessThan(.02);
  });
});

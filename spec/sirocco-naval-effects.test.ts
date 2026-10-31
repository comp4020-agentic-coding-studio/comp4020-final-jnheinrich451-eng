import { expect, it } from 'vitest';
import { navalText, sandSeaAt, submarineDepthLabel } from '../public/biome.js';
import { drawShipWater, drawDiveBubbles } from '../public/ship-water-effects.js';
import { drawShip } from '../public/ship-effects.js';
import { drawSwimmer } from '../public/vehicle-effects.js';

const desert = { template: 'sirocco-v1', width: 3, height: 2,
  terrain: [0, 0, 2, 0, 3, 1], waterKinds: [1, 3, 0, 1, 0, 0] };
function canvas() {
  const colors: string[] = [], labels: string[] = [];
  const methods = new Set(['save','restore','beginPath','closePath','fill','stroke','fillRect','strokeRect',
    'translate','rotate','scale','moveTo','lineTo','arc','ellipse','quadraticCurveTo','bezierCurveTo','setLineDash']);
  const c = new Proxy({ globalAlpha: 1 } as Record<string, any>, {
    set(target, key, value) { if (key === 'fillStyle' || key === 'strokeStyle') colors.push(value); target[String(key)] = value; return true; },
    get(target, key) {
      if (key === 'measureText') return (text: string) => ({ width: text.length * 5 });
      if (key === 'fillText') return (text: string) => labels.push(text);
      if (methods.has(String(key))) return (...args: any[]) => {
        for (const arg of args) if (typeof arg === 'number') expect(Number.isFinite(arg)).toBe(true);
      };
      return target[String(key)];
    },
  });
  return { c, colors, labels };
}

it('distinguishes loose sand from real oasis water, solid land and bounds', () => {
  expect(sandSeaAt(desert, .4, .5)).toBe(true);
  for (const [x,y] of [[1,0],[2,0],[-1,0],[3,0],[0,2],[NaN,0]]) expect(sandSeaAt(desert,x,y)).toBe(false);
  expect(sandSeaAt({ ...desert, template: 'vesper-v1' }, 0, 0)).toBe(false);
});

it('keeps dry naval labels stable across repeated UI refreshes without changing legacy copy', () => {
  const text = 'Return to dock. Click water to sail at sea. Offshore dock / Ctrl / Dive';
  const dry = navalText(desert, text);
  expect(dry).toContain('sandport'); expect(dry).toContain('loose sand'); expect(dry).toContain('Burrow');
  expect(navalText(desert, dry)).toBe(dry);
  expect(navalText({ template:'vesper-v1' }, text)).toBe(text);
  expect(submarineDepthLabel(desert,'submerged')).toBe('under sand');
  expect(submarineDepthLabel(null,'submerged')).toBe('submerged');
});

it('draws bounded sand hover and burrowing effects without mutating authoritative hull state', () => {
  const ship = { id:'dry-vessel',kind:'submarine',x:.5,y:.5,angle:.3,driveSpeed:2,depth:'diving',depthRemaining:1 };
  const before = JSON.stringify(ship), { c, colors } = canvas();
  drawShipWater(c,ship,48,1500,false,3,12,desert);
  drawDiveBubbles(c,ship,48,1500,false,3,12,desert);
  expect(colors).toContain('#e0bc7b'); expect(colors).toContain('#cba061');
  expect(colors).not.toContain('#d1ece5'); expect(colors).not.toContain('#e8f6f3');
  expect(JSON.stringify(ship)).toBe(before);
  const water = canvas(); drawShipWater(water.c,ship,48,0,false,3,12,{template:'caldera-v1'});
  expect(water.colors).toContain('#d1ece5');
});

it('threads dry context through both hull sizes and leaves oasis swimmers wet', () => {
  for (const navalScale of [1,2]) {
    const { c, labels } = canvas();
    drawShip(c,{id:'buried-'+navalScale,kind:'submarine',navalScale,x:1,y:1,angle:0,depth:'submerged',diveBattery:120},48,true,1,1000,true,()=>0,desert);
    expect(labels.join(' ')).toContain('UNDER SAND');
  }
  const sand=canvas(),lake=canvas(),enemy={id:1,x:.5,y:.5,angle:0};
  drawSwimmer(sand.c,enemy,1,48,false,0,desert);
  drawSwimmer(lake.c,{...enemy,x:1.5},1,48,false,0,desert);
  expect(sand.colors).toContain('#e6be7077');
  expect(lake.colors).toContain('#a3dcd277');
});

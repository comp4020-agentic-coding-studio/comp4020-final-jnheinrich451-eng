import { ORBITAL_PAYLOADS } from '../public/orbital.js';
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { ASSETS, TABS, assetsIn, orbitalPrice, factoryPrice, specRows } from '../public/catalogue.js';
import { COSTS, quote } from '../public/logistics.js';

const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');

it('gives every asset a unique, stable code that matches its tab and order', () => {
  expect(new Set(ASSETS.map(a => a.code)).size).toBe(ASSETS.length);
  const prefix: Record<string, string> = { ground: 'G', rail: 'R', strike: 'S', logistics: 'L', navy: 'N', air: 'A' };
  for (const tab of TABS) assetsIn(tab.id).forEach((a, i) => expect(a.code).toBe(`${prefix[tab.id]}-${String(i + 1).padStart(2, '0')}`));
});

it('keeps catalogue cards and page markup in step', () => {
  for (const a of ASSETS) expect(html).toContain(`id="${a.card}" class="unit-card" data-force="${a.tab}" data-asset="${a.code}"`);
  for (const t of TABS) expect(html).toContain(`data-force-tab="${t.id}"`);
  expect(html).not.toContain('data-logistics-deploy'); // logistics buildings deploy from the catalogue
});

it('quotes prices from the shared economy table', () => {
  for (const a of ASSETS) expect(orbitalPrice(a)).toBe('payload' in a ? ORBITAL_PAYLOADS[a.payload as keyof typeof ORBITAL_PAYLOADS].cost : 'cost' in a && a.cost ? COSTS[a.cost as keyof typeof COSTS] : 0);
  const cannon = ASSETS.find(a => a.code === 'R-02')!, factory = ASSETS.find(a => a.code === 'L-01')!;
  expect(factoryPrice(cannon)).toBe(quote('artillery', true));
  expect(factoryPrice(factory)).toBe(quote('factory', true)); // factories can now be built by friendly local support
  expect(specRows(ASSETS.find(a => a.code === 'R-01')!).at(-1)).toEqual(['Cost', 'Free']);
});

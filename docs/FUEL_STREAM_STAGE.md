# Fuel stream: burning liquid and a longer reach

9 November 2026. The robot's fuel jet now looks and reads like a napalm stream, and it
reaches 7.5 tiles instead of 5. The ground fire, incendiary and gas ideas at the end
are proposals for the author to choose from; none of them is built.

## What the author asked for

The author still preferred "the slim to thick, the liquid form fuel jet. Like napalm
jet not the cheap fuel", with more of a physical feel: fuel should "stay at the
position when it was ejected", where the jet drew "like a red stripe". They asked for
1.5 times the range. Asked which jets, they chose the robot's alone: 5 to 7.5 tiles,
with heavy fuel (the flamethrower sentry and the tank's fuel secondary) staying at 8,
so a flamethrower sentry does not far outrange the machine-gun sentry's 7. They also
raised fire left on the ground, and better incendiary and gas effects, and asked for
ideas on those.

## What was already physical

The server already moved the fuel as separate packets: one leaves the nozzle every
100 ms (in practice every 130 ms plus the round trip for held fire), keeps the
direction it was fired in, travels 10 tiles a second (heavy fuel 14) and stops at the
first enemy or obstacle, killing on contact. Turning the nozzle never moved a packet
already in flight. The "red stripe" was only the drawing: one line of constant width
joining the packets.

## What changed

- Range (`public/weapons.js`): `FLAME.range` 7.5, up from 5. Packet speed, cadence and
  the per-player cap (12 packets; about 8 are in flight at 7.5 tiles) are unchanged.
  Heavy fuel keeps its own 8. The robot's automatic guard picks fuel inside 7 tiles and
  returns to the laser beyond 7.5 (it was 4.5 and 5). The field guide says 7.5 tiles.
- Drawing (`drawFuel` in `public/robot.js`, browser only):
  - The stream leaves the nozzle as a slim white-hot liquid rod and widens as it
    travels, to about 0.85 tile at the far end (heavy fuel 1.05). It blooms into
    rolling fire there, with a dark smoky fringe and lumps rolling along the body.
  - Between two packets the liquid fired in the meantime lies on a spiral around the
    nozzle, not on a straight line. So the stream is drawn by interpolating each
    packet's firing origin, bearing and distance travelled. A swinging nozzle bends
    it like a hose, and the stretched part thins.
  - A packet the server retires (it hit something or ran out) splashes into a flare
    and a fan of burning drops for about half a second, and drops fall from the tail.
  - The stream stays joined to the nozzle while the trigger is held: a shot within
    0.4 s counts as still firing. A pause of over 0.4 s between packets starts a
    separate stream.
  - Reduced effects draw a plain tapering ribbon with a light core: no sprites,
    turbulence, splash or smoke.
  - Fire and smoke are two cached gradient sprites, so a stream costs a few dozen
    image draws a frame.

The fire on the ground is cosmetic and gone within half a second. It must not read
as a lethal fire field, which is a gameplay object.

## Checks

- Unit: `spec/ground-weapons.test.ts` gained a test. A robot packet starts with 7.5
  tiles to go. It keeps its line when the nozzle turns away, reaches at least 7
  tiles and is gone within 0.9 s. Heavy fuel stays at 8. The two robot guard tests
  in `spec/guard.test.ts` move their distances out by 2.5 tiles. One test had placed
  the robot 8 tiles from a group whose third crawler stood 7.57 tiles away, so the
  robot now stands 11 tiles off. Full unit suite: 1,381 of 1,382 pass. The failure
  is `spec/campaign-mode.test.ts`, which predates this work: it still expects the
  shared save limit.
- Browser: `tests/browser/fuel-stream.spec.js`, run on the E-cores. It holds the jet
  in a real game, then checks two bands. Fire must appear near the robot, and also
  5.2 to 6.6 tiles out, past the old reach, in both full and reduced effects. It also
  sweeps the nozzle while firing.
  - The first versions found three problems. The sweep broke the stream into
    separate blobs, which led to the spiral interpolation.
  - The stream also came apart at gaps of 170 ms, shorter than real held fire, so the
    split moved to 0.4 s.
  - The stream also detached from the nozzle, because this machine sends a packet
    only every 200 ms or more.
  - The test's sample boxes missed the stream: after C the robot sits about a tile off
    centre. The test now measures in bands.

  The spec then passed both runs. Evidence:
  [stream](testing/evidence/2026-11-09/fuel-stream.png),
  [sweep](testing/evidence/2026-11-09/fuel-stream-sweep.png),
  [reduced effects](testing/evidence/2026-11-09/fuel-stream-reduced.png).
- The browser specs that use the robot's flame ran together on the E-cores: island, survival,
  frontier, sound, catalogue keys and this spec, 18 of 20 passing. Both failures were
  `tests/browser/frontier.spec.js` "robot guard". It parks the guarding robot about 6
  tiles from the drill's crawlers to see it open with the laser, which is now fuel
  range. The robot now parks 5 tiles further east, beyond 7.5 from every crawler, and
  the spec passed on both desktop and phone with no retries.
  The author has not played it yet.

## Proposals (first written as not built)

As of 9 November: proposal 1 and the visual parts of 2 to 4 are built, below.
Gas igniting and gameplay wind remain proposals.

These change gameplay or are larger visual passes, so each needs the author's choice
first. They respect the standing rules: fields are land-only and never harm friends,
Bulwarks ignore heat and gas, and active fields share bounded caps.

### 1. Fuel that sticks: burning pools

Where a packet ends on land, at its reach, or on an obstacle without hitting an
enemy, it leaves a small burning pool: about 0.6 tile across, burning about 4 s. A
packet landing on a burning tile renews the pool instead of stacking a second one.
This makes the flamethrower an area-denial tool: a player can wall off a corridor
or cover a retreat, which fits the README's "a way back".

- Contact: either lethal, like the jet and the artillery fire fields, or (my
  recommendation) a burn that sets the enemy fleeing for 2.4 s with damage over time.
  The burn would reuse the laser's existing burn, so a pool slows a rush without
  becoming a minefield.
- Routing: enemies treat a burning tile as costly, as they do fire fields.
- Bounds: one pool per tile, at most 12 per player and 48 in the world. These are
  separate from the artillery field caps, so a flamer cannot starve a barrage.
- Saved: pools go into the named campaign's combat state, so a restart does not
  drop them.
- Cost: contact is enemies times pools each tick, and the routing cost needs a
  measured test before claiming it fits.

### 2. Incendiary bombs and shells

Today a fire field is a dark disc filled with 58 similar flame tongues on a
golden-angle spiral, drawn from curves every frame.

- Impact: a napalm splash. A ring of burning globs is thrown outward with a fireball,
  then a smoke column rises.
- Body: irregular burning puddles of different sizes seeded across the area, not one
  even disc. The crisp outline ring stays, because it is the gameplay boundary. A
  shimmer band outside it marks the slowing heat band.
- Time: tall bright flames at the start burn down to low flames and embers in the
  last seconds, so the remaining time reads without the label. A scorch mark stays
  afterwards (browser-only, fading over about 20 s).
- Cost: sprite-based like the stream, which is cheaper than the current curves.

### 3. Gas

Gas is a lure that holds a number of kills, with no timer.

- A heavy, low cloud that hugs the ground and rolls slowly, with curling edges.
- Thin wisps drift out toward the 10-tile lure radius and back, so players can see
  the pull.
- The cloud thins as its kills are used. Each kill makes it pulse, and the last one
  collapses and disperses it.
- Only cosmetic until approved: gas igniting when fire reaches it would be a new rule
  (burning off the cloud in a flash, killing what it holds). Drawing a flash without
  that rule would mislead players.

### 4. Shared wind (cosmetic first)

One seeded wind direction per planet. Smoke from the stream, the fire fields and the
missile trails drifts with it. Later, if wanted, it could push gas clouds: a gameplay
rule.

## Fuel pools, and gas and fire against Breakers and Bulwarks (built)

The author approved proposal 1 and kept the fire and gas field logic (fire lasts its
time, gas holds its number of kills). They then redesigned how hazards treat Breakers
and Bulwarks, because Bulwarks took damage only from HE and Magnetic, so fire and gas
shells did nothing to them. Asked for the details, they chose:
- **Breakers:** gas hurts and confuses them instead of killing them on contact.
- **Bulwarks:** gas hurts them at 20 hp/s, fire halves their speed, and gas never
  lures them.

- Fuel pools (`FUEL_POOL`, `placePool`, `poolContact` in `public/hazards.js`;
  `leavePool` in `public/combat.js`):
  - A packet that runs out, or splashes on an obstacle, on land without hitting an
    enemy leaves a pool 0.45 tile in radius, burning 4 s. Water and rock get none.
  - One pool per tile: a new packet renews it instead of stacking a second. At most
    12 per shooter (the oldest goes) and 48 in the world, apart from the artillery
    field caps.
  - A Hunter or Breaker touching a pool burns and flees exactly as from the laser
    (2.4 s, 10 hp/s). A Bulwark slows. The centipede, skimmers and fliers are
    untouched.
  - Pools are saved in the combat checkpoint and sent in the snapshot as
    `combat.pools`.
  - Not built as proposed: I had suggested that enemies route around burning tiles.
    Pools appear and vanish every 100 ms while a jet is held, and rerouting every
    enemy on each change would spend the shared navigation budget. Contact turns
    them away instead, because they flee. The pools' runtime cost under a large
    battle has not been measured.
- Gas against Breakers and Bulwarks (`gasDps`, `gasConfusion` in
  `public/enemy-profiles.js`; `gasExposure` in `public/hazards.js`; `gasWear` in
  `public/combat.js`):
  - Both lose 20 hp/s inside a cloud: a Breaker (180 hp) in about 9 s, a Bulwark
    (450 hp) in about 23 s.
  - A cloud spends one of its kills only when such a unit dies of the gas inside
    it. Hunters still die on contact and spend a kill at once.
  - A gassed Breaker is confused while inside and for 3 s after. It drops its target
    and any windup and wanders at 60% speed (`wander`). Like burning, confusion
    interrupts a warned strike.
  - Gas still lures Breakers and never lures Bulwarks. Sleeping survivors take gas
    damage too.
- Fire against Bulwarks (`fireSlow` in `public/enemy-profiles.js`, `heatSpeed` in
  `public/hazards.js`):
  - Half speed inside an incendiary field, its heat band or a fuel pool.
  - No damage and no panic. It still walks through fire rather than around it.
  - `canDamageEnemy` now admits gas against Bulwarks. Fire, fuel, bullets and the
    laser still bounce off.
- On the unit (`public/app.js`):
  - A green haze with rising bubbles while gas eats at a unit.
  - Three stars circling a confused Breaker's head, and its label reads
    BREAKER / CONFUSED.
  - Heat chevrons beside a slowed Bulwark, labelled BULWARK / SLOWED.
  - A Bulwark's usual label is now BULWARK / HE + MAG + GAS.
  - Reduced effects hold all of these still.

Checks:
- Unit tests:
  - `spec/breaker.test.ts`: the old "lethal GAS contact" case became a test that gas
    wears a Breaker down (about 160 hp after 1 s), confuses it, and spends the cloud
    only on a gas death. Fire stays lethal.
  - `spec/bulwark.test.ts`: the old "ignores gas lure and heat" case became the new
    rules, with a combat test. In gas a Bulwark loses about 20 hp in 1 s, isn't
    confused, and the cloud keeps its count. In fire it takes no damage, doesn't
    flee, and is marked slowed.
  - New `spec/fuel-pools.test.ts`: placement, none on water, the splash short of a
    rock, burning out at 4 s, renewal, both caps, a Hunter set burning and fleeing, a
    Bulwark slowed and unharmed, and restore from a checkpoint.
  - Full unit suite: 1,411 of 1,412. The failure is the earlier save-limit test,
    `spec/campaign-mode.test.ts`.
- Browser:
  - New `tests/browser/enemy-status.spec.js` serves the game a real world snapshot
    with a gassed, confused Breaker, a gassed Bulwark and a slowed Bulwark, holding
    back the live stream, and captures desktop and phone.
  - The first capture showed the markers too small and drawn on the bodies (a
    Bulwark is drawn about 70 px across at desktop zoom). They are now sized from the
    unit and outlined.
  - Frenzy, seeded fronts, tank guard, fuel stream and enemy status: 10 of 10, on
    the E-cores, no retries. They ran on a local config without the shared 8082
    server, because another run held it.
  - Evidence:
    [enemy status, desktop](testing/evidence/2026-11-09/enemy-status-desktop.png),
    [enemy status, phone](testing/evidence/2026-11-09/enemy-status-phone.png).

The author has not played it yet. The alert station's redesign stays for later.

## Fire, gas and wind visuals

The author kept the fire and gas rules (fire burns for its time, gas holds its count of
kills) and asked for them to look real and move: flames that sway, gas that spreads to
a set bound, and the wind if it was feasible (9 November 2026). All of this is
presentation in the browser. Server rules, saves and snapshots are unchanged.

- Wind (`public/wind.js`, new): `windAt(world, time, reduced)` returns
  `{ angle, strength, dx, dy }`. It comes from a hash of the world's id (or name) and
  the server clock in ms, so every client sees the same wind at the same moment with
  no server state. It veers slowly over minutes (periods of about 97 and 233 s) and
  gusts over seconds. Reduced effects keep the direction but drop the gusts. It moves
  only pictures: smoke, sparks, flame lean and gas drift.
- Fire fields (`drawHazards` and the barrage sectors in `public/hazard-effects.js`):
  - The 58 bezier tongues are gone. In their place are cached-sprite flames of varied
    size on uneven glowing puddles, each flame with a glowing root so they merge into
    one burning surface.
  - Flames lean downwind, sway and flicker. They burn taller in the first two seconds
    and shrink to embers over the last four, so the time left reads without the label.
  - Sparks rise and blow downwind, and smoke plumes drift off with the wind.
  - A landing throws a fireball and a ring of burning globs for 0.7 s.
  - The heat band outside the ring shimmers.
  - The crisp boundary ring and the FIRE label are unchanged.
  - A fire that burns out leaves a dark scorch that fades over 20 s (browser memory, at
    most 24).
- Gas fields:
  - The cloud spreads from the impact to its full radius over about 1.5 s. The dashed
    ring is at the full radius from the first frame, because the gameplay area is
    whole at once.
  - Puffs roll and drift downwind, clipped inside the bound, and thin as the count
    falls.
  - A spent kill makes the cloud pulse for 0.6 s (tracked per field in the browser).
  - Faint wisps reach toward the 10-tile lure range and fall back.
  - The GAS n/m label is unchanged.
- Fuel pools (`drawFuelPools`, drawn after the fields in `public/app.js`): each pool is a
  small charred disc with a strong glow, four swaying flames and an orange rim like a
  fire field's ring, so it reads as live fire on the ground. It grows in over 0.15 s
  and fades in its last 0.6 s. It is drawn from `combat.pools`, at a radius of 0.45 tile
  unless the snapshot gives one, and at most 48 are drawn.
- Fuel stream: its smoke now blows downwind with the same wind instead of rising
  straight up.
- Reduced effects: flames and puffs hold still, with no splash, sparks, smoke, wisps,
  pulse or spread. Every boundary, label and pool stays readable.
- Cost: four cached sprites, bounded counts (at most 56 flames per field, 22 puffs per
  cloud, 48 pools), no per-pixel work.

Checks. `tests/browser/hazard-visuals.spec.js` draws real `makeField` fields and
pools through the shipped functions on an overlay canvas in an isolated game, at
1920 x 1080, at 390 x 844, and with reduced effects. It checks that:
- the gas covers more than half as much again at 3 s as at 0.3 s;
- the dashed ring is drawn at the full radius at 0.3 s;
- fire, gas and pools are all drawn;
- the fire changes between 5.0 s and 5.4 s, and holds still when reduced;
- the labels read FIRE 13s and GAS 6/6;
- the wind is the same for the same moment and different 90 s later.

Its first run failed all three cases, both times on the test's own measures. Pools
lasted 4 s but were measured at 5 s. The motion threshold of 5% was set before
measuring: the sway changed 4.8% of the sampled pixels in 0.4 s, and the threshold
is now 2.5%. After that it passed 3 of 3. The first images also showed the flames
too small and sparse, reading as orange droplets, so they were made wider and taller,
with glowing roots, before the final run. After the agent finished, an aged-field case was added, as the
working agreement asks: a second before expiry the fire still reads as fire, at under
70% of its earlier burning pixels, labelled FIRE 1s, and the spec passed 3 of 3 again
([aged fire](testing/evidence/2026-11-09/hazard-fire-aged.png)). The specs that draw fire and gas then ran on the E-cores with no retries, in two
batches. Batch one held hazard visibility, shells, missile fields, cannon controls,
orbital, the fuel stream and this spec: 25 of 25 passed. Batch two held bomber
mission, navy deployment, both Remote specs, submarine and MAC: 22 of 22 passed. The
gameplay half of this stage was being built in the same tree at the same time, so
these runs show the tree as it stood then. The full suite was not run, and the type
check passes.
Evidence: [desktop](testing/evidence/2026-11-09/hazard-visuals-desktop.png),
[phone](testing/evidence/2026-11-09/hazard-visuals-phone.png),
[reduced](testing/evidence/2026-11-09/hazard-visuals-reduced.png), and the gas
spreading at [150 ms](testing/evidence/2026-11-09/hazard-gas-spread-150ms.png),
[700 ms](testing/evidence/2026-11-09/hazard-gas-spread-700ms.png) and
[1.5 s](testing/evidence/2026-11-09/hazard-gas-spread-1500ms.png). These are drawings of
fields, not a live battle. The in-game fields appear in the existing shells and
missile-field specs above. The author has not played it yet.

## Final checks of the whole stage

One point needed fixing after the visuals work. The visuals spec's main screenshots
were taken after its last measured frame (17 s), so they showed a fire nearly out
and no pools (expired at 4 s). It now redraws the scene at 5 s before capturing.
The pool drawing reads its radius from `FUEL_POOL` instead of a copy.

On the combined tree: the type check passes. The unit suite passes 1,416 of 1,417,
and the one failure is the earlier `spec/campaign-mode.test.ts`. One browser batch on
the E-cores passed 33 of 33 with no retries: hazard visuals, enemy status, fuel
stream, shells, missile fields, hazard visibility, frenzy, frontier, seeded fronts,
tank guard and island. The full browser suite was not run. The author has not played
any of this yet.

# Fixed missile battery: HE, incendiary and gas

## Play the missile battery

Ground forces > **Missile battery** opens a 4-by-4 placement preview. The selected
tile is the top-left corner. Confirm deployment to enter its orbital targeting
view, or use **Operate cannon / missile battery** for an existing battery.
Aim with the mouse or tap; **R / Rotate area** swaps 12-by-18 and 18-by-12.
**LMB, Space or Launch 12** commits the volley. Escape returns to the parked body.
A robot guards while operating, using the existing facility handoff behavior.

The last missile launches at 2.75 seconds; the next volley becomes available
15 seconds later (17.75 seconds from first launch). Reload is shared across
operators and persists on restart. Choose 1/2/3 or the HE/Fire/Gas buttons. Each HE impact has a two-tile
blast radius, 110 center damage, 15 edge damage and separate cosmetic crater
artwork spanning 7.2 to 8.8 tiles. Seeded impact offsets vary up to 1.1 tiles in
each direction within the coverage sectors; sizes and orientations vary so scars
overlap without forming a tidy grid. The artwork includes a broad debris halo;
its size does not increase damage. Damage is restricted to monsters inside the committed rectangle, with
local radial falloff; the rectangle is not one instantaneous lethal blast.
Terrain and friendlies remain unchanged. Existing 48-mark/64-impact caps apply.

One battery per scout, four per world, and two whole volleys in flight globally
are temporary prototype limits. Cannon limits remain separate. Full capacity,
invalid placement or a target rectangle outside map/range rejects the action.
Rejected fire does not consume reload. A whole accepted volley continues after
control handoff; its assignments cannot be changed by later aim or ammo requests.
The 4-by-4 footprint blocks walking, weapons, construction and carriage travel.
During battery placement, ocean tiles are shaded red and any invalid 4-by-4
preview has a red outline and cross. A single water tile anywhere in the footprint
rejects placement on the server; completed solid flooring remains usable.

Battery records reuse the saved artillery collection with `kind: missile`;
older cannon records retain their behavior. No existing records migrate or move.
Live volleys remain transient like shells: paused with no connected observers,
retained across drills, reset on restart. Spent reload is retained on restart.
Dismantling is not part of this stage, as with railway cannons. No sound yet.

## Round fire/gas impacts

Fire and gas missiles now use the HE impact offsets and crater sizes. Each landing
emits a smaller cosmetic blast with 14 fragment/dust particles (six in reduced
effects), within the existing burst cap. It adds no HE damage and does not spend
gas charges. Land impacts leave cosmetic craters under the hazard artwork.

Each active patch is a circle centered on its missile impact, with radius 45% of
that missile's crater-artwork diameter (about 3.24 to 3.96 tiles). Fire/gas drawing,
contact, heat, avoidance and attraction use those scattered circles. Hazards are
clipped to the committed targeting rectangle; gaps between circles are safe.
The 216-tile reservation remains conservative. Fire lasts 18 seconds per landed
patch; all gas patches still share 18 kills. Cosmetic craters remain after fields
expire or are consumed, under the existing 48-mark cap.

Round-patch follow-up: 97 tests and all four fire/gas desktop/phone scenarios
passed. Updated checks verify circular contact, rotated clipping, matching impact
centers, cosmetic crater creation and minor-blast events. Desktop fire and phone
gas screenshots were inspected. The resource numbers below are from the earlier
rectangular-field workload, not a new performance measurement.

## Verification of this stage

Visibility follow-up: fresh rendering shows fire and gas above crater decals at
six seconds after impact (FIRE 12s and GAS 18/18), in both normal and reduced
effects. Pixel assertions and screenshots in `hazard-visibility.spec.js` verify
visible flames/vapor after the landing flashes end. A stale rectangular renderer
receiving circular patch records is consistent with labels but missing effects;
the user's exact in-memory browser version could not be inspected. HTML and state
snapshots now carry a build fingerprint. A mismatch reloads the tab once before
applying incompatible state, preserving guest cookies and saved construction.
Tabs opened before this guard was added need one manual refresh.

Fire/gas stage: `pnpm check` passes 97 tests across 17 files. New domain checks
cover rotated/partial coverage, full-area reservations, shared gas exhaustion,
late arrivals, staggered expiry, simultaneous fire priority, gas attraction,
fire avoidance, friendly immunity and immutable snapshots. Browser scenarios
exercise both new warheads on desktop and phone, shared state, ammo selection,
rotation, rejected reservations without reload, and restart durability.

Eight distinct desktop/phone scenarios passed across missile fields, HE missiles
and cannon controls. Inspected screenshots include the new fire and gas coverage.
An isolated four-client Docker workload used 256 MiB, no extra swap and the same
conservative 6.25% CPU quota as the HE check. It ran for 29.2 seconds, reached
24 active sectors across two volleys, attracted/killed nine crawlers across three
drills, retained exactly nine gas charges and expired the fire. Peak container
memory was 30.0 MiB, with no OOM events. Maximum snapshot size was 10,731 bytes;
the slowest measured request was 148.9 ms. See
`scripts/check-missile-fields-runtime.mjs` and the local
`.local/missile-fields-runtime.json` result. This bounded workload does not prove
sustained large-army performance or actual Fly hosting performance.


Crater/ocean follow-up: all 88 tests and both missile desktop/phone scenarios
passed again. Checks include water in the far footprint corner, rejected ocean
HTTP placement, disabled placement controls, four-direction scatter, and shared
7.2-to-8.8-tile crater sizes. Ocean phone and impact desktop screenshots were
inspected; the overlay is cached and adds no server simulation work.

`pnpm check`: 88 tests across 16 files passed. Six desktop/phone browser scenarios
passed for missile batteries, existing cannon controls and compact rails. Missile
cases exercise construction, shared ownership, invalid areas/ammunition/movement,
R/touch rotation, committed impact assignments, all 12 impacts, reload persistence
and handoff after restart. Screenshots in `docs/previews/missile-*.png` include
placement, flight and impacts; desktop and phone flight views were inspected.

Domain checks also cover full footprint collision, range corners, distributed
seeded impacts, independent volley caps, exact once-only impacts, damage to
monsters and unchanged world construction. CPU/memory checks below are bounded
workloads, not proof of large-battle capacity.

An isolated Node 24 Docker check used a 256 MiB memory limit with no extra swap
and a conservative 6.25% CPU quota. Four SSE clients and four batteries completed
four volleys (48 unique impacts), with at most two volleys active. The 22.8-second
workload peaked at 31.0 MiB of container memory, with no OOM events. The largest
snapshot was 12,420 bytes and the slowest measured request took 85.2 ms.
This is a short server check, not measured Fly performance or a browser graphics
benchmark. Reproduce with `scripts/check-missile-runtime.mjs` against an isolated
save; local results are in `.local/missile-runtime.json`.

All three missile warheads are implemented. The battery is 4-by-4, the area is 12-by-18 and reload is 15 seconds after the last launch.
The railway cannon's basic playable mechanics can be treated as the baseline:
construction, manual control, three shells, shared state, reload persistence,
rail travel and compact turns are implemented. Sound, visuals, balance, sustained
multiplayer testing and newly discovered defects remain ongoing work.

## User direction

- Fixed launcher with longer range and reload than the railway cannon.
- A group of missiles delivers HE, incendiary or gas across a 12-by-18-tile area.
- Launch upward, travel across the sky, then descend into the target area.
- Curved, weaving and intertwined visible trajectories are desirable.

## Implemented baseline (tuning remains provisional)

| Property | Current setting |
| --- | --- |
| Structure | Fixed 4-by-4 battery, manually operated |
| Range | 15 to 100 tiles, compared with cannon maximum 60 |
| Volley | 12 missiles, staggered about 0.25 seconds apart |
| Target footprint | 12 by 18 tiles; preview the complete rectangle |
| Flight | Approximately 6 to 10 simulation seconds, varying with distance |
| Reload | 15 seconds after the last missile launches |
| Controls | Orbital overview; mouse/tap positions rectangle; LMB/Space/Launch 12 commits one volley; 1/2/3 selects HE/Fire/Gas |
| Orientation | R or a touch Rotate button swaps the rectangle's long axis |

Use the existing single-operator facility handoff and parked robot guarding.
No automatic repeats in this stage, despite that older brainstorm in
GAME_IDEAS.md. One accepted command commits a whole volley; changing ammunition,
aim or operator afterwards must not alter or duplicate its remaining launches.
Launcher position, ammunition and reload are durable. Live volleys and fields
follow current combat semantics: pause while unused, reset on server restart.
Restart retains spent reload; it must not grant a free replacement volley.

## Impact and coverage

Interpret 12 by 18 as the target footprint, not 216 missiles or 216 separate
simulation entities. Divide it into three columns and four rows and assign one
missile to each sector. Modest server-seeded variation prevents every strike
looking identical without completely random clusters leaving huge gaps.

- HE: sequential local blasts sweep across the rectangle. A larger target area
  does not mean the entire rectangle receives one simultaneous lethal hit.
  Tune smaller individual blasts independently from heavy-cannon HE; reserve a
  bounded cosmetic crater/debris budget for the whole volley.
- Incendiary: impacts progressively activate overlapping round burning patches. Contact
  is lethal to monsters, heat slows near the boundary, and monsters avoid the
  burning region. Each landed sector lasts 18 simulation seconds. Covered area is the
  union of activated sectors, clipped to the displayed target rectangle.
- Gas: impacts progressively activate round gas patches that attract monsters. Use one
  shared kill capacity for the whole barrage, 18 kills. Unlanded
  missiles must not replenish an exhausted barrage. Keep the barrage reservation
  until its last impact, even if capacity was consumed earlier. No gas timeout.

Friendly players, vehicles and structures remain immune. Reject a target whose
full rectangle is outside map/range before committing reload; do not silently
clip an accepted salvo at the map edge. Damage and hazard contact cannot extend
beyond their advertised coverage. Cosmetic crater halos may overlap the rectangle
edge. Existing protection rules remain server-authoritative.

## Trajectories and budget

These are stylized guided paths, not unguided ballistic randomness. Server state
specifies seeded impact assignments, launch times and impact times. Browsers draw
rise, cruise and steep descent using smooth curves and restrained lateral sway.
Sway fades to zero at the landing point. Paths can visually cross without
missile-to-missile collision. Size, altitude offset, smoke and ground shadows
communicate height in the overhead projection; no 3D world is needed.

Bound each trail and particle count, cull off-screen decoration and retain a
reduced-effects mode. Do not stream individual smoke particles or simulate
guidance, exhaust or missile collisions on the server. Current limit: at
most two active missile volleys globally, tracked separately from the cannon's
eight-shell cap. Reserve every launch in the volley atomically before accepting it.

The shared hazard limits remain 12 active/incoming fields and eight per type.
An additional area budget caps reserved coverage at 512 square tiles total and
256 per type. A missile strike reserves all 216 square tiles at launch; a cannon
field reserves its circular area. Overlapping strikes still spend their full
area. This permits one missile fire field and one missile gas field together,
with limited room for cannon fields; it prevents stockpiling indefinite gas.
HE does not use the hazard budget. Rejected launches do not spend reload.

Each missile hazard is one grouped field with up to twelve landed circular patches.
Fire sectors expire separately, 18 seconds after their own impact. Gas has one
18-kill pool: overlaps never charge twice, fire takes priority, and later impacts
cannot replenish an exhausted pool. Exhausted gas disappears visually at once
but retains its reservation until the last incoming missile lands. Fire keeps
its reservation until its final sector expires. The full rectangle's area is
reserved even while only some sectors are active.

Gas lures to a reachable point inside an active sector within ten tiles. Fire
avoidance takes priority, and heat slows enemies outside the lethal region.
Only active sectors kill; unlanded sectors have no effect. Friendly damage is
never applied. Shared snapshots own timing and charges; browser effects are
bounded, culled off-screen and support reduced effects. Fields pause without
connected observers, survive drill changes and reset on server restart. Saved
ammunition and spent reload survive restart, without restoring a free volley.

## Build order and acceptance

1. **Implemented:** fixed battery, rectangle targeting, one HE volley and shared reload. Verify
   the area, cadence and impacts feel different from the railway cannon.
2. **Implemented:** incendiary/gas sectors, exact shared capacity, hazard reservations and monster
   routing. Test overlap, simultaneous arrivals, exhaustion before final impact,
   friendly immunity and pause/restart behavior.
3. Refine weaving, trails, launch/impact feedback and sound when assets exist.

Before raising limits, measure simultaneous volleys, pathfinding and bounded
visuals on desktop/phone and under the actual 256 MiB CPU/memory contract. Prior
small artillery workloads do not validate missile capacity. The short HE check
above supports the HE stage; sustained combined-force performance
and balance still require measurement and playtesting.

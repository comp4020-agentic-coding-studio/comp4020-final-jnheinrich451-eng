# Fixed missile battery: HE, incendiary and gas

## Extended range (31 October 2026)

The author doubled the maximum range from 100 to 200 tiles, because the battery
had fallen behind the bombers and ships added after it. The value is provisional
until playtest. The 15-tile minimum, area, volley, damage, reload and motion speeds
are unchanged.

- Elevation still spans 20 to 65 degrees, now spread across 15 to 200 tiles.
- Missiles keep their speed. Flight is `6 + distance / 25` seconds, so shots within
  100 tiles land exactly as before and a 200-tile shot takes 14 seconds.
- The whole area must stay in range, so its centre reaches about 190 tiles,
  depending on bearing. A farther aim still clamps along the bearing.
- Accepted volleys keep their saved impacts and flight. Saved launcher poses are
  not remapped: a launcher saved raised reads a longer range from the same elevation
  until it next turns, and the pale-blue area shows that truthfully.

**Verification.** A volley aimed past the limit through the real UI on isolated saves
clamped to 192.8 tiles at 1920x1080 and 189.2 at 390x844, with the far corner at
200.0 both times. All 12 missiles impacted. The phone area was open ocean, so it left
no craters, as intended; flight was 13.7 and 13.6 seconds.

`missile.spec` had a marginal time budget: 5 seconds for the volley to age past 3,
inside 55 seconds overall. It failed that way at the old range (1 of 4 alternating
runs) as well as the new one (3 of 4), too few runs to compare rates. With 20 and
100 seconds it passed 12 of 12, six at each size, each taking 55 to 60 seconds.

Open: one run failed at 31.8 seconds with `TypeError: v is not a function`, in a pass
where another test had just died on a V8 fatal check. No repository code calls a bare
`v`, its trace was lost and it did not recur, so the cause is unknown. It may or may
not relate to the 32.4-second phone failure below. No author playtest, Fly run or
balance evidence exists yet.

## Turreted launcher stage (31 October 2026)

This stage replaces the buried silo presentation and the instant aim described
below. The site stays fixed; only the launcher on it moves. All other sections
remain correct for footprint, area, cadence, damage and fields. The motion
numbers are provisional until the author's playtest.

**Author direction.** When operated, the base stretches out and a launcher rises.
It rotates like the cannon turrets, and its angle follows the aiming distance.
The author chose a real turret with turn time, firing at the actual aim as the
rail cannon does, at moderate speeds.

| Motion | Value | Notes |
|---|---|---|
| Deploy | 2.5 s | Advances only while operated; firing is refused until complete |
| Bearing | 60 deg/s | Shared `turnTurret`, shortest way round |
| Elevation | 15 deg/s | Linear with range: 20 deg at 15 tiles, 65 deg at 200 tiles |
| Stow | after 6 s, then 2.5 s | Waits while its own volley is in flight |

**Combat loop.** Aim with the mouse or a tap as before. The launcher deploys, then
turns and elevates toward that aim. A volley strikes where the launcher actually
points, so firing early lands short of the cursor. The fire request updates the
desired aim only; `batteryTarget` on the server decides the impact area. Preview
and server share `missileAim`, so range and map clamping match.

The gold rectangle is the desired area. The pale-blue dashed rectangle and diamond
show the actual area while the two differ.

| Status | Meaning |
|---|---|
| `Launcher deploying (n s)` | Still rising; fire is disabled |
| `TURNING / FIRES AT BLUE AREA` | Fire is allowed and strikes the blue area |
| `TURNING / HOLD FIRE` | The aim is valid but the current pose is not, so fire is disabled until the launcher turns |
| `... VOLLEY READY` | On target within 2 deg of bearing and 1 deg of elevation |

The bottom readout shows the live bearing and elevation. Reload, ammunition,
committed volleys and field budgets are unchanged, and reload keeps counting
whatever the launcher is doing. Each accepted missile saves a launch origin at the
pod muzzle, so trails leave the tubes.

**Saves.** `angle`, `elevation`, `deploy` and `idle` join the existing artillery
JSON. Aim is not saved, as before: restart clears `target`, so the launcher holds
its saved pose until someone operates it. Old battery rows need no migration. They
load stowed, facing north at the pose for 40 tiles, and move only when operated.
Server load no longer gives missile rows the rail cannon's default 75 deg
elevation, which lies outside this launcher's range.

Deploying, turning and stowing advance on the server tick, which runs only with a
connected observer. Pose is therefore never advanced offline.

**Presentation.** `drawBattery` stays pure overhead 2D: four outriggers extend from
the corners, a turntable carries the bearing, and the 12-tube box pod is drawn with
its top foreshortened by elevation and its tube face showing ahead of it. Tubes
show empty during reload. Collision still comes from the 4 x 4 footprint.

**Controls note.** Taking control keeps the existing default aim, 32 tiles east of
the battery, so an unattended launcher swings toward that point after deploying.
The orbital overview opens zoomed out, where the launcher is only a few pixels;
zoom in to watch it deploy and turn.

**Verification (31 October 2026, local only).**

- Domain and persistence: `missile`, `missile-fields`, `persistence`, `logistics`
  and `campaigns` specs passed (97 tests), and `pnpm typecheck` passed. New tests
  cover deploy, turning, firing at the actual pose, stowing, distant clamping and
  old rows loading stowed across two reopens.
- Browser: `missile.spec.js`, `missile-fields.spec.js` and `remote-control.spec.js`
  passed at 1920 x 1080 and 390 x 844. The first two were updated for crate delivery,
  the Ground tab, deploy and READY waits, and the 512 x 384 map. `aim-helper.js` now
  reads the saved world size instead of assuming 128 x 96.
- Live screenshots at both sizes were inspected for deploying, turning and ready,
  with no page errors.
- Open: one phone run of `missile.spec.js` failed after 32.4 s and its log was
  overwritten, so the cause is unknown. It did not recur: both later phone runs that
  reached the test passed.
- Open: Playwright workers often crash natively before a test starts (exit codes
  3221225477 and 2147483651, some with a V8 `Check failed`). Those runs executed no
  test code and were repeated.
- Not covered: `laser-missiles.spec.js` stops at the removed "Locate laser tower"
  button before its battery steps. Those steps still expect the old exact box and
  need a READY wait when the spec is revived. A domain test covers the clamped aim.
- Not covered: `rail.spec.js`, `shells.spec.js` and `cannon-controls.spec.js` fail
  at core landing or `artillery/control`, before any aim step. Rail cannon code was
  not changed in this stage.
- Not measured: author playtest, Fly behaviour and sustained combat load.

## Play the missile battery

Ground forces > **Missile battery** opens a 4-by-4 placement preview. The selected
tile is the top-left corner. Orbital cargo arrives in a crate; once it unfolds,
press **Remote (F)** and select the battery to enter its targeting view.
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
invalid placement or no legal strike rectangle on the selected bearing rejects
the action. Distant aim moves the complete rectangle inward to range/map bounds.
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
| Range | 15 to 200 tiles (100 until the extended-range record above) |
| Volley | 12 missiles, staggered about 0.25 seconds apart |
| Target footprint | 12 by 18 tiles; preview the complete rectangle |
| Flight | 6 to 14 simulation seconds, varying with distance |
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

Friendly players, vehicles and structures remain immune. Resolve the preview's
whole rectangle within map/range before committing reload; do not clip an
accepted salvo at the map edge. Reject unresolved or too-close areas. Damage and hazard contact cannot extend
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


11 October update: distant aim now clamps the full strike rectangle along its
bearing to maximum range/map bounds, shared by preview and server. Close-range
exclusion and budgets remain. See [the stage record](LASER_TOWER.md).

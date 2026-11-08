# Colony industry: first playable production chain

2 November 2026. Implemented locally for playtesting. These are initial balance
values. The stage adds machinery without regenerating terrain or gardens.

## Play the chain

Open **Industry** in the bottom toolbar. Start with a bio-generator and food
processor. Click a machine to inspect its ports, recipe, cargo and status. Load
crops from the shared reserve into both machines; starting power never requires
an already powered processor.

For automation, place a harvest outlet against a growing bed's outer edge,
pointing away from the bed. Lay conveyors into the processor input. Use **R**
or Rotate before placement; conveyors remain selected for repeated placement.
Existing equipment can also be rotated.

The processor has separate provision and biomass outputs. Route provisions into
any edge of the orbital pad to collect them in the shared reserve. Route biomass
into a generator to sustain power. Manual unloading is available at every
machine. Outlets gather ripe crops and replant the same free seed; watering or
a sprinkler is still needed for growth.

```text
bed -> outlet -> conveyors -> food processor -> provisions -> orbital pad
                                   |
                                 biomass -> bio-generator
                                                 |
                                      shared settlement power
```

Power is one settlement reserve: no wires or robot batteries in this version.
Belts run without power. Powered harvesting and processing stop without energy.
Pausing freezes production, fuel, cargo movement and shuttle time together.

## Initial balance

| Equipment | Materials | Footprint | Per-expedition limit |
| --- | ---: | --- | ---: |
| Conveyor | 1 | 1 tile | 96 |
| Harvest outlet | 6 | 1 tile, beside a bed | 8 |
| Food processor | 16 | 2 × 2 | 4 |
| Bio-generator | 12 | 2 × 2 | 4 |

The free first bed plus a generator, processor, outlet and six belts fit the
initial 40 materials. Extra raw-crop exports fund expansion.

| Processor recipe | Provisions | Biomass | Active time / energy |
| --- | ---: | ---: | ---: |
| 2 Sundrop | 2 | 1 | 12 seconds / 12 |
| 2 Moonberry | 3 | 1 | 18 seconds / 18 |
| 1 Cloudmelon | 2 | 2 | 24 seconds / 24 |

- Generators produce 2 energy/second. One raw crop supplies 24 energy; one biomass
  supplies 60. They prefer biomass and preserve partially consumed fuel.
- Shared power fills to 120. Full reserves stop further fuel consumption.
- Harvesting costs 2 energy; processing uses 1 energy/second while working.
- Belts hold one item per tile, taking at least 0.6 active seconds per transfer.
- Processor inputs hold 12 items; each processed output holds 8. Generator fuel
  buffers and harvest outlet output buffers hold 8 items.
- Raw and processed shared reserves each hold 99 items. Full destinations stop
  transfer without discarding cargo.
- Export 2 provisions for 24 materials after an 8-second shuttle trip. The
  original 2-crop / 16-material exchange remains available.

## Recovery and persistence

Every cargo item belongs to exactly one inventory. Belts move real items between
local buffers. Orders use authenticated, durable, deduplicated commands. Manual
machine revisions reject stale edits; automatic harvesting advances the bed
revision so a competing manual harvest cannot claim it again.

Unloading returns cargo and unfinished recipe inputs without refunding spent
energy. Dismantling additionally returns construction materials. Removing a
generator transfers unspent energy from its partially consumed fuel into the
reserve; recovery may exceed the normal refill threshold. If storage cannot hold
recovered cargo, the entire operation is refused. Nothing is discarded.

Machines are solid; belts are walkable. Placement checks terrain, equipment,
workers, arrival and walking routes. The first successful industry action adds
industry state and creates `colony-before-industry-v1.sqlite` in the expedition
data directory. Invalid placements and previews do not initialize an old save.
Partial jobs, fuel and cargo are saved; offline time does not advance them.

## Presentation and verification

Illustrated white metal, glass and warm status lights match the existing worker
and buildings. Cached chassis and ground-level belts preserve depth order.
Motion follows active machines and server cargo; reduced animation retains
readable state. Selected ports and preview arrows show cargo entry and exit.

Local validation passed:

- 71 focused tests: 22 industry domain tests, 18 existing colonization tests,
  six authenticated runtime tests, and 25 invariant/view/motion/nearby/media/
  atmosphere/planet checks. TypeScript also passes.
- Two new browser checks cover real UI construction of a complete harvesting,
  processing, biomass fuel and export line; two gardeners controlling the same
  generator; reload; and phone rotation, stalled processing and lossless recovery.
- A focused dropdown check keeps recipe/load controls mounted through power
  updates and a teammate changing cargo. Live readouts and capacity continue to
  update, selections survive, and pausing disables commands. This prevents
  routine production updates from closing the player's native dropdown.
  The final three-case run passed, but its runner retained a disposable test
  web-server process during teardown. Stopping that positively identified test
  process released the runner with exit 0; localhost and other processes were
  untouched. No failing test was retried to obtain these results.
- All 13 selected browser regressions pass: desktop/phone gardening, nearby
  inspection, shared cinema/atmosphere, Escape, projection and smooth local/co-op
  movement. The phone toolbar assertion was updated from five to six buttons.
- Runtime checks verify a valid pre-industry SQLite backup, no initialization
  on invalid placement, a concurrent cargo race, pause/restart during processing,
  partial fuel, replayed commands and an in-flight provision export across restart.
  Invalid backup files refuse the action without spending materials; retry and
  reuse of a valid pre-industry backup are also covered. A repeated fuel-recovery
  check verifies conservation across 20 cycles.

Browser integration uses newly allocated disposable expeditions with a seeded
established garden. Domain tests separately verify starter-kit affordability.
No developer save was reset or seeded. This stage has not been deployed.

Evidence: [desktop production](testing/evidence/2026-11-02/colony-industry-production-desktop.png),
[phone inspector](testing/evidence/2026-11-02/colony-industry-processor-phone.png),
[synthetic art layout](testing/evidence/2026-11-02/colony-industry-art-chain.png), and
[renderer measurements](testing/evidence/2026-11-02/colony-industry-renderer-performance.json).
The renderer-only Chrome probe measured 1.39 ms mean / 1.7 ms p95 for the desktop
chain, and 1.43 / 1.9 ms for the phone viewport. A maximum synthetic scene with
96 belts, 16 machines, 16 beds and four workers measured 4.88 / 7.0 ms, against
3.74 / 5.4 ms before the industry rendering. These are local drawing costs, not
whole-game FPS or measurements on a physical phone. Reduced-motion frames were
stable and the probes reported no browser errors.

## 8 November 2026: one card, one job, a charged start

The author's correction, in their words: the panel was "like an engineer
file", with many additional readouts and buttons inside each panel; keep it
simple, separate the functions, and if one facility has several functions
divide them into different facilities; and the colony is not the war zone,
where a player needs fast deployment, because here a player can stop and find
the category of each part. The same message reported the power loop: a
sunflower loaded by hand, then "it is like a dead loop", since power is needed
to run the chain that makes the fuel. The manual first load had been the
intended bootstrap, and nothing told the player so.

### Rules (server-authoritative, shared with the client)

| Rule | Value |
| --- | --- |
| Starter reserve | Shared power begins at 48 (`INDUSTRY.starterEnergy`) when industry is first initialised, flagged `starter: true`. An industry save without the flag receives 48 once on its next tick, capped at 120, never again. 48 covers an outlet harvest (2) and three sundrop batches (12 each); the first batch's biomass then fuels a generator. The grant is one additive field on a save already backed up at industry initialisation; nothing moves or regenerates |
| One job per machine | The processor has no recipe setting. It cooks the crop it holds most of that fills a recipe (ties in recipe order: sundrop, moonberry, cloudmelon) whenever that batch's outputs fit. `industry-recipe` is no longer a command (400, "Unknown industry command."). A saved `recipe` field on an older machine is ignored; new machines have none |
| Load chooses | `loadChoice(state, machine)`: a generator takes biomass if any is stored, otherwise the crop with the most stock; a processor takes the crop with the most stock; up to four, limited by room and stock; null when nothing fits. Belts have no hand-load control any more (the server action still accepts one) |
| Unchanged | Costs, limits, capacities, 2 power/s, 24/60 per crop/biomass, harvest cost 2, belt travel, recovery and dismantling rules |

### Presentation (`public/colony-industry-ui.js`)

- A machine card is three lines: the status word, what the machine holds in
  words ("4 Sundrop in · cooking Sundrop · 2 Provisions out"), and a hint only
  when the status needs something ("Needs fuel" → "Load a crop or biomass, or
  belt biomass into its IN side."). A processor shows its batch bar.
- At most three plain buttons: Load (generator, processor), Rotate (belt,
  outlet), Pause (everything but belts) and Remove. R still turns any selected
  machine on a keyboard. Unload left the card: Remove returns every item and
  the materials, and the server action remains for tests and recovery. The
  ports line, inventory table, recipe and load dropdowns, the second Load
  button and the guidance paragraphs are gone. The Orbital post link stays on
  the equipment overview, beside the reserve, and on its own tool.
- The card never rebuilds under a focused or pressed button: the app holds
  the card and live updates change its text and availability. A disabled
  button drops focus by browser rule, and only then may the card rebuild.
  Before this stage the hold covered native selects only, so the first run of
  the rewritten focus check found the card rebuilt under a focused button.
- The equipment overview keeps one sentence: power starts at 48, biomass feeds
  it back, arrows show flow, R turns equipment. The bottom dock is unchanged:
  its eight tabs are the categories the author asked to browse while stopped.

### Validation (8 November 2026, disposable saves and servers)

- `pnpm typecheck` passes. It had been failing on loose typings in the
  crate and direct-feed tests from 4 November; those are now typed.
- Vitest against a disposable server: industry 29 (one new test: the reserve
  starts charged exactly once, an old save is granted once, the processor
  cooks the crop it holds most of and then the rest, Load chooses biomass
  before crops and nothing when empty), crates, machinery 12, colonization,
  runtime and ground: 87 passed, 0 failed, after five tests that assumed an
  empty reserve now spend the starter first.
- Playwright pinned to the E-cores: industry 2, focus 1, crates 2 and life 2
  passed. The focus check was rewritten for the button card and failed twice
  before passing: once for the real hold defect above, once because it asserted
  that a disabled button keeps focus, which browsers never do.
- Also run pinned: Morrow cargo 1, nearby 4 and the main colony spec 2 passed, after
  the main spec's two reward assertions, missed on 4 November, were changed to
  count the waiting crates with the materials.

Evidence: [desktop card](testing/evidence/2026-11-08/colony-card-desktop.png),
[phone card](testing/evidence/2026-11-08/colony-card-phone.png).

### Same day, second correction: the outlet beside its bed

The author's screenshot showed a harvest outlet east of a ripe moonberry bed,
pointing south, reading "Output full · Bed 1 · 6 Moonberry waiting" with the
hint "Give the OUT side a belt or a machine." Two findings:

- Rotate could not come round. It turned clockwise, South to West, and West
  points into the bed, which the server refuses, so the outlet could never
  reach North or East again. Rotate and R now use
  `nextIndustryDirection(state, machine)`, which skips every direction whose
  OUT cell lies on the outlet's bed, so the circle always closes. A direct
  `industry-rotate` into the bed is still refused.
- The outlet had harvested twice and stopped because nothing stood on its OUT
  cell. The hint named the fix and the author still asked how to use the
  harvester, so the rule was the flaw, not the wording. A free OUT side now
  hands cargo to the shared reserve, as if the worker carried it: an outlet
  with nothing on its OUT cell harvests into the reserve, and a processor
  with nothing on its provisions or biomass cell sends them there. A belt or
  a receiving machine on the cell keeps priority, and a paused or full one
  holds the cargo inside as before; "Output full" now means the belt, the
  machine or the reserve is full. Belts remain the way to feed machines
  without hand loading, and the pad route still works for players who like
  to lay it.

Both are my calls on the author's bug report, flagged here for the playtest.
`spec/colony-industry.test.ts` covers them: a free-sided outlet harvests
into the reserve, Rotate skips the bed, a direct rotation into it is refused,
a free-sided processor sends both outputs to the reserve, and a paused belt
still holds cargo inside. Nine existing tests that watched cargo wait inside a
machine now seal its ports with paused belts; the runtime industry test polls
the reserve instead of the processor output. Vitest, nine colony files: 111
passed. Playwright industry 2, focus 1, crates 2 and life 2 passed again on
the E-cores after the change.

### Rejected the same day: power cables

The author asked whether cables meant a power area and, if so, to keep the
current shared reserve instead. No cables, no power area.

## Later stages

Robot charging, physical tending jobs, human-network commissioning, rush orders,
fishing and ponds remain later work. The
[furry mechanical spider companion](COLONY_MECHANICAL_SPIDER_PET.md) is recorded
for future world-and-behavior design, not implemented in this stage.

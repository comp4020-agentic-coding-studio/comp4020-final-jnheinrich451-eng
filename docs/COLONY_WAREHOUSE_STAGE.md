# Colony warehouse: the reserve in plain sight and drones that carry crates home

8 November 2026. The author's brief, in their words: disable the conveyor; set
up "a repo, or a warehouse, maybe virtual, but I think the real one is good",
for presenting, "the piles of boxes, placed in the warehouse, and maybe one
side is the product, one side is the material"; the material boxes shipped by
the shuttle "can be placed into the warehouse"; and "design maybe drones, to
carry them into the warehouse, the visual effect? Or they just vanish it feel
not good". Approved with the order "the warehouse and drones first", then pet
and fishing, then refinement of maps, UI and art. This record holds the stage
as built; it follows `docs/COLONY_LIVING_STAGE.md`.

## Rules (server-authoritative, shared with the client)

| Rule | Value |
| --- | --- |
| Warehouse | Industry kind, 3 x 3, 14 materials, one per expedition, no ports, Pause and Remove only. It needs fully conditioned ground and a walking route like every machine |
| The reserve | Unchanged underneath: materials, raw crops, provisions and biomass stay the shared numbers every machine and the orbital post already use. The warehouse shows them: one cardboard crate in the material yard per eight materials, one white product box per four items of crops, provisions and biomass, nine boxes a yard at most |
| Drone | One per warehouse. Whenever an unclaimed crate exists anywhere in the home district, the drone flies from the warehouse centre to the nearest crate at 4 tiles/s (never under 0.4 s a leg), then back with it; materials are credited when it arrives. No power is spent. The flight is a saved task `{ crateId, phase: out or back, elapsed, duration, from, to }` driven by active room time, so pausing freezes it and a restart resumes it |
| Hands first | A worker may still take a crate by hand while the drone is flying out; the drone turns round empty from where it is. A crate already hanging from the drone is out of reach: no prompt, and `collect-crate` answers "A drone is already carrying that crate." |
| Hidden kinds | Conveyors and crate collectors left the catalogue. The server still accepts them and every saved belt or collector keeps working, so no layout is lost. Machines pass cargo by touch and a free OUT side fills the reserve, so new gardens need neither |
| Footprints | Furnishing placement now knows every machine footprint (the collector's second row had been missed), so nothing can be furnished into a warehouse or collector |

## Presentation (browser-only; reduced motion settles)

- The warehouse (`public/colony-industry-art.js`) is a white storehouse with
  a shallow roof, an open loading front and two marked yards; the stacks are
  part of the cached base, keyed by the two box counts, so they redraw only
  when the stock crosses a step.
- The drone is a small white quadrotor with spinning rotors and a ground
  shadow; while returning it carries the tan crate on two short cables, and
  the crate itself leaves the ground pass while it is in the air. Its position
  comes from the saved task with the same bounded lead the machines use, so
  animation never outruns the server.
- The card reads Open, Sending drone, Drone fetching or Drone returning, and
  its holding line gives the yard's materials and the shelf's products.

## Validation

Local checks on 8 November 2026 with disposable saves and servers; no author
save was opened. This is not a deployment claim.

- `pnpm typecheck` passes.
- Vitest, nine colony files against a disposable server: 112 passed. The new
  test in `spec/colony-crates.test.ts` builds a warehouse, checks the hidden
  flags and the solid 3 x 3 footprint, watches the drone take the nearest crate
  first from the warehouse centre without spending power, refuses hand
  collection and the prompt for a carried crate, credits on return, turns the
  drone round empty when a worker takes its target, freezes everything while
  paused, clears every crate when resumed, and refunds the cost on removal.
  The first draft assumed the drone takes crates in landing order and parks
  after an empty return; both assumptions were wrong and the test now states
  the real rule.
- Playwright pinned to the E-cores: warehouse 2 (desktop and 390 px phone),
  industry 2, crates 2, life 2 and focus 1: 9 passed; then the main colony
  spec 2, Morrow settlement 3, rest 2 and Morrow cargo 1: 8 passed. The
  industry chain spec used to lay its belts through the shelf; it now seeds
  them, since conveyors are no longer offered, and asserts the shelf shows the
  warehouse and neither hidden kind.

Evidence: [warehouse, desktop](testing/evidence/2026-11-08/colony-warehouse-desktop.png),
[warehouse, phone](testing/evidence/2026-11-08/colony-warehouse-phone.png).

Known limits: the drone is small at the 1920 px zoom the spec uses, so a
screenshot shows it as a dot beside the loading front; the stacks step every
eight materials and every four products, so small changes do not redraw them;
the crate collector still exists in old gardens and its card still works, but
nothing new recommends it.

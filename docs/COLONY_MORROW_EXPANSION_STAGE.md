# Morrow: settlement, discovery and orbital delivery

2 November 2026. First playable expansion implemented locally following the
author's approval to redesign one planet. Morrow now connects gardening and
industry to furnishing, small settlement projects and two exploration regions.
The existing home terrain and gardens are preserved. This stage is not deployed.

## 9 November: Nacre and Aurelia

At the author's request, Furnish and Explore now open on Nacre and Aurelia too,
as the plan intended once the Morrow pilot worked. The catalogue, starter store,
projects, receipts and backup are shared. Two project names follow the world: "A
little of Nacre" or "Aurelia", and "Welcome to the lagoon" or "the terraces". Each
world has its own two regions, taken from the plan's proposed destinations:

| World | Region | Discoveries and their gifts |
| --- | --- | --- |
| Nacre | Glowcap Fen, a fungal wetland | Lantern cap (Hanging lights), Spore veil (Specimen case), Canopy arch (Flower trellis) |
| Nacre | Pearl Lagoon, a sheltered lagoon | Pearl reed (Reed planter), Glimmer shoal (Garden pond), Shell bank (Observation deck) |
| Aurelia | Fanleaf Uplands, wind-shaped uplands | Fanleaf tree (Meadow pergola), Amber skimmers (Specimen case), Singing ridge (Wind sculpture) |
| Aurelia | Mineral Terraces | Banded stone (Field worktable), Spring shoal (Garden pond), Observatory site (Observation deck) |

Every region uses the same 56 x 44 generator, now described per region by its
water, trail or terrace bands, and draws in its world's palette. Morrow's two
regions generate exactly as before: compared record for record with the 8 November
generator. Nacre and Aurelia saves gain both tools when opened, and their first
furnishing or survey command makes the same additive backup as Morrow's.
Expeditions on older templates keep neither.

Not done: planet-specific furnishings such as pearl lamps or mineral mosaics, and
discovery markers drawn for each world. The new worlds reuse Morrow's catalogue
and markers, so a gift such as the Meadow pergola still carries Morrow's name.
Morrow's freight loader and sprinkler work rule stay Morrow's.

Checks: the region and settlement specs pass, including reachability of every
discovery in all six regions and every gift being a real catalogue item. On the
E-cores with no retries, a Nacre desktop and an Aurelia phone scenario (travel,
walk, record, gift at home) and the five Morrow scenarios pass, 7 of 7. The full
spec run has one failure, `spec/campaign-mode.test.ts`, which still expects the
shared three-save limit that the author replaced on 8 November; this change did
not touch it. Nothing here has been played by the author.

## 4 November: toolbar fit and returning home

Following player feedback, toolbar copy is constrained to each button and the
longer subtitles are shortened. Text containment was checked at desktop,
tablet, landscape phone and 390/320-pixel phone widths.

While exploring, a visible **Return home** button stays available with field
notes closed. The toolbar's Garden control becomes **Home** and returns directly
to the settlement, instead of showing a misleading zero-bed count and reopening
field notes. Returning selects Garden; reloading in a remote region selects
Explore. The guide explains that buildings remain in the home district and Esc
only closes the current panel.

Two desktop/phone browser scenarios pass, including region travel, reload,
closed-panel return controls, pause guards, and preservation of the same bed
and completed furnishing. TypeScript checking passes. These changes are local.

## Try it

Open **Colonization**, create or continue a **Morrow** expedition, then use
**Furnish** or **Explore** in the bottom toolbar.

- **Furnish:** choose a category and finish, select an item, and place its
  footprint. Use **R** or Rotate to turn it. A utility shuttle approaches,
  lowers its crate, assembles the furnishing and departs. Paths stay selected
  for repeated placement while the delivery queue has space.
- **Rearrange:** select a completed furnishing on the ground or in the item
  list to move, rotate or store it. Stored objects can be delivered again for
  free. Undo applies to your latest unchanged furnishing edit.
- **Projects:** open the Projects tab for four optional goals: a lit route,
  a gathering place, a botanical corner and a welcoming orbital post. Claim
  each completed goal once for additional materials.
- **Explore:** travel to Blossom Grove or Stillwater Basin, walk close to a
  named discovery, then use **E** or the Record button. Each first shared
  discovery adds a journal entry, three materials and one themed furnishing
  to home storage. Return home to place it.
- **Orbital post:** send crops or provisions through the existing exchange.
  Morrow's shuttle now visibly loads, departs, returns with a crate and unloads.

## Content and pacing

The catalogue contains 22 original code-drawn furnishings across Paths, Garden,
Lights, Furniture and Shelters, with ivory, sage and violet finishes. It includes
stepping stones, paving, decking, borders, fences, lamps, hanging lights, seats,
a worktable, signs, planters, a specimen case, trellis, pergola, cabin, sculpture,
pond and observation deck. Cabins and ponds are decorative exteriors in this
stage; they do not yet provide interiors or fishing.

The starter store includes six stepping-stone tiles, two path lamps, one bench
and two flower planters. Purchased items cost materials; moving, rotating and
retrieving stored items do not charge again. The furnishing radius is 18 tiles,
with up to 144 placed items and four queued deliveries. Each delivery takes
eight active seconds and assembles at six seconds. Initial balance remains
subject to playtesting.

The original 72 by 56 home district connects to two separate 56 by 44 regions.
Blossom Grove contains petal bells, glasswing visitors and singing timber;
Stillwater Basin contains mirror reeds, silverfin and a dawnstone overlook.
These are six authored observations rather than an endlessly generated world.
The journal records shared progress; participants can explore different regions.
Home crops, machines and deliveries continue under the expedition's active-time
rules while the home region is out of view.

## Machinery and animation

Morrow sprinklers perform short watering tasks for growing crops that need
moisture, then hold their last angle. Overlapping sprinklers do not duplicate a
watering assignment. Conveyors move with actual cargo and stop when empty or
blocked. Processor, generator and harvesting motions follow accepted work and
saved mechanical progress. Pausing freezes production and transport; closing
the expedition does not create offline work.

Construction flights and material-return flights use the authoritative active
clock, with local interpolation for smooth presentation. Reduced animation
retains delivery/status markers without the full construction flight. Region
travel currently uses a short arrival transition, not a new orbital voyage.
Static furnishings use cached drawings; lighting is handled separately.

## Saves and shared play

The first valid furnishing or exploration command creates
`colony-before-expansion-v1.sqlite` in that expedition's data directory before
committing the added state. Invalid orders and previews do not initialize an
old save. Backup validation refuses unsafe continuation if the backup is broken.
Home terrain is retained; remote terrain and each participant's region/location
are saved. Existing Nacre and Aurelia saves did not gain Morrow furnishings or
regions at this stage (they did on 9 November, above); shared industry benefits
from the work-driven animation fixes.

Commands use durable request receipts. Repeated requests cannot spend materials,
deliver objects or grant discoveries twice. Revision checks reject stale co-op
edits; undo cannot reverse a teammate's later change. Solid and walkable
footprints are distinguished, and placement protects workers and essential
routes. A rate-limited rapid placement retries once with the same receipt ID.

Colony resources and progress remain entirely separate from Frontier combat
saves. Supporting the wider war remains part of the setting; authored military
supply requests and acknowledgements are future colony-local content. This
stage does not add a combat handoff.

## Validation and evidence

The focused unit/runtime suite passes 100 tests across 12 files. It covers
placement and routes, cost/storage conservation, delivery queues, undo conflicts,
project rewards, discovery races, region-scoped commands, runtime restart,
backup rejection, home production during exploration and working/idle mechanics.
TypeScript checking passes.

Twenty-two browser checks pass across the new scenarios and selected regressions.
They exercise actual desktop/phone controls, shared furnishing edits,
delivery and material-return timing, pause/resume, project claims, region travel,
discovery rewards, reload, crop tending, production, camera controls, movement,
nearby inspection and shared atmosphere. These use newly allocated disposable
expeditions; no existing player save is reset or seeded. The regression pass
found and fixed handling of rapid-placement rate limits and touch-pad overlap
with placement instructions. The existing phone toolbar assertion now expects
the two added controls, and the gardening check uses the shuttle's new flight
stage text. A cargo check initially allowed five seconds to reach a phase more
than five seconds into the eight-second trip; its wait now covers that duration.

Evidence:

- [Decorated Morrow home](testing/evidence/2026-11-02/colony-morrow-decorated-home-desktop.png)
- [Construction shuttle on phone](testing/evidence/2026-11-02/colony-morrow-shuttle-lowering-phone.png)
- [Returning material shuttle](testing/evidence/2026-11-02/colony-morrow-orbital-material-return.png)
- [Grove discovery](testing/evidence/2026-11-02/colony-morrow-grove-discovery-desktop.png)
- [Exploration on phone](testing/evidence/2026-11-02/colony-morrow-exploration-phone.png)

The [renderer probe](testing/evidence/2026-11-02/colony-morrow-renderer-performance.json)
uses a synthetic scene with 88 furnishings covering all 22 types, six growing
beds, four sprinklers, six machines, 24 belts, four workers and a construction
delivery. Desktop renderer calls measured 3.78 ms mean / 5.2 ms p95 by day and
3.87 / 5.5 ms at night. Emulated phone views measured 2.96 / 4.2 ms close up and
3.51 / 5.2 ms zoomed out. These are local Chrome drawing costs after cache
warmup, excluding simulation/network/UI work, not whole-game frame rates or
physical-phone measurements. Synthetic positions demonstrate rendering coverage,
not a legal settlement layout or progression result.

Fishing, the mechanical companion, cabin interiors, detailed supply commissions
and equivalent content for other planets remained in the
[broader casual expansion plan](COLONY_CASUAL_EXPANSION.md); the other planets'
regions followed on 9 November.

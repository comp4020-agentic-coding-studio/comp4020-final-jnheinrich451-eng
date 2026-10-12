# Construction, recovery and logistics

12 October 2026. First complete local version of the author's approved pipeline.

## Player loop

Choose a core landing site -> build a defended foothold -> destroy hostile sites
with HE -> send a recycler to the ruins -> unload at a launch station -> ship cargo
to orbit -> spend supplies on more equipment. Place factories to extend support and
trade deployment speed for lower cost. Losing facilities costs equipment and time;
permanent conquest never reverses.

Deploy a factory, launch station or recycler from **Deploy (B) → Logistics**
(L-01 to L-03; see docs/UI_REFINEMENT.md). Open the **SUP** header readout (or
press L) to command collection/delivery, launch cargo, cancel factory orders or
rebuild a dock/airbase. The recycler uses destination commands
in this first version; it is not a second player body or a WASD-controlled vehicle.
It stops if newly placed objects obstruct its route; issue a new command to replan.
A rocket launch closes the menu and centers the camera on the station.

## Placement and construction states

A completed friendly core provides a 24-tile radius measured from its center.
Factories provide the same radius once assembled. Teammates share support. The
whole land footprint must fit inside one circle; overlapping circles cannot each
supply half a building. Docks validate their shore platform, allowing the offshore
section to extend farther. Existing terrain/footprint/cap rules still apply.

This gate applies to airbases, docks, missile batteries, new rail cannons, factories
and launch stations. Initial cores, tanks, sentries, recyclers and track remain
available outside the circles. A deployed rail cannon may travel beyond support.
Conquest is not a build permission gate. Existing facilities outside the new radius
remain usable, replaceable and repairable. No relocation or world regeneration.

Factories (2x2) and launch stations (3x3) assemble for eight active seconds. Recycler
pods occupy one land tile and arrive in 4.5 seconds. Factory orders reserve their
full final footprint immediately; new placement/movement respects that reservation.
The browser draws blue support circles, gives a quote and explains invalid sites;
the server independently validates support and cost before accepting construction.

## Durable loss rules

Facility HP/armor covers cores, sentries, rail cannons, missile batteries, airbase
hangars, shoreline docks, factories, launch stations and recyclers. Ground claws
have penetration 2; acid has penetration 3. Facilities have armor 2 except recyclers
at 1; penetration below armor deals no damage. Values are centralized in
[logistics.js](../public/logistics.js). Existing vehicle damage rules remain.

Crawlers approach a reachable edge before striking. Mortars can target facilities
and damage them with their ordinary telegraphed acid impacts. Friendly shots still
cannot damage friendly units or buildings. Extending other enemy weapons to
facility damage is later polish; rails and terrain flooring are not HP entities.

Destroyed cores, sentries, artillery and logistics machinery release their slots.
Completed core flooring remains walkable. A remotely operated gun's destruction
returns control to its existing robot; it does not teleport that robot. Destroyed
recyclers/stations leave recoverable cargo. A destroyed factory cancels unfinished
orders for a half refund. Completed equipment does not require continuous support.

A destroyed dock leaves its ship intact; the ship can still use its shore ramp.
Rebuild the original dock through Logistics to restore docking/replacement.
A destroyed airbase leaves an airborne plane flying, including while rebuilding.
It cannot land there until repairs finish. Parked, delivering or landing aircraft
are lost with the base, and their pilots use the normal disabled-body recovery.
Airframe loss waits for a paid replacement instead of automatically creating one.
Damaged dock/base footprints stay reserved as wrecks until an eight-second rebuild.

## Scope and limits

Shared supplies, recovery exceptions, prices, salvage conservation and migrations
are specified in [ECONOMY_DESIGN.md](ECONOMY_DESIGN.md). Active limits remain: one
recycler per scout, four recyclers and twelve logistics facilities per room, plus
existing force limits. Cargo crates are capped at 64; further dropped cargo merges
into a retained crate. No unbounded autonomous factory queues or per-particle server
simulation. Construction and shipments pause with the campaign simulation.

This stage does not implement forward airstrips/alternate aircraft landing bases,
passenger transport, continuous robot reproduction, additional enemy types, or
production load guarantees. Those remain separate design work. No Fly deployment
is implied by local validation, and the author's introduction-video edits are not
part of this stage.

## Verification

- Domain and HTTP: spec/logistics.test.ts plus existing combat/persistence suites.
- Campaign freeze/ownership: spec/campaigns.test.ts.
- Browser: tests/browser/logistics.spec.js (1920x1080, 390x844, keyboard and resize).
- Regression: attack-jet and navy-deployment browser paths.
- Previews: docs/previews/construction-support-* and logistics-cargo-*.

The Windows browser runner can remain alive in teardown after reporting successful
scenarios; report scenario results separately from runner exit status. No local
save reset or live deployment is required for these isolated fixtures.

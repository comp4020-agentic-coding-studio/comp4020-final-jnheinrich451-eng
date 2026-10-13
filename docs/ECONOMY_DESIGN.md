# Conquest economy - first playable pipeline

Current local implementation: [Shared economy and support network](SUPPORT_NETWORK_STAGE.md).
The 14 October stage implements split campaign budgets, local processing, reusable
rockets and support outposts. It supersedes the single-pool rules and 20-second
factory pricing in this historical record.

The [14 October support-network design](BOMBER_AND_SUPPORT_NETWORK.md) proposes
global orbital delivery, 25%-cost/60-second local construction, paid aircraft
repairs and core receivers. These do not yet replace the implemented rules below;
the free allowance is confirmed as one bomber at an existing airbase per campaign.
The proposed small outpost also supports robot respawn. The author requests cheaper
local recycling and a reusable cargo rocket with a provisional two-minute cooldown
and return animation. The author confirmed separate campaign-shared ground supplies
for local construction/repair and orbital supplies for orbital delivery. Local
processing earns ground supplies; rocket delivery earns orbital supplies. Initial
balances, passive income and migration remain to be specified. Current shipment
timers and single-pool SUP accounting below still apply until implementation.

12 October 2026. The author approved placement, recovery, supplies, recycling,
shipping and factories in that order, then authorized completion of the whole
pipeline. Implemented locally; deployment and sustained Fly capacity are separate
checks. [Construction and logistics](CONSTRUCTION_LOGISTICS.md) records the stage.

## Combat purpose

Heavy equipment should be enjoyable to obtain and worth defending. Mistakes cost
supplies, but a campaign must retain a route back to robot control and HE conquest.
Conquest stays permanent. No enemy recapture, upkeep, ammunition bill or resource
mining chain is introduced. Ordinary firing, servicing and robot revival are free.

## Shared supplies

One server-owned campaign stockpile starts at 1200 supplies. Old saves receive the
same initial reserve once, preserving all existing equipment without retrospective
charges. Joining, reconnecting, deploying a core and creating another identity do
not refill that stockpile. Campaigns have independent ledgers.

Income is 2 supplies per active simulation second until the reserve reaches 250.
It does not run without viewers, while paused, during owner reconnect freeze,
while a room is closed or offline. Salvage can raise the balance above that reserve;
total storage is capped at 2000. A full storage bay leaves excess cargo at the
launch station rather than discarding or duplicating it.

The current tuning values are centralized in [public/logistics.js](../public/logistics.js):

| Deployment | Supplies |
| --- | ---: |
| Sentry | 25 |
| HE tank / replacement | 100 |
| Rail cannon | 180 |
| Missile battery | 220 |
| Gunship / replacement | 240 |
| Submarine / replacement | 280 |
| Armored transport / replacement | 200 |
| Airbase with aircraft | 300 |
| Aircraft exchange / replacement | 100 |
| Factory | 150 |
| Cargo launch station | 100 |
| Recycler | 60 |
| Bridge builder | 80 |
| Field bridge | 30 + 6 per water row |
| Replacement core | 120 |
| Dock rebuild / airbase rebuild | 90 / 150 |

A player's first core is free. A replacement core is free when no cores remain.
Bridge materials/timers live in `public/bridge-geometry.js`; see
[Bridge builder](BRIDGE_BUILDER.md). A failed placement spends nothing; losing
the builder during construction consumes the committed materials and removes
the unfinished crossing. Completed bridges currently have no HP or dismantling.
Track laying remains free. Technical ownership/population limits stay independent
of supplies. Recall/dismantling does not refund completed equipment, and friendly
objects cannot be farmed for salvage.

## Recovery guarantees

Robot revival at a completed friendly core is free. A disabled robot with no cores
remaining can return to orbit and choose a new emergency core landing site. Losing
a core does not erase a living robot or its owner's deployed identity. Completed
floor panels remain walkable after core machinery is lost.

If the room has no surviving explosive platform and less than 100 supplies, an
emergency HE tank can be deployed at a clear land site. This is room-wide, with a
20-second cooldown between emergency grants. It replaces an owner's destroyed tank
record if needed, permitting a new delivery site rather than forcing a blocked old
berth. One living platform blocks further emergency grants. Any standard tank can
switch back to HE for free. Normal income is a second way to fund a replacement.

The emergency path still validates terrain, occupied footprints and entity caps;
it does not place equipment inside an enemy or overwrite the map.

## Salvage and shipment

Each permanently conquered hostile structure contains 180 salvage, including
structures already conquered in an existing save. A recycler carries 180 and takes
eight seconds parked near a ruin to collect. Drive it with E/WASD, or issue a remote
route command while it is empty. Depletion is saved by site ID. It removes the central ruin artwork but
retains the objective, conquest state and checklist. No direct conquest payment is
also granted for the same material.

New ground alien deaths leave eight units of reclaimable remains. Nearby corpses
merge within two tiles; their saved piles share the 64-object cargo-crate budget.
At the cap, further corpses yield no new salvage unless they merge nearby. Swimmers
do not leave land salvage, and old cosmetic corpses are not retroactively credited.
Park within two tiles to pick up loose remains/cargo. Moving cancels ruin collection;
parked unloading has priority over collection. No direct kill payment is also given.

The recycler automatically unloads while parked at a stationary launch station; launching takes five
seconds and visibly sends a rocket upward. Supplies are credited only on launch
completion. The station stores up to four recycler loads. Destroyed recyclers and
stations leave unshipped cargo in recoverable crates. Cargo already shipped is
never also dropped. Saved launch progress resumes without a second reward.

## Factory trade-off

A completed factory extends construction support by 24 tiles. Heavy equipment built
inside its circle costs 60% of the orbital price and reserves its footprint for
20 seconds before becoming usable (then any normal pod arrival animation runs).
It is selected explicitly in the placement panel. Factory orders survive restart.
Cancellation refunds half the paid cost and removes the unfinished equipment.
Losing the factory cancels its unfinished orders under that same refund rule;
already completed equipment continues operating. Destruction of an unfinished
individual order itself gives no refund. No passive upkeep or power network.

## Persistence and evidence

Versioned logistics state lives in SQLite alongside the world. Initial migration
backs up populated saves. Cost deduction and object insertion commit in one
transaction. Tick checkpoints save supplies, salvage, cargo, launch/assembly
progress and facility HP. Named campaigns also checkpoint the causal combat state.
Legacy combat retains its existing transient behavior. Unknown logistics versions
are rejected instead of overwritten. The local reset tool already clears world
meta after making its backup; it does not clear named campaigns.

Checks cover shared spending races, rejected placement without charges, replayed
placement, construction cancellation/restart, bounded income, finite salvage,
shipments, cargo loss, factory loss, base repair, destroyed-core identity/flooring,
all-core-loss recovery and HE fallback. Browser checks exercise construction and
the collection/unload/launch loop on desktop and phone. Prices and timing need
human playtesting; these checks do not establish fun or production capacity.

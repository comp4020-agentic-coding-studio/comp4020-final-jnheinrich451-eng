# Bridge builder - standard and heavy crossings

## 24 October: heavy bridge profile

Implemented locally. The existing builder now offers **Standard** and **Heavy**
under **Plan bridge → Bridge type**, in both automatic and manual planning.
These are sizes, not water-specific vehicles: either profile can span ocean,
river or lake water within its limit. Ocean ships pass beneath completed spans;
Vesper's rivers and lakes remain closed to player ships. Swimmers retain access.

| Profile | Width | Interior deck rows | GND price | Construction time |
| --- | --- | --- | --- | --- |
| Standard | 3 tiles | 1–24 | 30 + 6 per row | 2 + 0.65 seconds per row |
| Heavy | 5 tiles | 1–48 | 50 + 10 per row | (2 + 0.65 × rows) × 5/3 seconds |

For example, a heavy bridge with 30 interior rows costs 350 GND and takes
35.8 simulation seconds. The maximum heavy crossing costs 530 GND and takes
55.3 seconds. Width scales materials and work by 5/3; tuning remains provisional.
Both profiles share the existing eight-bridge campaign cap and four-tile builder
reach. Full-width land anchors and approaches must be clear, as must all deck
cells. Mountains and rocks cannot be covered by a bridge.

The preview shows the entire footprint, price and duration. The camera frames
it beside the planner on desktop and above it on phones. Two cables tension,
then the full-width roller lays deck rows. Both traffic layers remain reserved
until completion; all five heavy lanes then support ground traffic. Construction
continues after the driver exits, but stops when the room simulation pauses.

Server admission selects an allowlisted profile and computes price/timing; client
width, price or duration overrides cannot discount construction. New records save
profile, width, cable/row timing, total duration and actual cost. Retrying the same
profile/endpoints, including reversed endpoints, returns the same crossing without
another charge; requesting a different profile on an existing crossing fails.
Legacy records without a profile retain three-wide geometry and original timing,
cost and direction. No saved terrain or bridge is regenerated.

Validation includes full-width obstruction and approach checks, both orientations,
48-row planning, legacy compatibility, inland-water exclusion, atomic payment,
retry handling and restart during construction. Desktop and phone browser checks
exercise switching profiles, manual/automatic planning, unfolding and driving the
builder across a 30-row heavy span. Local tests do not establish Fly capacity.

## Original standard-bridge stage

12 October 2026. Implemented locally after the author found a railway cannon
blocking the original causeway. The purpose is to open a second ground route for
recyclers and combat vehicles. Existing causeways and equipment are preserved.

## Player loop

1. Deploy **L-04 Bridge builder** from Deploy (B), Logistics. Wait for its pod.
2. Approach and press E to board; WASD drives. Park beside the near bank.
3. Face the water and choose **Plan bridge**. **Find shore ahead** starts with
   the builder's facing direction, rounded to N/E/S/W. Change the direction in
   the menu or tap that way on the map. The planner finds both banks, shows
   the route and quotes GND cost. Confirm only after reviewing the preview.
   **Manual endpoints** remains available for coordinate placement.
4. Confirm a valid crossing. Two parallel steel cables extend between the banks
   over two seconds. A moving roller then lays one three-tile-wide deck row
   every 0.65 seconds. The builder remains anchored until completion.
5. When **BRIDGE OPEN** appears, drive across. E can release the builder's seat
   during construction; the work continues while the room simulation runs.

The accepted crossing is framed by the camera, including on phones. Normal camera
pan/zoom and recenter still work. Movement resumes camera following.

## Placement and balance

- Straight east-west or north-south crossings only, with 1-24 deck rows between
  anchors. The span must include some open water; clear sand, grass and flooring
  are also allowed within it. Rocks remain blocked. Both anchors must be on land.
- Both full 3-by-1 anchors and the three-tile approach behind each must be clear
  land. The builder must be within four tiles of the near anchor and outside it.
- Reject occupied spans, facilities, docks, rails, pod panels and existing bridges.
- One builder per owner, four builders and eight completed/pending bridges per
  campaign. Builders use the existing utility vehicle seat, collision and damage
  rules, but do not collect salvage.
- Provisional orbital delivery price: 80 ORB for the builder. Each bridge costs
  30 plus six GND per deck row, including rows over land. A six-row crossing
  costs 66 GND and takes 5.9 simulation seconds. Local builder assembly uses
  the shared support-network discount and construction rules.
- The whole span is reserved immediately. Ground and water traffic wait until
  completion. Ships and swimmers can then pass beneath the deck wherever the
  original terrain is water; ground traffic crosses above them. Dry banks,
  anchors, causeways and docks remain solid. No pillars or height checks are added.
- Finished decks accept ground traffic but reject facility and rail placement.
  This prevents a new railway cannon from occupying the alternate route. Vehicles
  can still temporarily obstruct one another; this is not a traffic-routing system.

## State and persistence

The server owns admission, materials and elapsed construction time. Endpoints,
builder identity and progress live in the campaign's logistics save. Confirmation
checkpoints the charge and bridge together. Retrying the same accepted order does
not charge again. Existing saves acquire an empty bridge list without relocation.

Paused, closed, frozen or unoccupied rooms follow existing simulation rules; there
is no offline construction. Restart resumes the saved phase. Losing a builder
removes its unfinished bridge without a materials refund, reopening its reserved
water. Completed bridges remain after builder loss. The underlying terrain array
stays intact; navigation derives floor cells from completed bridge records.

Completed bridges have no HP or dismantle action in this first stage, like the
existing terrain crossings. No vehicle cargo, transport ship, diagonal bridge,
ship clearance, repair loop or engineering automation is included. The armored
transport ship is implemented in the subsequent [vehicle ferry stage](ARMORED_TRANSPORT.md).

## Validation

Geometry tests cover both orientations, bank/obstacle/occupancy checks, unsupported
spans, pathfinding and construction reservations. HTTP tests cover boarding,
rejected orders without spending, retries, movement locking, restart progress and
builder loss. Browser scenarios cover deployment, planning, cable/deck presentation,
driving across, and reloading on desktop and phone sizes. These local checks do not
establish deployed behavior or sustained four-player Fly resource usage.

Tuning: `public/bridge-geometry.js`; builder price: `public/logistics.js`.

## Uneven shoreline correction (17 October)

The author found that requiring every interior cell to be water made natural
zigzag banks impractical. The same shared client/server placement check now
accepts clear land between the anchors. The full 3-by-1 anchors and approaches
still require clear land; placement hints explain moving inland. Price, animation
and the 24-row span limit measure the entire deck, including land portions.
No terrain flattening, diagonal spans or save migration is needed. Construction
reserves land and water cells alike; the whole deck opens only on completion.
Existing bridges and the two-cable, row-by-row roller animation are preserved.

Validation: typecheck and 28 bridge/logistics tests passed, including horizontal
and vertical mixed spans, blocked land cells, saved construction and single GND
payment. Desktop (1920 x 1080, then resized) and phone (390 x 844) browser cases
built across staggered shores, drove across and retained the bridge after reload.
Cable/deck screenshots were inspected. This correction is local, not deployed.

## Direction-first planner (17 October)

The author then requested building toward a direction until reaching shore.
This supersedes manually picking two anchors as the default interaction. A
bounded survey searches at most three tiles to either side, preferring the
centre line, with the near anchor still within four tiles of the builder.
It finds the first full-width land anchor and land approach after crossing
water, within the existing 24-deck-row limit. Near anchors can sit inland; the
builder must stay outside the reserved deck. If no safe corridor exists, the
planner explains that the builder must move or choose another direction.

Only the preview performs this survey. Confirmation submits the exact previewed
endpoints through the existing server placement checks and atomic GND charge.
No payment or construction occurs just from facing a direction. Occupants or
obstacles that appear after the preview can still reject the order. Saved
bridges, prices, movement locks, construction timing and animations are unchanged.
The planner caches its survey between state updates; it adds no server worker
simulation. Phone previews keep the crossing above the scrollable controls.

Validation: typecheck and 34 bridge/logistics tests passed. Directional cases
cover all four bearings, a builder beside a jagged edge, nearby parallel routes,
missing banks and obstruction rejection. Desktop and phone browser checks cover
automatic and manual planning, wrong-direction rejection, confirmed cost,
unfolding, driving across and reload. Preview screenshots were inspected; phone
map controls no longer cover the far anchor. Updated modules are served locally
on port 8080; this stage has not been pushed or deployed.

The subsequent funding clarification shows shared GND and ORB balances directly
in the planner. Bridge admission uses only campaign ground supplies, never ORB
or a carrier's onboard store. Insufficient-funds messages include the available
GND, rounded-up shortfall and the core/outpost salvage-unloading route. The same
message is used by client and server. This changes no balances or currency rules.

Manual endpoints can now be picked in either order. Bank A/B are selection
labels; the preview and server orient new construction from the endpoint nearest
the builder, and either anchor satisfies the four-tile reach rule. Existing
bridges retain their saved direction. Reversing an already accepted order returns
the same bridge without charging again. Clear anchors, approaches, occupancy,
length and shared GND checks still apply.

## 22 October: ships beneath completed bridges

This supersedes the earlier rule that all bridge spans block ships. Water-level
navigation uses original terrain beneath completed decks, including authored
bridge tiles with recorded water underneath. Solid causeways are not excavated.
Existing saves need no migration. All four vessel types use the same rule; hull
clearance against shore, docks and other vessels still applies. Ship delivery
cradles and shore ramps cannot occupy the bridge.

The deck keeps its current artwork. Water-level ships and swimmers are masked
under it; ground units stay visible above it. A parked carrier aircraft follows
its ship beneath the deck, while airborne aircraft remain above. This is a
two-layer crossing rule, not an altitude or mast-clearance simulation.

The ship-scale follow-up is planned in SHIP_VISUAL_SCALE.md.

Validation: TypeScript and all 625 automated tests passed. Domain checks cover
all four vessels, water/land separation, unfinished reservations, other hulls,
delivery restrictions, saved restoration and aquatic pursuit. Desktop and phone
browser checks used two players: a recycler drove above a stationary crewed ship,
then the ship sailed through the crossing. Both screenshots were inspected.
Implemented locally; not pushed or deployed.

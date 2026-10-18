# Bridge builder - first crossing stage

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
- The whole span is reserved immediately. Ground traffic waits until completion;
  ships cannot sail under either pending or finished bridges in this version.
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

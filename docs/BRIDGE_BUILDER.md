# Bridge builder - first crossing stage

12 October 2026. Implemented locally after the author found a railway cannon
blocking the original causeway. The purpose is to open a second ground route for
recyclers and combat vehicles. Existing causeways and equipment are preserved.

## Player loop

1. Deploy **L-04 Bridge builder** from Deploy (B), Logistics. Wait for its pod.
2. Approach and press E to board; WASD drives. Park beside the near bank.
3. Choose **Plan bridge**, then click/tap the center tile of each bank anchor,
   or enter their coordinates. Both anchors are three tiles wide and one deep.
4. Confirm a valid crossing. Two parallel steel cables extend between the banks
   over two seconds. A moving roller then lays one three-tile-wide deck row
   every 0.65 seconds. The builder remains anchored until completion.
5. When **BRIDGE OPEN** appears, drive across. E can release the builder's seat
   during construction; the work continues while the room simulation runs.

The accepted crossing is framed by the camera, including on phones. Normal camera
pan/zoom and recenter still work. Movement resumes camera following.

## Placement and balance

- Straight east-west or north-south crossings only, over 1-24 water rows.
- Both full 3-by-1 anchors and the three-tile approach behind each must be clear
  land. The builder must be within four tiles of the near anchor and outside it.
- Reject occupied spans, facilities, docks, rails, pod panels and existing bridges.
- One builder per owner, four builders and eight completed/pending bridges per
  campaign. Builders use the existing utility vehicle seat, collision and damage
  rules, but do not collect salvage.
- Provisional price: 80 supplies for the builder; 30 plus six per water row for
  each bridge. A six-row crossing costs 66 and takes 5.9 simulation seconds.
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

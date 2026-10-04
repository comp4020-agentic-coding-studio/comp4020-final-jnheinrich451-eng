# Airbase and HE bomber: first flight stage

Implemented 2026-10-05. This stage establishes deployment, direct flight,
predicted bomb impacts, landing and rearming. It follows the air-force proposal
in GAME_IDEAS.md and the accepted WASD/LMB controls. Aircraft damage, hostile
anti-air, fuel, fire/gas bombs, precision strikes and carriers are later stages.

## Playable loop

From an active robot, open **Air force / Airbase + bomber**. The selected tile
is the top-left corner of a **6-by-10** runway, hangar and boarding apron.
The complete footprint must be clear land and at least 16 tiles inside the
map boundary to allow flight approaches. Ocean, rocks, landing pads, units,
existing facilities, core panels, tank pods and railway corridors are rejected.
One airbase with one bomber per scout; at most four per world. No resource
economy or factory queue is implied by this prototype.

Approach the gold apron and press **E / Board + take off**. A teammate may fly
an unoccupied bomber. The robot rides inside the aircraft; it has no independent
ground body or guard weapon while aboard. The saved seat is exclusive.

- **W accelerates; S decelerates.** Speed stays between 6 and 12 tiles/second.
  There is no reverse, hovering or in-flight stop. Releasing W/S retains speed.
- **A/D turns.** Turn rate decreases as speed increases, producing wider turns.
  Mouse movement does not steer the bomber or choose a ground target.
- The gold circles preview the six bomb impacts using current heading, speed,
  alternating lateral offsets and a fixed 1.8-second fall. **LMB / Drop 6 HE**
  accepts one six-bomb run, releasing at 0.25-second intervals. The aircraft
  holds its speed and heading through the 1.25-second release sequence. Bombs
  keep their accepted paths when the aircraft turns afterward.
- Each load carries **two runs**. HE uses the existing missile blast profile
  and four-tile cosmetic craters. Only enemies take damage; water gets impact
  effects without persistent land craters. Bombs share the existing limit of
  two concurrent barrages with missiles. Rejected releases spend no ammunition.
- After leaving the base area, return at **7 tiles/second or slower** within
  five tiles of the runway recovery point. A two-second landing animation
  returns the plane to its parking position. Rearming takes **eight seconds**.
  **Take off** starts another sortie, or **E** disembarks onto the clear apron.
- **Locate airbase** pans to the runway; **C** resumes following the pilot.
  Mobile has speed/turn buttons and a bomb-release button. No keyboard-only
  operation is required. Space does not fire an unrelated ground weapon.

Boundary guidance turns the aircraft inward before it leaves the map. It is
an explicit first-stage safeguard, not an invisible wall that stops a jet.
Ground obstacles do not block flight. Runway/apron terrain remains walkable;
hangars block ground units and direct-fire rays. Construction reserves the
whole airbase, separately from its solid hangar geometry. No terrain is replaced.

## Shared state and persistence

The additive `airbases` SQLite table stores each base with its aircraft. Old
worlds gain an empty table without regenerating terrain or modifying ships.
Boarding, launching, bomb admission and disembarking save before acknowledgement.
The existing half-second checkpoint persists flight pose, speed, servicing and
pilot position. State transitions are saved when completed.

Depth-independent aircraft state is shared over the existing SSE snapshots.
The server owns movement and bomb geometry; request coordinates/warheads cannot
override this stage's HE pattern. Aircraft access blocks unrelated weapons,
ground construction, navigation and other vehicle/facility handoffs.

With no connected viewers, flight and servicing pause. If a pilot disconnects
while another viewer remains, the saved aircraft continues cruising with expired
control input and boundary guidance. Reconnection resumes the same seat and
position. Restart retains speed, ammunition, seat and flight/landing/servicing
state. Like existing missiles, airborne bombs clear on restart; spent ammunition
is not refunded, and the transient release hold clears with them.

The base and aircraft are not enemy damage targets yet. This is a flight and
bombing prototype, not a balanced invulnerable endgame vehicle. Anti-air and
base-defense mechanics should be the next aircraft gameplay stage after review.

## Verification

- `spec/aircraft.test.ts`: full-footprint reservations, walkable runway and solid
  hangar, positive-speed flight, wider fast turns, bounded unattended flight,
  preview/accepted-pattern agreement, course hold, shared barrage limits,
  rejected ammunition, land impacts and automatic landing/rearming.
- `spec/aircraft-persistence.test.ts`: real HTTP deployment and seat admission,
  cross-pilot rejection, forbidden ground actions, authoritative HE release,
  restart without ammunition refunds, idle pause, offline-pilot movement,
  landing, saved ground service and apron disembarking.
- `tests/browser/aircraft.spec.js`: full desktop and phone deployment/flight/
  bombing/reconnect/return/rearm loop with a second viewer. Return flight uses
  the same steering keys, without a teleport or special landing endpoint.
  Screenshots are saved under `docs/previews/airbase-*` and `bomber-*`.

The graphics are original canvas geometry. Detailed textures, audio and further
balancing remain later work. These local checks do not establish sustained Fly
256 MB performance or multiplayer load capacity.

Verification result: type checking and all 161 domain/HTTP tests passed. Six
browser cases passed across desktop/phone bomber, gunship and submarine flows;
airbase and bomber screenshots were inspected at both target sizes. Two phone
cases were rerun sequentially with a separate artifact directory after concurrent
Playwright runs collided during trace cleanup. The local preview was restarted
from a backed-up world; existing saved rows were checked after startup.

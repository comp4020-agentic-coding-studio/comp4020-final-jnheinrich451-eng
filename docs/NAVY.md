# Coastal gunship — first navy stage

Implemented 2026-10-04. The first ship arrives from orbit in a floating cradle
near shore. Vehicle destruction and swimming enemies are now implemented in
[Vehicle combat](VEHICLE_COMBAT.md). Shipyards and carriers remain later stages.
This gives us a complete deployment and sailing loop to review
before adding the economy or another enemy class. README updates remain grouped
at agreed stage checkpoints.

## Playing this stage

Deploy your orbital core first. In the deployment menu, change **Ground forces**
to **Navy**, choose **Coastal gunship**, and select coastal water. The preview
marks the cradle and its shoreline boarding point. Confirm the orbital drop,
then approach the shore point with your robot and press **E / Board ship**.

- **W/S** sails forward/reverse; **A/D** steers the hull. The touch pad supplies
  the same commands. Steering in place is allowed in this first handling model.
- Mouse or a map tap selects the desired target. The cross marks the request;
  four blue diamonds show the actual main-gun impacts.
- **One LMB click / Space press / Volley tap** fires one ready twin turret.
  **Two rapid clicks/presses** fire all ready main turrets as a salvo.
  **1/2/3** selects HE, Fire or Gas. Each turret reloads independently for six
  seconds, with a 6-to-40-tile targeting range and 60-degree/s traverse.
- **Held RMB / J / Side guns** fires the eligible port or starboard secondary.
  Each has an outward 160-degree arc, eight-tile range, independent 270-degree/s
  traversal, and 180ms shot interval. Turn the hull to bring a side to bear.
  Readouts show range, arc, tracking and readiness; close aim shows firing arcs.
  These guns work during the main reload. See [Ship armament](SHIP_ARMAMENT.md).
- **Show dock** pans to your original shore point. Return within 0.8 tiles of
  a completed berth, align within 22.5 degrees of its axis (either direction),
  and press **E / Disembark**. A blocked exit keeps the robot aboard.
- **G / Shore ramp** anchors the ship near another clear shoreline and deploys
  a short boarding ramp. **E** disembarks or boards there; **G** retracts it
  before sailing. Reach is two tiles from the hull edge. See
  [Shore ramp](SHORE_RAMP.md) for transport, clearance and saving rules.
- **Find my ship** and **Find my shoreline dock** are available in the Navy tray.
  You may use another friendly ship's completed, clear berth.

One gunship and one [missile submarine](SUBMARINE.md) per scout, four vessels
total per world, without a resource cost in this field test. Use Selected vessel
in the Navy tray to choose the vessel to find or replace.
An empty vessel can be boarded by a teammate. The robot rides inside and has
no separate outside body or autonomous guarding. Offline drivers retain their
seat; exit before leaving if someone else should use the vessel.

## Placement, simulation and persistence

The hull occupies a 2-by-4 oriented rectangle. Its initial delivery cradle needs
3-by-5 clear water, with a clear land boarding point 3–5 tiles away in a cardinal
direction. Intervening tiles must be water. Existing bridges, land, rocks and
other hulls obstruct sailing. The server tests rotated rectangles against the
terrain and other vessels, subdividing movement into steps no longer than 25ms.
Forward speed is 2.5 tiles/s, reverse 1.5, hull turn speed 36 degrees/s.

The shoreline tile is reserved against construction. The gangway is a boarding
transition, not a walkable ocean-floor overlay. No water is converted into land.
Only a nearby active robot can board an available, completed, moored ship.
Operators cannot place ground equipment, use personal weapons or take facility
control while aboard. Friendly damage remains disabled. Surface fire/gas reuse
the existing fields. Surface swimmers and their hull attacks are covered by the
vehicle combat stage; underwater depth mechanics are not implemented.

An additive `ships` SQLite table preserves cradle progress, berth/dock, hull and
turret pose, ammunition, reload and seat. Deployment and seat/ammo changes save
before acknowledgement; driver and ship movement checkpoint together every
half second and on disconnect. Input expires after 400ms. Restarting at sea
restores the seated robot inside its ship rather than applying land fallback.
Delivery and reload pause without viewers. In-flight shells and active fields
remain transient across server restart, consistent with the artillery stage.

The descent, splash rings, unfolding floats, wake and interpolation run in the
browser. No particle entities or water physics are synchronized. Reduced effects
removes wake animation and reduces splash rings. The hull is a temporary canvas
design, independent of collision dimensions; no new asset downloads are needed.

## Validation

`spec/ship.test.ts` covers placement, ocean preservation, dock reservations,
rotated/swept sailing collision, berth alignment, server aiming, interrupted
arrival, idle pause, seat exclusivity, stale input expiry, restart at sea,
blocked exits, shared reload and fire/gas creation. Tests use isolated databases.

`tests/browser/navy-deployment.spec.js` runs delivery, boarding, sailing, firing,
restart and docking with a second viewer at 1920×1080 and 390×844. Screenshots
in `docs/previews/navy-*` record survey, arrival, sailing and docking. The existing
tank deployment browser flow is also checked because these systems share body
handoff and pod presentation. Automated play does not establish balance, naval
combat quality or capacity under a large sustained battle.

At this checkpoint, type checking and all 114 domain/HTTP tests passed. The
four navy/tank browser cases passed on desktop and phone, with screenshots
inspected. The local preview was restarted after backing up its SQLite save;
existing world and construction records were retained. This is local validation,
not a Fly deployment or a 256 MB capacity benchmark.

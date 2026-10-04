# Railway junction switches

**Legacy stage:** the user's subsequent correction is implemented in
[one-tile railway connections](COMPACT_RAILS.md). New junctions use directional
steering directly. The broad curves and controls below remain for existing saves.

Playable stage, 2026-10-02. An existing broad curve can now be upgraded into a
junction with a saved straight or curved route. Ordinary curves retain their
previous behavior until upgraded. WASD travel and independent cannon aiming
remain as described in [cannon controls](CANNON_CONTROLS.md).

## Building and using one

1. Lay a broad curve and its two straight endpoint supports. Extend the straight
   track through the curve's first endpoint to make the alternative route.
2. Inspect the curve's center in **Site controls** and choose **Install junction
   switch**. Only its owner can install it; both routes must be connected and
   the turning apron must be clear of cannons.
3. Open **Ground forces > Rail junction switches**, or **Switches** in the cannon
   manual. Choose a junction and select its straight or curved route. Any active,
   connected teammate may operate an installed switch.
4. Choose before entering. Cyan highlights the selected route; amber and
   **LOCKED** mean a cannon occupies or reserves the turning apron. **Inspect on
   map** centers the camera on that junction.

For a clear eastern example, lay EW five-tile segments centered at **64:19,
68:19, 72:19 and 76:19**, NS segments at **71:22 and 71:26**, and an **NE curve
centered at 68:22**. Inspect 68:22 to install the switch. Deploy the cannon at
64:19 and drive east with D. Straight continues along row 19; curve turns south
to 71:22. After the turn, S continues down the branch. Move to 75:19 on the main
line or 71:26 on the branch to clear the whole apron before changing routes.

All four curve orientations work. Their first endpoint is the common junction
point; the alternative straight route continues along that endpoint's tangent.
An unselected branch cannot silently feed through closed points. If approaching
from the wrong leg, back out until the apron is clear, then change the route.

## Shared rules and persistence

- The server validates routes, connectivity, active-player state and ownership.
  Explicit route-setting is idempotent; repeating the selected route changes
  nothing, including while locked.
- A cannon's entire 3-by-3 footprint and saved movement reservation lock the
  whole existing 8-by-8 turning apron. Stationary and disconnected cannons also
  keep it locked. No teammate can change points underneath a carriage.
- Track removal inside a locked junction is rejected. Removing an empty curve
  removes its switch record in the same SQLite transaction. Ownership rules for
  removing track remain in force.
- Additive `rail_switches(x,y,route)` records are saved before success and shared
  in snapshots. Existing worlds and curves are preserved. A restart retains the
  route and resumes any saved turn; operator control is released as before.
- Removing support track while clear may disconnect a route. Selecting a
  disconnected route is rejected, and carriage movement still validates its
  footprint and destination. The panel explains which supports are missing.

This is a two-route junction, not a train signalling or automatic navigation
system. Overlapping turning aprons, crossings and multi-car trains remain outside
this stage. The conservative apron lock favors predictable shared behavior.
Existing limits remain 256 track pieces and eight cannons; this change does not
establish large-battle capacity or replace the earlier resource measurements.

## Verification

Domain tests cover all four orientations, forward/reverse travel, straight
continuations, closed-leg rejection, full-footprint locks, saved reservations and
missing support tracks. Two-player browser scenarios exercise installation,
shared route changes, locked changes/removal, real WASD travel, restarting
mid-turn, saved straight selection and owned removal on desktop and phone.
The restart fixture explicitly reconnects the second player before testing
ownership. Screenshots are in `docs/previews/junction-*.png`.

`pnpm check`: 64 tests across 13 files passed. Eight targeted browser scenarios
passed across `switches`, `cannon-controls`, `frontier` and `rail`, covering both
desktop and phone. The desktop open-junction and phone locked-junction screenshots
were visually reviewed. An older overlap assertion was updated to the revised
placement message; the rejected placement itself is unchanged.

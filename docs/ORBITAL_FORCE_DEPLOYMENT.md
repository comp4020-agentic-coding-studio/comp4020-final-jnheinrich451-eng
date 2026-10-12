# Orbital aircraft and shore deployment

12 October 2026. The author confirmed delivery to an airbase before boarding and
an unfolding dock with the ship alongside. This stage implements both locally.

## Combat loop and boundaries

Choose Air force > Orbital attack jet. With no owned airbase, place a clear 6-by-10
runway; otherwise delivery exchanges the parked, unoccupied aircraft at that base.
An occupied, airborne, destroyed or servicing aircraft cannot be exchanged. One
base/aircraft per player and four bases per world remain the limits. Existing
bomber saves remain bombers. No second player body or automatic pilot transfer.

The 4.5-second capsule arrival is saved and blocks boarding until complete. At the
gold apron, E boards and takes off. W/S changes positive forward speed; A/D turns.
Hold LMB, Space, or the on-screen autocannon button for forward HE strafing. The
heading marker shows the accepted impact ten tiles ahead, independent of mouse
aim. Initial tuning: 90 rounds, 120 ms server cooldown, 0.22-second flight,
0.65-tile blast radius, 28 centre damage falling to 6 at the edge. Small craters
and fast gold tracers distinguish the weapon from bomber runs. Client requests
are spaced at least 140 ms apart; actual cadence depends on network round trips.

Return slowly to the base to land and service for eight seconds. Anti-air can
shoot the jet down; existing pilot recovery and a same-model replacement apply.
Friendly damage remains disabled. Bombers cannot use the autocannon and jets
cannot release bomber runs. Empty ammunition, boundary turns and off-map impacts
reject fire without spending rounds. Strafing shares the airborne salvo list and
rejects at 16 pending salvos; existing heavy-weapon limits are unchanged.

Fuel, guided missiles, base destruction, multiple parking slots, carriers and
economy remain later stages. These values are starting points for playtesting.

## Navy arrival and placement

Select coastal water three tiles out from a clear shoreline. The preview shows
the whole dock and the berth alongside it. The 1-by-1 capsule lands on shore,
unfolds sideways into a 3-by-1 platform, then extends five rows of three panels
into the sea. The ship appears beside the completed 3-by-5 offshore dock; the
sequence finishes at 4.5 seconds. Geometry and animation rotate with the coast.

All shore cells, water dock cells and the adjacent 3-by-5 ship cradle are validated
and reserved before accepting deployment. Choose the opposite berth side when the
first is obstructed. Reject occupied terrain, construction and overlapping docks.
The ship can board from the shore point, sail forward away from the dock, return
and disembark. The separate retractable shore-ramp controls remain available.

The water dock is a reserved obstacle to ships, not a terrain conversion or a
new walkable bridge. Old ships retain their narrow dock and original saved berth;
only new UI deployments use the unfolding layout. Save the layout and original
selection coordinates so repeat requests and vehicle replacement retain identity.

## Authority, rendering and validation

The server owns arrival timers, aircraft seats, accepted fire, ammunition and
impacts. Named campaigns checkpoint accepted ammunition and projectiles together.
Unused rooms pause; delivery resumes from its saved timer after restart. Clients
render capsule descent, sequential metal panels and small impact/splash effects.
Reduced effects omit the large capsule descent and extra particles. Audio awaits
sound assets.

Domain checks cover interrupted delivery, model-preserving recovery, service,
fixed accepted HE impacts, cooldown/ammunition/cap gates, friendly immunity, and
all four coastal layouts with obstruction and departure. HTTP checks cover peer
permissions, duplicate delivery, blocked boarding, pause/restart and spent rounds.
Desktop/phone browser checks exercise arrival, boarding, held fire/release, peer
state, saved flight and navy departure/return. These are local checks, not evidence
of deployed performance or final balance.

Local preview evidence: [jet capsule](previews/jet-delivery-desktop.png),
[phone strafing controls](previews/jet-strafe-mobile.png),
[completed coastal dock](previews/navy-docked-desktop.png), and
[phone shore arrival](previews/navy-arrival-mobile.png).

Validation on 12 October: the full domain/HTTP suite passed; the added berth
regression and final TypeScript check passed. Eight desktop/phone browser
scenarios passed across attack jet, navy deployment, bomber flight and anti-air
recovery. Screenshots were inspected at 1920-by-1080 and 390-by-844. On this
Windows runner, Playwright remained in process teardown after all scenarios
reported OK; the runner was interrupted at that point. No Fly deployment or
resource-capacity claim is made for this stage.

## Recall a naval deployment (12 October follow-up)

The author requested removing an old dock to deploy the unfolding version.
Add an explicit Navy > Recall ship + dock action for the selected owned vessel.
The ship and dock remain one saved deployment in this stage: recall removes both,
frees the footprint and deployment slot, and does not reset any campaign progress.
The UI explains the consequence before submitting it. No resource refund is
invented while the economy is deferred.

Require a connected, active on-foot owner; completed arrival; an empty, surfaced
ship at its original berth; and no other live vessel using that berth. Destroyed
empty vessels may be cleared without a return voyage. Reject incoming delivery,
an occupied ship, a live ship away at sea, and a launch still in progress. Preserve
already accepted projectiles. Delete the saved row and publish the shared result;
restarting must not recreate the recalled deployment. New deployment uses the
unfolding dock. General core/airbase/artillery demolition remains a separate stage.

Recall validation: 28 relevant domain/HTTP tests and TypeScript passed. Desktop
and phone browsers cancelled then confirmed legacy recall, observed removal from
a second client, and redeployed the unfolding dock on the same site. Saved removal
survived a server restart; owner, crew, arrival, berth and launch restrictions were
checked. Local screenshots: [recall controls](previews/navy-recall-mobile.png) and
[rebuilt dock](previews/navy-recalled-rebuilt-desktop.png). Browser scenarios
reported OK; Windows runner teardown again required interruption afterwards.

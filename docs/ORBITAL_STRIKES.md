# Orbital weapons: roster and staged implementation

Approved 17 October 2026. Complete a small weapons roster, review the combat
loop, then polish existing systems, expand the map and refine AI. This approval
started walking HE. The author subsequently approved completing the remaining
payloads; all four are now implemented locally for playtesting.

## Roles and sequence

1. Walking HE barrage: select the first row and a cardinal advance direction.
   Five rows of three impacts cross a hostile site or clear an approach. Global
   reach and delayed commitment distinguish it from repeatable local artillery.
2. Incendiary curtain: canisters form a burning line to divide an approaching
   group and protect a retreat or unloading. Reuse lethal heat/avoidance rules.
3. Gas seeding: scattered pods form attraction clouds with finite shared kill
   capacity. Reuse existing gas rules.
4. Cutting beam: select two endpoints; a hot ground contact sweeps the
   line, damaging only near the moving contact. White centre, red-orange edges,
   sparks and a dark scar are cosmetic. It can damage hostile facilities.

Fire and gas require their entire circular footprints to be on land. HE and the
beam work against land and
aquatic enemies; water hits use the existing splash presentation.

## First playable HE stage

One shared orbital weapon per campaign; one accepted strike, no backlog. All
teammates see caller, committed footprint, advancing rows and countdown. The
caller keeps their body/vehicle. Open with V or Deploy > Strike > Orbital support;
click/tap a first-row location, choose N/E/S/W, review rings and explicitly call.
Closing the panel does not cancel a strike. Orders are available after landing
from active robots and vehicles. Emergency pre-landing strikes are deferred;
existing emergency core/tank recovery stays available.

Provisional balance: 120 ORB, five rows of three, row spacing 3.5 tiles, lateral
spacing 3.2, 1.35 seconds between rows and 0.12 seconds between shells in a row.
Small deterministic offsets are included in the preview. Damage radius 2.6,
centre damage 220, edge damage 30, cosmetic crater size 7.5. Existing friendly
immunity and permanent HE conquest apply; no terrain collision changes.

First impact delay is 6 seconds plus distance / 25, capped at 18 seconds. The
abstract previous firing position begins at map centre and becomes the accepted
first-row point. No physical orbit simulation. Recovery is 45 simulation seconds
after the last impact. ORB is spent once at acceptance; no cancellation/refund.
Future economy tuning must preserve emergency recovery options.

Target, direction, scattered points, age, landed flags, caller, sequence and
cooldown are saved with campaign logistics. Damage and progress checkpoint with
named-campaign combat. Pause, owner reconnect grace, empty rooms and offline time
do not advance strikes. Accepted orders survive departure/death of their caller.
The latest order ID is idempotent; older requests have stale sequence numbers and
are rejected. Simultaneous orders compete for one server-authoritative slot.

HE schedules 15 impacts; damage runs once per impact, while descent streaks,
glow, sparks and shockwaves render on clients. This is bounded work, not proof of
four-player Fly capacity. Cosmetic crater history keeps existing client limits.

## Remaining payload stage

Select the payload in the same planner. All four share one orbital slot, the
arrival-delay rule, the ORB pool and 45 seconds of recovery after completion.
The following values are provisional, pending playtesting:

| Payload | Cost | Committed effect | Tactical boundary |
| --- | --- | --- | --- |
| Incendiary curtain | 100 ORB | Seven patches, three tiles apart, radius 2.1; each burns for 18 seconds | Lethal alien heat and avoidance; no hostile-building damage |
| Gas seeding | 100 ORB | Centre plus six surrounding clouds, radius 2.8 each; 24 kills shared across the cluster | Lures ground enemies; spent gas cannot refill from later pods; no hostile-building damage |
| Cutting beam | 180 ORB | A 2–24 tile line traversed in six seconds; contact radius 1.25 | Damage follows the moving contact, not the visible ray from the sky |

Fire and gas pods land 0.12 seconds apart, with minor bursts, fragments and
scorch marks beneath their persistent flames or vapour. Gas lasts until its
capacity is spent. Each order reserves one shared hazard field at acceptance,
including its full bounding area in the existing field-count and area limits.
Pending artillery/bomber hazards and landed fields compete for these limits.

Beam contact samples every 0.15 simulation seconds, including both endpoints:
45 damage within radius 0.5, falling to 15 at radius 1.25. It affects aliens and
hostile facilities, retaining friendly immunity. Fast enemies can leave its
contact area. The preview shows both endpoints and the sweep width; the planner
accepts two map clicks or coordinates. Four cosmetic line scars are retained;
scars change neither terrain nor collision. There is no orbital platform entity
or server-side particle simulation.

The accepted order saves its payload profile, points and endpoint. Future balance
changes cannot silently alter an in-progress order. Hazard sectors, remaining
fire time and gas capacity have one canonical copy in campaign logistics; named
combat checkpoints exclude that copy to avoid duplication. The legacy sandbox
also restores these orbital fields without resetting their capacity/lifetime.
Named campaigns checkpoint damage and orbital progress together. No offline
catch-up or repeat payment is introduced.

## Review and deferred work

Verify shared spending, stale/repeated requests, restart during successive rows,
pause/idle, map edges, friendly immunity, water hits and permanent site damage.
Inspect keyboard, pointer and phone controls with separate test saves.
Review timing, clarity, cost and the beam's facility damage in play. Broader map
expansion, AI refinement and audiovisual polish remain subsequent stages.

The separately discussed ORB ship delivery/resupply route remains a proposal;
this strike stage does not change shipyard economics.

## Initial HE validation (17 October)

Typecheck and 397 tests across 61 files passed. The named-campaign test covers
simultaneous callers, single payment, retry, solo pause, caller departure, a
restart between rows and permanent conquest without replay. Domain checks cover
deterministic previews, all four bearings, invalid orders, map edges, cooldown,
friendly immunity and water splashes. Desktop (1920 x 1080 with resize) and phone
(390 x 844) browser cases passed; planning and impact screenshots were inspected.
Evidence and whitespace checks passed. The local server serves the updated
modules; this stage is not committed, pushed or deployed, and Fly load capacity
has not been measured for orbital combat.

## Completed roster validation (17 October)

Typecheck and 408 tests across 61 files passed. The new checks cover hazard
reservation, land-only admission, finite shared gas capacity, contact lethality,
friendly/building immunity for hazards, moving beam damage and saved progress.
Named-campaign HTTP checks restore each new payload before and after landing,
preserve balances and fields, reject duplicate spending and stop time while idle.
The catalogue's three focused tests also passed after updating its price display.

All four payloads passed desktop and phone browser cases (1920 x 1080 and
390 x 844), with desktop resize, locked accepted inputs and refresh restoration.
Planning and effect screenshots were inspected. Persistent fire and gas are
visible after the impact flashes fade. Coordinate edits now refresh validation
on input, without requiring a blur first. On phones the longer beam form scrolls
while retaining a visible map above it. Evidence and whitespace checks passed.
The local server on port 8080 serves the updated modules. These changes remain
local, with provisional balance and no measured Fly load claim.


## 18 October: direct battlefield controls

This supersedes the coordinate-form controls above. Select an orbital payload
from Deploy > Strike (or open with V), move the mouse for its preview, press R
to turn a walking HE/fire pattern through cardinal bearings, and left-click to
call it. Gas has no directional axis. Beam instead uses a first click for its
start and a second for its endpoint and launch. Esc exits targeting. On phones,
a small rotate button replaces R, taps call attacks, and drags only pan.

The controls occupy a slim strip beneath the payload cards. There is no separate
direction dropdown, coordinate form or call button. Hover, rotation and beam's
first click do not spend supplies. Invalid targets remain editable without
spending. Pending/committed orders consume further clicks without firing the
operator's normal weapon or buying a second strike. Existing server admission,
sequence checks, prices, cooldowns and saved impact progress remain unchanged.

Focused browser checks cover all payloads on desktop and phone, direct click
calling, hover without spending, keyboard rotation, invalid targets, repeat
clicks, touch panning, two-point beam targeting and restoration after refresh.

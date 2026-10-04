# Incendiary and gas: first playable shells

Implemented 2026-10-02 following the approved three-shell concept. These are
prototype tuning values, ready for play feedback. Sound and authored effects
remain future work.

## Try them

Take control and choose **1 HE / 2 Fire / 3 Gas** with the number keys or bottom
manual buttons. Point the mouse (or tap) to aim; LMB, Space or Fire launches the
selected shell. WASD now travels along rails, and orbital overview is the default.
The gold crosshair is the desired point; the blue diamond and shell-sized ring
show the actual landing point. See [current controls](CANNON_CONTROLS.md).

| Shell | On impact | Monster response |
| --- | --- | --- |
| HE | Existing 3-tile blast and separate 8-tile cosmetic crater | Immediate blast damage |
| Incendiary | 3-tile lethal burning core for 18 simulation seconds; outer 0.75-tile heat band slows movement to 55% | Immediate death on contact, charred remains; approach routes avoid fire |
| Gas | 2.6-tile lethal cloud with six crawler kills of capacity; lure radius ten tiles | Monsters choose a reachable cloud, abandoning their normal target; one kill consumes one charge |

All three use the existing ballistic trajectory and share a six-second reload.
Changing shell type never resets reload or modifies a launched shell. Selection
is saved per cannon and visible to peers; only its current operator may change
it. Older saves default to HE without rewriting their construction records.

## Field rules

Fire already covering a monster kills it immediately. Otherwise monsters route
around fire, or wait if their goal has no safe route. Expiry makes routes available
again. The navigation grid reserves additional clearance for a crawler's body;
the rendered boundary shows the actual lethal core. Outer heat slows surviving
monsters without pretending they can survive contact with the lethal core.

Gas has **no timeout**. Its density and GAS remaining/total label show capacity.
Unused clouds remain through subsequent drills until consumed or server restart.
The current alien lure is fictional game behavior. Fire avoidance takes priority
over lure selection; inaccessible cloud centers are ignored. Burning from a laser
also retains its existing fleeing response before reconsidering a lure.

There are at most **12 active or incoming fields combined**, and at most eight
of either type. Incoming shells reserve a slot before firing, so simultaneous
landings cannot exceed the cap. Full capacity rejects firing with a visible
reason and does not spend the reload. HE does not consume field capacity.
Overlapping fields stay separate; their radii and lifetimes do not add together.
Fire receives contact priority, then gas clouds resolve in creation order.
One monster dies once and consumes capacity from only the cloud credited with
its kill. A final charge cannot kill two simultaneous entrants.

Only enemies receive field damage. Friendly players, core panels, machinery,
rails and terrain remain intact. Fields are circular game regions, including
their presentation over water; this stage does not simulate wind, fuel flow,
terrain-dependent spreading or combustion. No crater is created by fire or gas.
Robot fuel and sentry ammunition are unchanged.

Timers and enemy movement pause when nobody is connected. Fields, projectiles
and combat remain transient and reset on server restart; they are not added to
the durable campaign save. Starting a drill retains fields and airborne heavy
shells, allowing a trap to be laid before a wave.

## Cost and feedback

The server stores one small record per field. Target reconsideration uses the
existing bounded enemy cadence. Path searches avoid fire; movement rechecks
contact and safe steps before a monster moves or attacks. Decorative flame
tongues, embers and vapor are analytic browser effects with fixed counts per
field and reduced-effects alternatives. The server never simulates those sprites.
Boundaries, remaining seconds and gas charges remain visible in reduced mode.

## Verification

Domain coverage includes impact lethality, charred remains, friendly immunity,
expiry and waiting/resumption, safe routes, heat-band slowing, gas attraction,
cross-drill capacity, overlapping clouds, the final charge, field reservations
and preserving airborne shells when a drill starts.

The 52 domain/HTTP tests across 11 files and all 17 browser scenarios pass.
Desktop and phone screenshots were inspected. Browser verification covers the
selector on desktop and phone, operator-only changes, invalid ammunition,
shared shell/field state, reload retained during switching, in-flight identity,
fire expiry, gas depletion, reduced effects, saved selection and transient reset.

A disposable Docker run used four clients, four cannons, eight gas fields and
four fire fields (the 12-field cap), plus a three-crawler eastern drill. It ran
43.45 seconds under 256 MiB, no extra swap and CPU quota 5000/80000. Peak cgroup
memory was 33,800,192 bytes (32.23 MiB), with zero OOM events. Three gas kills
consumed exactly three of 48 prepared charges. Largest snapshot: 7,466 bytes;
1,838 snapshots transferred 10,817,840 bytes. CPU usage was 954,088 microseconds,
with 45 of 693 periods throttled. The slowest measured request took 466.38 ms;
this does not establish low latency or large-battle capacity under that quota.
Reproduce only on a disposable server with ISOLATED_TEST=1 and
scripts/check-hazards-runtime.mjs. The first workload assertion incorrectly
assumed all kills must come from gas; it now accounts for each weapon's recorded
kills, including fire. An early browser run's trace artifact failed while its
test source was edited; the clean full run passed all 17 cases. Windows test-server teardown required
stopping its verified isolated server after the cases completed.


The local preview was refreshed after a full SQLite backup. Both metadata rows
(including terrain and the prior expansion backup), 11 scouts, two sentries, one
core, one robot state, 10 rails and one cannon remained byte-identical in stored
records. The new selector and field modules are served successfully. Refresh
existing browser tabs to load the new controls. No Fly deployment was performed.

# Helicopter and helipad

19 October 2026. Implemented locally; balance values are provisional. This stage
adds sustained close air support, using the existing ownership, aircraft saves,
flak, supply pools and bounded HE projectile simulation.

## Combat loop

Deploy a **3 x 3 helipad**, then order a **helicopter** to it. Approach the marked
apron and press **E** to board and take off. WASD moves in world directions,
including sideways and backwards; releasing movement brakes into a hover.
Mouse aiming turns the hull and chin gun at bounded rates, independently of travel.
Ground obstacles do not block flight. Aircraft can be damaged by existing flak.

- Hold **LMB** for small HE cannon rounds: 120 rounds, 9-tile range, 0.65-tile
  blast radius, 24 centre damage and a 0.18-second server firing interval.
- Hold **RMB** for rocket pods: 40 rockets, 12-tile range, 1.1-tile blast radius,
  42 centre damage, at most 20 launches in a five-second window. An eight-second
  recovery follows the window. Releasing stops firing; pressing again does not
  restart the window. Continuing to hold resumes once recovery completes.
- Aim may change during firing. Each accepted projectile retains its impact
  point; subsequent launches follow the current gun bearing and target distance.
  Distant aim clamps to range. Rocket trails and cannon tracers are distinct.
- Touch players tap an aim point, then hold the weapon button. While firing, a
  second finger can move the aim on the battlefield without cancelling the burst.
- Release WASD to hover, press **E / Land** on clear ground or a free intact helipad. Manual hover never
  lands by itself. A blocked attempt briefly flashes the nine-tile area red; successful landing
  shows no grid. Descent takes two seconds and rechecks all nine tiles.
- Press **E / Disembark** after touchdown. On open ground the robot exits beside
  the helicopter, and **E / Board helicopter** returns to its parked seat.
  **Take off** lifts from that same position. Field parking reserves its footprint
  and survives reconnect/restart without refilling health or ammunition.
- Helipads remain construction, repair and rearming centres. Pad landing rearms
  for eight seconds; hull repairs consume GND. Field landing provides no service.
  **Locate free helipad** finds a usable pad. E never ejects an airborne pilot.
- Destroyed pads do not destroy surviving helicopters. A parked craft stays at
  the ruined pad as a field-parked aircraft; an aircraft already away stays there.
  A delivery crate still depends on its pad until construction completes.


The small explosive rounds can hurt armored enemies and hostile facilities,
but they retain their own lower damage rather than inheriting heavy-bomb damage.
Friendly units remain immune. Helicopters are exposed while hovering and have
the existing 180-point aircraft hull; they are not an anti-air counter by default.

## Deployment, economy and capacity

| Item | Orbital delivery | Local construction |
| --- | --- | --- |
| Helipad | 160 ORB; global clear-land placement | 40 GND; whole pad inside support coverage; 60s |
| Helicopter | 60 ORB to an existing free helipad | 15 GND at its helipad workshop; 60s |

Helipads have 300 HP, reserve nine land tiles, and allow boarding across their
walkable surface. Orbital construction uses the shared crate descent and wall
unfolding; local work uses construction drones. Pads must remain two tiles inside
the world boundary. Ocean and occupied footprints are rejected.

At most eight active helipads supply helicopter fleet capacity. Aircraft
in flight or field parked still count. Destroyed pads supply no capacity, but
surviving aircraft are not deleted when capacity falls. Helipads add no bomber/jet capacity; runways and carrier
decks do not accept helicopters in this stage. An existing helicopter may land at
another compatible free pad. Workshop exchanges retain the existing 80% credit
of actual GND payment, capped at the replacement price. Orbital purchases earn no
GND exchange credit. The campaign's free first bomber is unchanged.

## Manual sling transport

Hover above an unoccupied tank, recycler or bridge builder and press **V / Lift**.
Hold still for the two-second transfer, then fly at up to 2.5 tiles/s with the
vehicle suspended below. Hover over clear land and press **V / Set down**. The
vehicle retains its identity, health, selected weapons and stored salvage.
Blocked set-downs retain the load. Land only after setting it down.

Ground guarding, collection and driving stop while carried. Simultaneous pickup,
saved transfer timers and duplicate commands are handled by the server. Crash
loss destroys the carried vehicle; recycler contents become salvage on land but
are lost in water. See [the staged plan](HELICOPTER_AND_SUBMARINE_REFINEMENT.md)
for recovery and capacity details. Remote transport commands remain planned.

## Remote support and loss

Launch an unoccupied helicopter into cruise from its pad, then select it through
**Remote / F**. Mark an area and rotate the approach with R. The helicopter flies
to a hovering position eight tiles from the target, provides ten seconds of
cannon support and up to five seconds of rockets, then relocates to a different
holding area. A ground-launched support order returns and rearms instead.

Known living flak sites influence bounded waypoint planning. Final approaches
to defended targets still expose the helicopter. The support sweep uses fixed
timers and deterministic offsets, without per-frame enemy searches. Empty craft
remain in cruise until recalled through **H**. Existing seat ownership, recall,
disconnection recovery, runway reservations and shot-down recovery apply. If no
usable pad is available when returning, a bounded search finds nearby clear
ground for a field landing. If none is available, the helicopter holds and retries.

Aircraft identity, destination, pose, velocity, target, hull, ammunition, pod
window/recovery and mission progress are saved in the existing aircraft records.
Idle rooms pause these timers. Reconnection or restart does not refill pods or
restart a support burst. Named campaigns retain the existing committed combat
checkpoint behavior; the separate legacy test field still resets transient
combat on restart. No new terrain generation or save reset is required.

## Verification

- Simulation checks cover footprint and fleet separation, water rejection,
  movement/braking/landing, finite bursts, trajectory independence, restore-safe
  timers, HE impacts, aircraft damage, remote support and unavailable-pad recovery.
- HTTP restart checks cover exclusive firing authority, server-owned damage,
  saved ammunition, saved cooldowns and idle simulation pause.
- Browser checks cover desktop/phone flight and firing, aim changes, refresh,
  orbital placement and delivery prices, incompatible runways, workshop choices,
  and remote orders while moving the robot.
- Existing deployment, trade-in, vehicle movement and bomber/jet remote browser
  checks are retained. These local checks are not a Fly load-capacity measurement.

Sound, carrier helicopter parking, transport passengers and additional warheads
remain outside this stage.

Local verification checkpoint: `pnpm check` passed 496 tests across 73 files,
including typechecking. The 21 existing deployment/remote browser cases and
four helicopter browser cases passed. The final touch check changes aim with a
second pointer while holding rockets, then tests held cannon fire. No release,
commit, push or Fly deployment was performed in this stage.

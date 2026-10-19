# Shared airfields and cruise (16 October)

Player story: launch an empty aircraft into a holding patrol, keep fighting on
the ground, assign bomber strikes, and recall to a different free friendly
runway. E still boards a parked aircraft. This is the airport foundation for
the later carrier; it does not implement the carrier itself.

Each operational airbase contributes one fleet slot and one parking slot.
Aircraft in flight and orbital delivery count against fleet capacity. Cruise
does not permit extra production. A landing reservation prevents two aircraft
claiming one runway. Empty airbases can be deployed, including by the same owner.
All friendly runways accept visitors. Aircraft ownership remains unchanged.

Cruise is an explicit saved mission, not an abandoned pilot seat. Bomber strikes
ordered from cruise return to cruise, including with empty bays. Recall selects
a free runway, lands and rearms. Manual flight may land at any free runway on a
slow approach. A destroyed destination can divert to another free runway; if
none exists, existing bounded emergency recovery applies. Surviving aircraft
are retained when base loss reduces fleet capacity; production stays locked.

The server owns orders, capacity, reservations, supplies and persisted movement.
Existing per-airbase aircraft records remain storage identities for compatible
saves; aircraft.baseId identifies the physical destination, not ownership or
the manufacturing record. No extra aircraft simulation is added. Construction,
repair and ammunition retain their existing costs and timers.

Check cruise/strike/recall transitions, cross-base boarding and disembarking,
simultaneous landing claims, capacity during flight, restart and base loss.
Review desktop/mobile controls and ask whether holding aircraft and choosing
a destination feel clear. Four-player production performance remains unmeasured.

Local validation: typecheck and all 382 tests in 58 files passed. The new
server case verifies visiting-aircraft boarding races, cruise and landing tags
across restart, and production rejection at full fleet capacity. Domain cases
cover cruise strikes with empty-bay holding, cross-base landing and exclusive
reservations. After excluding vacant aircraft placeholders from enemy spawn
clearance, the 14 relevant conquest/settlement/air-traffic checks passed again.
Desktop and phone browser cruise/recall cases passed; the final desktop rerun
and existing heavy-HE automatic mission also passed. Screenshots were reviewed.
Windows browser runners lingered after completed cases and were stopped.
Process-evidence and whitespace checks passed. Not committed or deployed yet.


## Remote aircraft strikes and safer cruise, 19 October 2026

The author requested aircraft in bottom-bar Remote, continued robot movement
while giving orders, and leaving the target area after an attack. Confirmed:
avoid known living flak where a route exists, with real exposure still possible
on a defended attack run. This is not invulnerability or guaranteed safe flight.

From an active robot, Remote / F shows ground artillery and airborne aircraft.
Cruising unoccupied bombers and attack jets are selectable gold map markers;
piloted, busy or empty aircraft are muted. Select an aircraft, choose a bomber
payload if applicable, rotate the cardinal approach with R, and click/tap the
map to commit. Damage-area previews reuse the actual bomb/strafe geometry.
WASD and phone movement controls remain available during selection and aiming.
Escape goes back from the aim preview; committing an order does not board the
plane. Existing H air support retains recall to a free friendly runway.

Bombers retain HE, heavy HE, incendiary and gas payloads. Attack jets fire a
finite pass of up to twelve existing autocannon rounds, spaced at 0.2 seconds,
with existing damage, ammunition, projectile capacity and cooldown admission.
No automatic refill or second aircraft is created. Burst progress, rounds,
mission identity and accepted projectiles persist; restore continues only the
remaining shots. Recall stops unreleased shots while accepted impacts remain.

New mission orders compute a bounded visibility graph around known living flak
circles. All such circles constrain transit segments; at most twelve nearby
circles contribute eight detour nodes each (at most 98 graph nodes). Six tiles
of clearance support physical turning. A short alignment leg precedes the
existing dive/release approach. A defended final approach can still enter flak
range. If no detour is found within the bounded graph, the direct route remains
subject to physical-flight validation and normal enemy fire.

After a cruise-launched strike, the aircraft enters a saved relocation phase.
It selects a new holding center at least thirty tiles from the target, with
clearance for the eight-tile cruise orbit and banking outside flak where space
permits, then flies there. Search is a fixed set of candidate centers, not a
per-frame global search. Limited safe airspace is recorded in the mission;
no new immunity is granted. A timed-out relocation falls back to existing
return/recovery. Empty aircraft continue cruising until explicitly recalled.
Destroyed flak is ignored by new plans; existing saved routes remain stable.

Remote and catalogue orders now require the robot on the client and server.
Initial orbital core landing remains an exception. Vehicle-specific operations,
including carrier deck service and emergency aircraft recall, remain separate.
Once artillery is taken over, its existing WASD rail controls and robot guarding
remain in force; simultaneous robot movement applies to Remote selection and
aircraft targeting, not manual rail-cannon control.

The existing airbase storage identity, shared fleet/runway capacity, ammo,
carrier compatibility, mission idempotency, pause and recovery rules remain.
Older missions without transit waypoints continue with their saved approach.
No account settings, live saves or Fly deployment were changed.


Validation for this checkpoint: pnpm check passed type checking and 487 tests
across 71 files. Seven focused routing/mission cases cover detours with the real
turn controller, cruise clearance and bounded fallback, both weapon types,
remaining-burst restoration and the cruise-turn alignment regression. Eight
Remote browser cases passed; the four aircraft cases passed again after the
alignment and phone-control refinements, including a live server-fired jet shot.
Thirteen deployment/workshop browser cases passed, including robot-only client
and API admission across tank, recycler, ship and aircraft bodies. Phone/desktop
views were inspected. Earlier failures exposed a missing server import and an
approach alignment problem; both were fixed before the passing final checks.
No full legacy browser-suite or Fly performance claim is made by these results.

## 19 October: readable recall controls

H opens Air support on foot. Aircraft choices now display live flight/mission
status (CRUISING, PARKED, RETURNING, PILOTED, etc.) and rounded runway/deck
coordinates. Opening prefers a cruising aircraft and the robot's current free,
compatible airfield as the landing destination; players can choose another.
An airbase/helipad workshop also links directly to Aircraft / recall (H).
Disabled recalls explain parked, piloted, recovering or unavailable-landing states.
These UI changes reuse existing server recall, runway reservation and flight rules;
no aircraft is teleported, replaced, or manufactured by a recall.

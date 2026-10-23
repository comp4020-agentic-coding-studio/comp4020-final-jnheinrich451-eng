# Remote naval support

23 October 2026. Implemented locally, pending player balance review.

The combat loop is to position an uncrewed ship, leave it holding offshore, then
call supporting fire while fighting as the robot. Coastal gunships and armored
transports now have **6–100 tile main-gun range** (formerly 6–40). Damage,
six-second turret reloads and the shared incoming-shell limits remain unchanged.
Secondary range remains eight tiles. Submarine orders are a later design stage.

## Player controls

Press **F / Remote**, then choose a gold ship marker. WASD continues moving the
robot. The compact bottom strip provides:

- **Move:** click water. The ship sails to the point and holds there.
- **Return to dock:** one click sends the ship to its assigned home berth and
  aligns it automatically. The nearby Dock workshop also has **Return ship to
  dock**, so the robot can summon its vessel without selecting a map position.
  Arrival reports `docked`; ordinary boarding, repair and exchange rules then
  apply. This command does not retire or replace the vessel.
- **Shore + ramp:** click a clear shore tile. The ship finds a nearby water pose,
  sails there and unfolds its ramp after stopping. E boarding uses the existing
  shoreline interaction. Retract ramp folds it again; a new movement order also
  folds the ramp before departure.
- **Bombard:** choose HE, Fire or Gas. Click three points for the gunship's fore,
  raised and aft turrets, in that order; points can coincide. The final click
  submits the complete order and closes aiming. All three turrets turn to their
  respective points, fire nine shells together, reload, and repeat twice:
  **three salvos / 27 shells**. The transport takes one point and fires its twin
  bow turret three times, for six shells total.
- **Stop / cancel orders:** halt movement or cancel the remaining barrage.
  Already released shells continue to their accepted impact points.
- **Launch aircraft** on a carrier launches its parked aircraft into cruise.
  The carrier must be stationary and the deck available. Select the aircraft
  marker to assign an attack using the existing remote-air strip.

### Automatic home approach

Return uses the authoritative assigned yard and saved berth, never coordinates
supplied by the client. It tries two six-tile approaches along the berth axis,
aligns in open water and enters forward or in reverse. A quarter-tile outward
clearance beside unfolding piers prevents carrier corners wedging during small
steering corrections; it remains inside the existing 0.8-tile docking range.
The hull still follows physical movement and full collision checks, with no
teleporting. Each candidate uses the existing bounded route search.

Occupied ships, unavailable flight decks, ruined/unbuilt docks and obstructed
berths reject the order. A dock lost or moved en route stops the ship with a
visible reason. New obstacles use the existing blocked-route handling. A new
return order retracts the shore ramp. Stop or boarding cancels the journey.
Orders, berth identity, approach waypoints and retry receipts survive restart.
Dock-route turn checks include a 0.2-tile position margin around the planned
pivot. The follower accepts arrival within 0.15 tile, so checking only the exact
pivot could accept a turn that catches a pier at the actual stopping point.
The longer approach also provides room for a carrier's turning envelope.
Submarine remote orders remain deferred; this adds gunship, transport and carrier
return only. Exchanging a docked gunship for a submarine uses the existing GND
workshop rules and does not bypass aircraft/cargo/occupant restrictions.

Return-stage verification (23 October): 28 domain/HTTP/narration tests pass,
including three hull types, saved approach recovery, occupied berths, dock loss,
crew visibility and durable retry receipts. Direct Playwright checks passed
desktop Remote and phone workshop return through actual server movement to
`docked`, followed by robot keyboard movement and viewport resize. Inspected
desktop command/arrival and phone workshop screenshots. TypeScript and diff
checks pass. Local disposable worlds only; no campaign reset or Fly deployment.

Dock-corner follow-up: reproduced the blocked turn in a read-only copy of the
player's save. The revised route reaches the berth in simulation without moving
or resetting the live save. Added a tight-corner regression with 0.05, 0.1 and
0.15-second simulation steps and save/resume during the approach; all 23 naval
domain/HTTP tests pass. Existing blocked orders need a fresh Return command to
replace their old waypoints.
Direct browser checks of that tight-corner layout passed from desktop Remote and
the phone workshop, with docked arrival, keyboard movement and viewport resize;
both arrival screenshots were inspected. TypeScript and diff checks also pass.

Parked bombers and attack jets at ordinary runways are also selectable in Remote.
A remote strike can launch from there or a stationary carrier; afterward it
relocates into cruise for another order. Existing weapon cooldowns remain, with
unlimited bomber/jet ammunition. Recall through Air support (H) still selects a
free landing destination. Aircraft already flown by a pilot cannot receive remote
orders. Aerial gunship automatic flight remains a separate future stage.

Uncrewed gunships, transports and carriers automatically defend their port and
starboard sides against damageable land or aquatic enemies. Each broadside aims
independently and retains its traverse, eight-tile range, firing cadence and
bow/stern blind sectors. Main guns remain assigned to the barrage targets.
Automatic side fire stops while moored at a completed dock or with a shore ramp
deployed. The existing separate ramp sentry retains its defensive role. Taking
the helm returns secondary fire to the existing manual controls.

## Authority, movement and persistence

Requests require a connected, active robot in the same room. Ships must be
completed, alive and unoccupied. One order is active per ship; a new accepted
order replaces the previous one. The request includes the last observed order
ID to reject a crew member's stale selection. The last 16 accepted IDs are kept
for harmless retries; an old retry cannot restart a canceled barrage. Targets,
ammunition and complete target count are validated before accepting anything.

Navigation uses a bounded 4,096-state search over forward/reverse cardinal sailing
legs and swept hull turns. A bow-in ship can back away from shore before turning;
an angled berth can first be exited along its exact saved heading. These departure
attempts share the same search budget. Reverse legs survive saved-order restart.
The actual helm still uses acceleration, rudder response and
collision checks; the hull never teleports through terrain, piers or another
ship. Conservative routing may reject narrow channels or distant detours: use
an intermediate open-water waypoint. New obstructions stop an order with a
visible reason after ten seconds without progress. The player can replan.
Carrier flight reservations pause movement. An occupied shore endpoint prevents
ramp deployment and reports the blocked landing instead of moving that unit.

Order paths, progress, targets, salvo count and turret reloads use existing ship
JSON persistence. Each accepted salvo checkpoints its remaining count alongside
the combat state in named campaigns; reload/reconnect does not repeat spent
salvos. Accepted attacks retain the initiating actor's log context. Legacy test
worlds retain their existing transient-combat behavior. Orders stop on ship loss
or boarding; orders advance only while the room simulation is running.

Salvos wait for both reload and shared projectile/hazard capacity. Fire and Gas
can therefore take longer than HE when earlier fields occupy the shared budget.
No new synchronized particle system or per-shell network input is introduced.

## Validation

`spec/naval-orders.test.ts` exercises collision-safe movement, island detours,
blocked routes, shore landings, saved progress, exact three-salvo counts and
spacing, capacity waits, and broadside/dock/ramp gating.
`spec/naval-orders-http.test.ts` checks robot/connection gates, room-local IDs,
stale competing orders, duplicate requests, restart, cancellation and carrier /
runway remote aircraft launches. Existing ship, secondary, carrier and aircraft
tests remain part of the regression checks.

`tests/browser/remote-naval.spec.js` covers mouse and touch target selection,
robot movement during Remote, automatic aiming dismissal, order progress,
carrier launch, Escape, reload and phone landscape. Evidence is under
`.local/remote-naval-*` and `.local/naval-remote-*`. Local functional checks do not
establish sustained combat capacity on the Fly machine.

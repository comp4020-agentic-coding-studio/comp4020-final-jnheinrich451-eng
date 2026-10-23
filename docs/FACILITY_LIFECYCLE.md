# Permanent losses and new construction

22 October 2026. Implemented locally; deployment is a separate release step.
This supersedes the earlier dock/runway repair-in-place design.

Destroying a vehicle or facility is permanent. The player recovers their robot,
then pays for a new build. Ruins and wrecks remain visible; they do not become
operational again. A damaged but surviving ship or aircraft can still receive
its existing supply-funded repairs. The protected starting recovery core remains
indestructible.

## Capacity

| Asset | Limit | What occupies a slot |
| --- | --- | --- |
| Helipad | 8 per campaign | Intact pads, including construction |
| Fixed-wing airbase | 4 per campaign | Intact bases, including construction |
| Dock | 4 per owner, 8 per campaign | Intact docks, including construction |
| Ships | 4 living vessels per campaign | Living hulls, including assembly and ships at sea |
| Aircraft | Compatible operational airfield/deck capacity | Living aircraft, including delivery, flight and visiting aircraft |

Other existing facility and vehicle rules remain. Tanks retain the previously
agreed supply/space limit without a numerical fleet cap. Destroyed cores,
logistics buildings, sentries and artillery already leave their live collections;
they now also leave a small static ruin marker. Destroyed runways and docks keep
their saved ruined geometry. Ruined dock flooring remains walkable. An unfolding
dock can be replaced at its original deployment tile: placement temporarily
disregards that owner's old deck, while still checking terrain, units, other
docks and the new pier. Abandoned runway ground can receive a fresh facility.

Ruins never count toward facility capacity. Construction reserves its slot when
the server accepts payment. Concurrent requests use the same authoritative
checks. Losing a base does not delete surviving aircraft stored on its record:
they can use another compatible runway. Surviving ships still occupy the fleet
cap after their dock is lost. An unfinished hull lost with its dock becomes a
wreck instead of reserving a fleet slot indefinitely.

## Replacing a dock with a surviving ship

Deploy an empty dock at the ruined dock's original water tile. The preview says
whether a surviving assigned vessel will reconnect. This buys a new dock at the
normal ORB/GND price and construction time; it does not revive the ruin or buy a
ship. The new dock inherits the one surviving ship's assignment, including when
that ship is at sea. Identity, position, crew, cargo, health, weapons and carrier
aircraft remain unchanged. That vessel reserves the new dock's production slot.

The old ruin is retained in the save as superseded history, with its visible
deck replaced by the new construction. Dock services resume once the new dock
is complete. Failed payment leaves the old assignment intact; retries do not
double-charge. Cancelling construction restores the old ruin and association.
The operation does not claim another player's vessel or adopt arbitrary visitors.

## Player controls

- Open Deploy to place a new facility. There is no T repair action or facility
  resurrection button. Logistics can locate abandoned docks and airfields.
- At an intact dock or airfield, manufacture a new vehicle at the normal price.
  Destroyed vehicles provide no trade-in credit. Existing living-vehicle
  exchanges retain their 80% same-pool credit rule.
- The tank equipment menu can order a **new** tank at its original clear drop
  site; Deploy allows a different site. The wreck remains, and the new tank has
  a new identity. Repeated requests do not charge twice.
- Ramp gun replacement is still a service on a surviving ship, not resurrection
  of the hull. Robot recovery remains free.

## Save compatibility

No campaign reset. Existing destroyed docks/airfields immediately release slots.
Previously saved repair orders are backed up and cancelled once, with their
paid GND refunded. Older jobs recorded zero cost despite charging the fixed
90-GND dock / 150-GND airbase price; migration refunds that known price.
The refund is not clipped at the storage ceiling. Already-completed repairs
remain completed.

Vehicle manufacturing uses fresh identities. Wreck records remain destroyed,
and legacy replacement requests record their resulting vehicle for safe retries.
Newly destroyed small facilities and aircraft leave saved cosmetic markers;
older deleted objects cannot have their lost positions reconstructed.

## Validation

Domain and HTTP checks cover active/incoming caps, excluded ruins, rejecting
resurrection without payment, a one-time saved-order refund, new identities,
restart/retry behavior and surviving aircraft after carrier loss. Browser checks
cover desktop and phone layouts, E boarding near ruins, removed T repair,
Logistics ruin location, Escape and resize. No live campaign reset is involved.

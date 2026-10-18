# Aircraft carrier stage (17 October)

The carrier makes a movable ocean airbase: sail to a front, stop, launch an
aircraft into cruise, assign strikes and recover at any free friendly runway.
This stage reuses shared airfield traffic, shipyards, side guns, real flight,
anti-air damage and paid repairs. No new ammunition or carrier main cannon.

One carrier adds one fleet slot and one physical deck slot. A parked aircraft
moves with the ship. A returning aircraft reserves the deck and holds the ship
stationary until recovery finishes; takeoff and orbital delivery also hold it.
Moving carriers cannot accept new landing reservations. Aircraft launches use
the carrier heading. The pilot transfers from helm to aircraft using the deck
panel; E after landing transfers back to a vacant helm, or exits at a clear dock.
An occupied helm cannot be stolen. Existing land-airbase E controls stay intact.

Initial tuning: compact 3 x 5 hull within the existing shipyard berth, 600 HP,
1.8 tiles/s forward, 1 tile/s reverse, 20 degrees/s steering. Build costs
400 ORB directly or 100 GND at a shipyard, with existing 60-second shipyard
assembly. The carrier arrives with an empty deck and empty supply store.

The store holds 120 GND, transferred from campaign ground supplies at up to
10/s while stopped at a completed dock. Stationary hull repair consumes stored
supplies at 0.2 GND/HP, up to 10 HP/s, after the existing five-second damage
delay. Parked aircraft use the same store and rate. Existing eight-second
rearming remains. Side guns retain manual RMB and gain automatic nearby swimmer
defence when unmanned, with existing range/arcs/reload/damage; no new enemies.

Carrier loss destroys parked/delivering/landing aircraft and retains their wreck
record. Airborne aircraft survive; active returns divert to free friendly fields,
otherwise use bounded emergency recovery. Cruise also diverts when its assigned carrier is lost. Fleet
capacity drops but surviving aircraft are never deleted. Rebuilding the same
carrier retains an airborne aircraft's identity; changing type or retiring a
carrier with a surviving stored/assigned aircraft is blocked for this stage.
No free supplies are restored on rebuild. Accepted airborne bombs persist.

Orders, seat transfers, supplies and damage checkpoint together. Dock/reservation
conflicts are resolved on the server. At most four ships and one plane per
operational field keep the work bounded; workers/drone trails remain cosmetic.
Check capacity, moving/locked deck rules, flight and seat recovery across restart,
sink/rebuild outcomes, supply conservation, weapons and desktop/mobile controls.
Review whether this small deck and controls make ocean operations understandable
before increasing dimensions or adding more aircraft slots.

Local validation (17 October): typecheck and all 391 tests across 60 files passed.
Carrier domain and HTTP checks cover build payment/idempotency, restart, deck
locks, supply conservation, seat transfers and sinking/diversion. Playwright
passed desktop (1920 x 1080, including resize to 1024 x 768) and phone
(390 x 844), covering movement with a parked aircraft, delivery, cruise, refresh,
recall and boarding; screenshots inspected. Evidence and whitespace checks passed.
The local server serves the updated modules. This stage has not been deployed
or benchmarked as a full multiplayer fleet.

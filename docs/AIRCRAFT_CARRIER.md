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

## Ford-class deck and two aircraft, 24 October 2026

The author asked for Ford-class carrier art and for the carrier to operate two
jets: a bomber and an attack jet. Side guns are unchanged. This supersedes "one
fleet slot and one physical deck slot" above.

Art (`public/carrier-art.js`): the first pass was too rounded. After the author
supplied a Ford-class plan view, it was redrawn with hard straight edges. The deck
is drawn at 85% of the saved beam, inside the saved hull rectangle (3 x 5 legacy,
6 x 12 large):
- a long straight port sponson that cuts diagonally to a narrow, blunt bow;
- a nearly straight starboard edge and a square stern with chamfered corners;
- the main axial runway: two bow catapults with a dashed centreline to the bow;
- an angled runway from the stern that leaves the deck through the port bow slope.
  It has a dashed centreline, edge lines, arresting wires and two waist catapults;
- elevator platforms on the deck edges (two starboard, one port aft);
- a compact island far aft to starboard, as on the real Ford (the author's sketch
  drew it on the opposite side);
- no funnel or exhaust (nuclear propulsion).

Deck rules:
- **Two spots.** Each carrier exposes two airfields. Spot A keeps the carrier id, so
  saved `baseId`s and the existing `ship.aircraft` holder are unchanged. Spot B is
  `<carrier id>:wing`, with its aircraft holder nested on the ship as `ship.wing`.
  A legacy carrier gets its `wing` holder on its first spot-B delivery; nothing is
  migrated on load. Parked aircraft follow the ship at their spot: A on the forward
  deck, B just forward of the island, both toward the starboard side.
- **Roles.** A carrier takes one heavy aircraft (bomber or aerial gunship) and one
  attack jet. Deliveries and landing reservations that would duplicate a role are
  refused; an existing deck is never rearranged.
- **Two runways.** At the author's request each spot has its own runway. This
  replaces the first pass's single shared runway. Deck A parks between the bow
  catapults and launches straight over the bow. Deck B parks at the aft end of the
  angled runway and launches along it, turned toward port by the drawn deck angle
  (about 14 degrees on large hulls). Takeoffs, landings and deliveries on the two
  spots are independent. Deck locks still hold the helm during any of them.
  `ANGLED_DECK`, `DECK_SPOTS` and `CARRIER_BEAM` in `carrier.js` drive both the
  art and the parking headings.
- **Capacity.** A carrier contributes two fleet slots. Direct retirement remains
  blocked while either spot's aircraft survives. Workshop exchanges handle the
  aircraft automatically, as described below.
  A carrier-to-carrier workshop exchange keeps both unoccupied parked aircraft,
  their identities, condition and receipts. Land and disembark all assigned
  aircraft first. The retained carrier/deck IDs keep existing assignments valid
  through assembly and restart; payment and replacement save atomically.
  Exchanging to another ship type automatically recycles assigned parked aircraft
  with no confirmation. Each returns 50% of its actual recorded payment to the
  original GND or ORB pool (including fractional SUP). Free aircraft and aircraft
  without a receipt return nothing. The existing 80% hull trade-in credit stays
  separate. Recycled GND can fund the new ship; ORB is never converted to GND.
  Both aircraft must be unoccupied, parked and finished with their missions;
  another player's aircraft blocks recycling. Aircraft stored in another save
  record are also removed atomically, without deleting the hosting facility.
  Retries do not repeat refunds, failed orders preserve all aircraft and balances,
  and an old sea wreck keeps its existing salvage value.
- **UI.** The helm panel lists Deck A and Deck B with their aircraft and state.
  Board, cruise and deliver act on the selected deck. On phones an open ship
  systems panel now stacks above the chat bar, so its buttons stay tappable. Clicking a carrier in
  aircraft delivery picks the free spot that accepts the chosen kind. Air support
  and status labels name Carrier deck A/B.

Legacy 3 x 5 carriers are smaller than the aircraft sprites, so two parked jets
overlap there. Large 6 x 12 carriers park them clearly apart.

Local validation:
- TypeScript passes.
- Carrier domain and HTTP tests: 10/10. New coverage: two spots, role refusal,
  one-runway landing hold, spot-B holder save, and recall blocked by a spot-B jet.
  The HTTP test refuses a second bomber, delivers the attack jet to deck B, and
  keeps it through restart.
- Air/naval domain set: 626 of 630 pass. The four failures are the existing
  Bulwark rail-HE expectation and three aquatic-hive/conquest tests from files
  that another concurrent session was editing during this run.
- Browser at desktop and phone sizes: carrier, naval scale and remote naval
  specs pass. The carrier spec now delivers the attack jet to deck B and selects
  deck A before boarding the recovered bomber. Its phone run failed twice before
  that selection was added to the test.
- Two-runway follow-up:
  - Air-related domain set: 558/558 pass.
  - Carrier tests now cover simultaneous launches, deck B recovery while deck A
    launches, and the angled parking heading.
  - Carrier, remote naval and naval scale browser specs pass at both sizes. One
    phone run ended in the known native test-worker crash; a rerun passed.
  - The phone carrier run had failed twice, because the chat bar covered Board.
- Screenshots: `.local/carrier-two-jets-*.png` and `.local/carrier-art-v5.png`.
- Not committed, deployed or playtested by the author.

# Workshop and deployment pointer input

24 October 2026

The dock/airbase workshop and deployment catalogue stay open while the player
aims and fires over the exposed battlefield. Their buttons and panel background
capture mouse input only inside their bounds. Moving into either panel clears
held fire; moving back out requires a fresh press to fire again. Keyboard movement
retains its existing behaviour.

Choosing an asset starts placement, so battlefield clicks select a build site
instead of firing. Chat, targeting modes and modal menus retain their own input
rules. Opening a panel still cancels any held fire from before it opened.

The dock workshop now identifies a live assigned vessel with its HP. An old sea
wreck can overlap a new carrier visually, but does not block manufacture or
exchange. Carrier-to-carrier exchange preserves both parked, unoccupied aircraft.
Exchanging to a different ship type automatically recycles the owner's assigned
parked aircraft, returning half their actual payment to its original resource
pool. The buttons display the GND/ORB return; there is no confirmation dialog.
Airborne, piloted or mission-active aircraft still block exchange. The detailed
transaction and receipt rules are in `docs/AIRCRAFT_CARRIER.md`.

Regression coverage: `tests/browser/panel-combat.spec.js` checks both exposed-map
weapons, panel entry, no click-through or held-fire restart, and placement priority
on desktop and phone viewports. `spec/facility-service.test.ts` checks that wrecks
do not block exchanges and that both carrier aircraft remain protected.

Local validation: typecheck, 40 service/shipyard/carrier/readiness tests, and six
desktop/phone browser scenarios passed (pointer input, carrier preservation and
automatic aircraft recycling). No Fly deployment was performed.

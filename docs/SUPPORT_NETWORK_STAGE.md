# Shared economy and support network

14 October 2026 implementation stage, explicitly requested before automatic bomber
missions. The player recovers alien material, chooses ground processing or orbital
shipment, and spends the resulting shared budget on construction and recovery.

## 25 October: shared passive reserves

This update supersedes the original fixed orbital reserve and absence of ground
income below. ORB refills at 2 per running second; GND refills at 0.4 per running
second (one GND every 2.5 seconds). Income rates do not multiply with crew size.

| Distinct connected players in this map | ORB refill threshold | GND refill threshold |
| --- | --- | --- |
| 1 | 250 | 50 |
| 2 | 400 | 85 |
| 3 | 650 | 135 |
| 4 | 900 | 185 |

For multiplayer, thresholds are `250 × players − 100` and `50 × players − 15`;
the deduction applies once. A solo player keeps the full 250 / 50 thresholds.
Each map counts its own connected pilot identities, including pilots awaiting
deployment/recovery; extra tabs for the same pilot count once. Leaving a map
lowers its thresholds but never removes supplies already earned. Joining changes
future refill limits without awarding a lump sum. Both pools retain their 2,000
storage capacity; salvage and shipments can exceed the passive thresholds.

Refilling stops when nobody is connected, the campaign is paused, or its owner
is absent and the simulation is frozen. Existing balances and fractional progress
are preserved, with no reset or offline catch-up. Field logistics displays the
server's connected-player count, both rates and both current thresholds.

## Rules for this stage

- Two campaign-wide balances, shared by all teammates and cores. The existing
  serialized `supplies` field is orbital SUP; `groundSupplies` is ground SUP.
- Preserve every existing orbital credit; migrate ground SUP to zero. New campaigns
  start with 1,200 orbital and zero ground SUP. Each balance caps at 2,000. Keep the
  existing running-only +2/s orbital reserve up to 250. No ground passive income.
  These are provisional balance choices, not measured economic balance.
- Processing at a completed core/outpost converts cargo into ground SUP at 30/s,
  one cargo per supply. Rocket delivery converts cargo into orbital SUP at 1:1.
  Full balances retain unprocessed cargo; no double reward for one batch.
- Local construction uses 25% of the orbital price and takes 60 running seconds.
  A friendly core, outpost or factory must cover its footprint. Orbital placement
  is global subject to existing terrain, clearance, ownership and capacity rules.
- A 2-by-2 outpost provides local construction support, ground processing and shared
  robot respawn. Its power module is presentation, not an electricity/upkeep system.
  Initial cores gain receiver artwork without moving their sentry or robot exit.
- Local construction reserves a one-tile drone store inside the future footprint.
  Drones are client effects, not independently simulated/destructible workers.
  Orbital deployments reuse capsule impact and panel opening. Existing core, tank,
  dock and aircraft arrival geometry stays intact.
- Local shipyard hull construction uses ground SUP and 60-second assembly. Dock,
  airbase and ramp repairs also use ground SUP. Ordinary firing/revival stays free;
  emergency core and HE-tank recovery must remain available.
- Rocket cargo is reserved at launch, delivered after five seconds, and earns SUP
  once. A 120-second launch-to-launch cycle includes a visible final return/landing.
  Trucks can fill remaining station storage while the rocket is away. Station loss
  before delivery drops the unshipped cargo; after delivery it cannot drop that cargo
  again. The rocket animation ends with its lost station. Each station has its own
  saved cycle; room pause/offline does not advance it.
- One free bomber delivery to an existing airbase per campaign is saved at accepted
  admission, not on every join or rebuild. Existing included bombers are retained;
  migration gives the campaign one future delivery allowance, not an extra aircraft.

## Persistence and checks

Back up v1 logistics before migrating to v2. Keep the storage key so old worlds and
reset tooling retain one authoritative logistics record; reject unknown versions.
Existing paid orders retain their refund currency. Deduction and accepted object
creation remain atomic. Verify shared spending, rejected requests, refund routing,
receiver saturation, rocket credit/cooldown across restart, outpost respawn,
construction locks, support loss and saved return. Inspect both desktop and phone
rendering using isolated test saves. Record actual results after validation; local
tests do not establish Fly capacity or deployment success.

Automatic bomber missions, new bomber payloads, carrier support, electricity and
friendly-wreck salvage are later stages.

## Validation on 14 October

- TypeScript check passed. The final full domain/HTTP run covered 354 tests:
  352 passed; two test expectations needed correction (floating-point tolerance
  for paid repair and an event-stream connection for the new tank admission test).
  Both affected files then passed all 26 tests. No domain failures remain.
- Ten browser scenarios passed across desktop and phone: aircraft, attack jet,
  construction presentation, logistics and the shared support network. Aircraft
  checks now wait for airbase assembly. A final support-network rerun also checked
  E opens a nearby outpost receiver, receiver launch restrictions, persistence,
  mobile bounds and JavaScript errors.
- Inspected local screenshots of orbital capsules, opening panels, drone stores,
  rocket return and the two-line phone supply HUD. Generated review images remain
  in ignored .local; existing documentation previews were preserved.
- Browser cases passed, but the Windows Playwright runner lingered during global
  teardown and was stopped after case completion. This is not a clean runner-exit
  claim. No production deployment or Fly resource-capacity validation was run.

Playtest: B > Logistics > Support outpost. Park a loaded recycler near a completed
core/outpost for ground SUP, or beside a rocket station for cargo storage and
orbital shipment. E opens receiver controls; L opens Logistics anywhere. Choose a
friendly construction source for the cheaper 60-second local build, or orbital
for global delivery. Both balances appear in the HUD and are shared by teammates.

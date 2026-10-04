# Vehicle survival and swimming attackers

Playable stage, 2026-10-04. Deployed tanks and coastal ships now take enemy
damage and can be destroyed. The initial training rover retains its previous
behavior. Shipyards, armor/penetration, repairs and a resource economy remain
future work. README updates remain grouped at agreed checkpoints.

## Play loop

- Tanks have 200 hull; ships have 300. Existing saves receive these defaults.
  Crawlers can pursue deployed tanks and strike for 25 damage. They still target
  robots and the land objective. Empty and disconnected vehicles remain targets
  while another viewer keeps the world running.
- A successful naval cannon shot attracts up to three surface swimmers when
  no swimmers are active and the shared contact timer is ready. **Naval contact**
  requests the same encounter manually. A sonar toast, contact count, minimap
  markers and hull bars make the threat visible.
- Swimmers have 60 health, move at 1.85 tiles/s, and strike the hull at close
  range for 35 damage. Their one-second wind-up locks an orange strike circle;
  moving clear makes the attack miss. There is a further 1.6-second cooldown.
  Ship speed remains 2.5 tiles/s forward, so retreating is a useful response.
- HE produces water splashes and a pale underwater flash; fire kills on contact
  and deters routes; gas lures swimmers and spends its existing kill capacity.
  Robot, sentry, tank, artillery and missile weapons share the enemy collection,
  so teammates on shore can cover the ship. These are surface swimmers, without
  underwater depth or submerged immunity mechanics.
- At zero hull, the vehicle becomes a nonblocking wreck. Its pilot is disabled,
  loses the seat and uses the existing friendly-core recovery flow. There is no
  second robot left outside the vehicle and no active robot stranded in water.
- After recovering, the owner can use **Replace destroyed tank/ship** in the
  appropriate deployment category. Cargo takes 12 seconds of active-world time
  to prepare. The original drop site must be clear, including enemies: clear
  the threat before redelivery if they are occupying the cradle or tank panels.
  Replacement reuses the saved vehicle record and existing landing animation;
  repeated requests do not duplicate vehicles or refill an active hull.

The cannon still has its six-tile minimum range. Keeping enemies outside that
distance, moving to regain separation, and receiving shore support are intended
decisions to test. These starting numbers are implementation choices for this
prototype, not established balance results.

## Shared outcomes and limits

Only enemy strike resolution calls the shared vehicle damage function. Friendly
weapons never damage vehicles, robots or bases. Vehicle health, hit count,
destruction, cargo timer and seat state live in the existing vehicle records.
Damage saves before broadcast; loss of a piloted vehicle and disabling its pilot
share one SQLite transaction, including an offline driver. Timers checkpoint at
the existing half-second cadence. Recovery is still validated by the server.

Destruction does not remove core flooring, tank panels or shore docks. Wrecks
are cosmetic and do not reserve the moved hull's location. Their original cargo
sites remain associated with the vehicle and are revalidated for replacement.
One saved tank, one gunship and one missile submarine per owner are the current
limits. Navy keeps a shared four-vessel world cap; see [Submarine](SUBMARINE.md).

Naval contacts have a shared 30-second timer and a maximum of six simultaneous
swimmers. They coexist with the three-crawler land drill. Starting a land drill
does not erase swimmers, and swimmers do not hold the land drill open after its
crawlers are killed. Water paths are four-connected, reject land, bridges and
ship hulls, and search at most 2,048 nodes per route. Paths are normally refreshed
once per second. Contact placement also requires a reachable water approach.
Swimmers avoid heat, seek gas, and cancel attacks while burning and fleeing.

Enemy encounters, projectiles and fields remain transient on server restart.
Vehicle damage, death and replacement progress persist. Simulation pauses when
nobody is connected. Cosmetic wakes, smoke, damage flashes and splash particles
remain browser-side; they never apply additional damage.

## Evidence and limits

- `spec/vehicle-survival.test.ts`: tank targeting, hull damage and one-time loss,
  friendly immunity, swimmer wind-up/dodging/burn interruption, water routing,
  HE/fire/gas interactions, simultaneous ground/naval encounters and the six cap.
- `spec/vehicle-persistence.test.ts`: actual HTTP enemy damage, disconnected pilot
  loss, restart while disabled, core recovery, timer pause, owner-only replacement,
  idempotent redelivery and nonlethal damage persistence. All use disposable saves.
- `tests/browser/naval-survival.spec.js`: two viewers, contact/attack indicators,
  loss, restart, recovery and orbital replacement at 1920×1080 and 390×844, plus
  resize. These fixtures start with 105 hull to keep the destruction check short.
  Existing navy and tank deployment browser flows also pass.
- Type checking and 124 domain/HTTP test cases passed. Six browser cases passed;
  the two survival cases were repeated after the phone control spacing adjustment.
  Screenshots are in `docs/previews/naval-*`.
- `node scripts/check-naval-runtime.mjs`: a disposable local workload, four SSE
  viewers and ships, three swimmers, movement and shell requests for 30.62s.
  Peak process RSS 130.4 MiB, CPU 3.2% of one core, request p95 81.36ms. This
  Windows process includes both server and test clients; other automated checks
  were running concurrently. It is not a Fly 256 MB or sustained-load guarantee.

Audio, advanced swimming animations, repairs, sinking choreography and broader
playtesting remain later work. The current figures establish bounded behavior
and basic persistence, not long-term difficulty or large-army capacity.

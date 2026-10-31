# Island pressure stage — 30 October 2026

The approved stage makes hostile cities sustain resistance and gives cleared
land occasional small roaming groups while the planet remains contested. It
uses the existing enemies, perception, warnings and permanent-conquest rules.
It applies to existing and new Caldera/Vesper campaigns without moving terrain,
facilities, construction or player records. This is a local implementation;
deployment and sustained Fly capacity are separate checks.

## Arrival rules

| Situation | Rule |
| --- | --- |
| Occupied hostile land | One shared island allowance, initially two bodies, replenished at two per 12 active seconds for a solo player. Nearby compounds take turns using it. |
| Multiplayer on the same island | Apply `1 + 0.7 × (eligible players − 1)` once to the island's ordinary arrival clock: 1 / 1.7 / 2.4 / 3.1. Neither HP nor population caps multiply. |
| A city is partially destroyed | Multiply ordinary replenishment by the surviving fraction of nearby nonaquatic facilities within 36 tiles of the contacts. Destroyed members remain in the denominator. |
| Cleared land | One or two ordinary hunters after a seeded 90–150 island-clock seconds; then another full quiet interval. Failed placement retries after 10 island-clock seconds; scarce admission retries on the next two-second director pulse. At four players, the successful-interval range is about 29–48 real active seconds. |
| Empty island | Stop its clock, clear unused credit and reset its roaming deadline. Cancel unmaterialized site arrivals. Existing enemies and fired attacks remain. |
| Full population | Retain at most two unused ordinary credits; never accumulate missed waves. Releasing capacity may admit one pair, not a catch-up backlog. |
| Final planetary conquest | Cancel pending arrivals, stop all future production/raids, retain living and sleeping survivors with their existing identity and HP. |

An allowance is an upper bound, not a promise to spawn on a blocked or crowded
approach. Finite opening guard rosters remain intact and use the same population
admission checks. Compounds retain their six-defender cap, including their
sleeping defenders and reserved arrivals. Replacement roles rotate through
hunters, breakers and Bulwarks; AA compounds retain their occasional mobile
lenses. Four living lenses remain the limit.

Roaming shares ordinary credit with city production and has a separate limit of
six roaming survivors/reservations per island, including sleepers. It does not
use up a remote source's city-defense quota. When every *nearby* facility is
cleared, credit refills at the base rate solely for sparse roaming; a living
hostile source elsewhere on that island is still required. An island with no
surviving source has no new roaming groups even if another island is contested.

The existing stronger natural raids remain a separate escalation: initial
3–5-minute wait, eight-second warning, 60-second surge, 30-second recovery and
2–5-minute quiet interval. Those room-level deadlines are not multiplied. The
ordinary ground raid roster is fixed at two heavies plus four hunters rather
than also increasing with player count. Sea and air raids keep their explicit
roles. Capacity-denied raids retry at the two-second allocation cadence so they
cannot repeatedly miss their turn.

## Geography, safe approaches and enemy knowledge

Geographic IDs come from immutable base terrain. Ocean separates islands;
Vesper's rivers, lakes and mountains belong to their surrounding continent.
Bridges and constructed floors cannot join two pressure budgets. Spawn and
movement checks still enforce real terrain, obstacles and fire.

Only unique eligible connected players count. The server resolves the physical
position of occupied vehicles; duplicate tabs, empty vehicles, dead/shielded
robots and submerged submarines do not add pressure. Separated player groups on
one continent share its allowance and rotate the roaming focus.

A roaming source must be a real living, nonaquatic hostile facility on the same
island. A cleared-ground focus must be at least 24 tiles from hostile facility
footprints. The planner searches a bounded set of approaches, keeps arrivals at
least 12 tiles from every eligible teammate, including airborne teammates, and
10 tiles from recovery-core/outpost footprints. It rejects machinery, buildings,
fire, occupied enemy positions and impassable approach corridors. Rivers and
mountains cannot be bypassed by spawning across them.

The existing 2.2-second ground warning marks each arrival. At materialization,
the server rechecks the source, contacts, terrain and hazards. A hunter receives
one saved investigation point for 30 seconds and a local rally point midway
along the approach, within the existing 20-tile home leash. It still needs local
perception to detect/pursue a player. Moving after the warning does not update
that investigation destination. Restart preserves the plan, RNG, deadlines and
fixed destination; it does not reroll a warning.

## Shared capacity and limits

All producers share **24 active enemies plus reserved arrivals**. New admissions
divide that capacity among occupied geographic contexts, with one shared sea
context for surface/ocean contacts. Shoreline aquatic hives charge their nearby
eligible contact's context, even when the hive itself stands in ocean water.
Swimmer species limits remain unchanged.

When only three or fewer slots remain globally **or in that context**, a saved
two-second turn rotates through raid, city, roaming, city, aquatic, city. This
gives scarce admission opportunities to the different producers while retaining
city priority. Already accepted warnings keep their reservations. Existing
survivors are never deleted or moved to manufacture an equal split; an occupied
context can remain over its new share after players move. New arrivals there
wait for capacity. Sleeping-survivor wake rules retain their existing priority.

The six-roamer cap and lack of a source can produce longer peaceful periods than
the configured timer. Actual city intensity, escape routes and siege balance
still need the author's solo/cooperative playtest. No flying enemies, AA vehicle,
new planet, higher population limit or HP increase is included here.

## Verification

- Final `pnpm check` passed: typecheck and **982 tests across 124 files**, exit
  code 0 (`.local/pressure-verified-check.log`). Legacy migration fixtures exclude
  later dense-city structures when recreating an older save; the conquest-banner
  fixture pauses city production so its two-survivor assertion stays isolated.

Useful repeatable entry points are `pnpm check`,
`spec/pressure-stage.test.ts`, `spec/pressure-budget.test.ts`,
`spec/island-pressure.test.ts`, `spec/roaming-pressure.test.ts`,
`spec/roaming-arrivals.test.ts`, and `tests/browser/pressure-stage.spec.js`.
The local timing probe is `node --expose-gc scripts/pressure-benchmark.mjs`.

- The focused integration suite exercises real combat ticks: 1/2/4-player
  replenishment and duplicate contacts, production loss, quiet intervals,
  empty-island cancellation, saved warning replay, source destruction, final
  conquest, scarce raid turns and mixed guard/city/raid/aquatic admission.
  All 15 cases pass, including two/three/four-player retry timing and alternating
  full/available islands. Scarce retries use the real producer cadence and keep
  their focus while waiting, avoiding timing cycles that skip teammates.
- Browser checks passed for two-account shared roaming warnings and identical
  spawned enemies at a common SSE revision, including an owner page reload;
  natural raid continuity; and desktop/phone conquest ribbons with server restart.
- The generated-world timing probe used Node 26.5.1 on a local i9-14900K,
  40 warmup ticks plus 120 measured 100 ms simulation steps per case. All cases
  held 24 active enemies, with no reserved arrivals at the final sample.

| Planet / players | Facilities | Mean tick | p95 tick | Max tick | Post-GC heap delta | Snapshot bytes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Caldera / 1 | 180 | 1.150 ms | 2.845 ms | 6.010 ms | +0.235 MiB | 121,768 |
| Caldera / 4 | 180 | 2.130 ms | 3.931 ms | 5.335 ms | +0.231 MiB | 134,517 |
| Vesper / 1 | 141 | 1.025 ms | 2.100 ms | 3.054 ms | +0.048 MiB | 97,273 |
| Vesper / 4 | 141 | 1.739 ms | 3.558 ms | 4.518 ms | -0.151 MiB | 107,422 |

Players moved near separated generated hostile compounds. Caldera's four-player
case covered four islands, Vesper's three. This measures the whole combat tick
with ordinary enemies/facilities; it does not isolate the new director's overhead.
Evidence logs are local at `.local/pressure-benchmark-results.json` and
`.local/pressure-stage-scheduling.log`; rerun the repository script/tests to reproduce
the procedure rather than expecting identical timings.

The timing probe excludes server/network propagation, rendering, weapon load and
persistent IO. Its memory delta is a short observation, not a leak guarantee or
evidence that a 256 MB Fly machine can sustain four-player combat.

# Normal campaign encounters

19 October 2026. Implemented locally for playtesting; values are initial tuning.
Named saved campaigns run the encounter director automatically. Existing saves
receive a fresh first-event countdown without resetting sites, health or progress.
The legacy test field and local test buttons retain their separate roles.

## Combat loop

Approaching a hostile compound wakes its existing opening guards. While a living
member remains and a physical player is within 36 tiles, the compound can then
replenish two defenders every 20–35 seconds, up to six surviving/reserved defenders
across its members. Destroying all members permanently stops that source.
Remaining defenders survive conquest; there is no recapture or site resurrection.
Waves mix Hunters, Breakers and Bulwarks. Flak compounds occasionally replenish
mobile lens enemies. Distant compounds do not continuously simulate production.

Raids provide pressure even on cleared land. The campaign seed chooses the first
deadline at 3–5 minutes of eligible active play. An eight-second visible warning
precedes arrivals; a surge lasts at most 60 seconds and has 30 seconds of recovery.
After that event completes, the next quiet interval is 2–5 minutes. One room has
one event, with focus rotating among active players. Four players do not create
four simultaneous events. The warning remains visible in vehicle/aircraft HUDs.

Ground raids request 6–12 mixed enemies, using existing nearby matching survivors
when possible. Around ships, up to three swimmers approach through reachable water
and up to three ground enemies can arrive on a nearby shore. Air contacts over
land can draw a twin-lens and a heavy-lens enemy. Fully submerged submarines remain
hidden. An aircraft over open ocean, a saturated population or a location without
a safe approach defers the attempt for 30 seconds; there is no unsuitable spawn
or accumulated queue. A failed focus rotates too, so it cannot starve teammates.

Warning locations are revalidated on arrival: terrain, collisions, capacity and
an eight-tile separation from every eligible player. Moving into a warning zone
can cancel that arrival. Ground approaches use bounded clear-line sampling;
water approaches use the existing bounded water route search. This conservative
first version may defer raids in narrow or heavily obstructed areas.

## Limits, saves and recovery

- Shared cap: 24 active enemies plus reserved arrivals, including tests and site
  reinforcements. Within that cap: six swimmers and four mobile lenses.
- Compound admission runs every two seconds and rotates between compounds.
- Up to 128 additional distant survivors can sleep. They retain identity, HP and
  home; they are not replaced with fresh enemies. Sleep requires distance from
  players (80 tiles) and friendly facilities/vehicles (24 tiles), no burning or
  committed attack, and no active event membership. Wake distances are 52 and
  20 tiles respectively, subject to the same active/reserved caps.
- Sleeping bodies remain visible in snapshots and vulnerable to accepted shots,
  explosions and hazard damage. Sleep removes AI/path work, not the enemy entity.
  When storage/capacity is full, spawning waits rather than deleting survivors.
- RNG state, active-play clock, compound cadence, pending warnings, event phase,
  orders and sleeping survivors travel with the combat checkpoint. Empty/frozen
  rooms do not simulate. Time offline does not cause catch-up waves on return.
- Facility destruction, permanent objective completion, armor immunities and
  bounded ordinary pursuit remain unchanged. Surges use the existing temporary
  pursuit rules, with ground assignments bounded to the event's neighborhood.
- Audit events reuse `frenzy.warning`, `frenzy.started`, `frenzy.resolved` and
  `reinforcement.changed`; natural warnings carry `cause: natural_encounter`.

The population and sampling budgets bound work; they do not establish a measured
256 MB performance guarantee. Review simultaneous fronts, abandoned defenses,
warning readability and survival/economy balance through normal play before
raising caps. No extra enemy types or resource-price changes belong to this stage.

## Verification

`spec/encounter-director.test.ts` covers automatic activation, deterministic saved
deadlines, no offline catch-up, compound replenishment/conquest, combined caps,
water/shore/air choices, submarine concealment, spawn revalidation and offscreen
damage to sleeping survivors. The named-campaign browser fixture accelerates only
its isolated save's first deadline, then observes the normal warning, reload and
arrival without invoking a test-spawn endpoint.

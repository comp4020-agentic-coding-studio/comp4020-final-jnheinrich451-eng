# Land pursuit and seeded hostile fronts

18 October 2026. Staged design following the author's playtest: aquatic
enemies feel more motivated than land enemies; campaigns should have different
combinations of hostile facilities, followed by more enemy types. This file
records the sequence. Ordinary pursuit and a local test frenzy are now
implemented as described in the checkpoint below. The 19 October follow-up adds
seeded compounds, denser continental fronts and the Breaker/Bulwark roles locally;
numerical balance still needs playtesting. Dated checkpoints retain the evidence
and earlier tuning; the final section records the current armored-enemy rules.

Follow-up: the author accepts the ordinary-behavior direction and proposes
temporary frenzy events with distance-independent pursuit, most enemies hunting
players and a minority attacking globally placed facilities. Player defeat is
an intended possibility. The event mechanism and loss rules below are proposals;
the accepted pipeline does not authorize campaign erasure.

## Current playable checkpoint

Use the local server at `http://localhost:8080`. Existing land defenders acquire
at ten tiles, retain to fourteen, and investigate their last observed point for
four seconds. Hunters now move at 2.6 tiles/second, below the robot's 3.0.
Breakers and Bulwarks are slower; see the current role table at the end. Ordinary
home limits, readable windups and recovery remain in force. Fire/gas behavior
is unchanged except for the explicitly immune Bulwark. Conquered
home survivors rally locally instead of restoring the site. Players and
damageable facilities share the same enemy population.

After landing, the operations panel has **Test frenzy / local**. The campaign
owner can trigger it from a robot or tank. It borrows up to twelve existing
ground enemies and supplements a smaller roster with warned arrivals on clear
approaches. Five seconds of warning show emergence circles; a sixty-second
tracking signal then assigns roughly three quarters to combatants and at most
one quarter to facilities, with at most three assigned raiders per structure.
Absent valid facility targets, spare raiders can hunt. Absent reachable players,
hunters do not all become facility raiders. Facility attraction uses approximate
16-tile base buckets; this is not yet a formal base/settlement graph.

The coordinator samples positions each second and holds valid assignments for
five seconds. Ground tanks with a pilot and occupied recyclers count as player
bodies; no second robot appears inside them. Airborne, submerged, orbital and
shielded bodies remain ineligible for ground hunting. Infantry still needs a
valid land route; distant targeting does not teleport enemies or extend melee.
Raiders keep their assigned purpose; opportunistic defensive retargeting is
deferred until the basic quota has been playtested.

The event resolves when its roster is killed, its signal expires, or no eligible
ground combatant or recovery structure remains. There is a thirty-second test
cooldown. In the last case, event survivors also stop attacking during that
recovery period. They remain damageable and are neither healed nor deleted.
This is a recovery safeguard, not a new campaign game-over system. Existing
emergency orbital recovery and emergency HE access remain unchanged.

Named campaigns checkpoint event identity, finite reservations, roster, orders,
phase and simulation-time deadlines alongside combat. Pause, owner grace and
room closure freeze progress; reopening does not replay arrivals. The trigger
requires a connected active ground body and owner authorization in named rooms.
It is unavailable when running on Fly or under `NODE_ENV=production`; tests can
also explicitly disable the capability. No natural campaign triggers yet.

Enemy routing now uses sparse incremental A* with a shared 1,024-expansion
budget per tick, 256 per request, at most 4,096 records per search and 32 jobs.
Failed searches back off; exhausting the search budget is recorded as limited,
not as proof of disconnected terrain. Dynamic bridge/collision changes are
rechecked. Searches are disposable across restart; actual positions, paths and
contact memory are saved. Player routing is unchanged. This first version does
not yet implement the proposed coarse region-connectivity graph, so complex
long detours can defer and retry rather than producing a route immediately.

The test roster shares the existing 24-enemy admission budget with scanner
reservations and naval contacts. It does not multiply with player or building
count. Ordinary scanner reinforcements remain their own bounded behavior;
they do not join or replenish the event roster automatically.

`scripts/probe-land-ai.mjs` runs 30 simulated seconds on a 512-by-384 split
landmass with 24 crawlers and four ground targets. One local Node 26/Windows
sample measured 2.51 ms p95 and 9.10 ms maximum per tick, with 171.5 MiB peak
process RSS. This simulation-only measurement excludes HTTP/SSE, SQLite, other
rooms and rendering. It is not proof of capacity on the 256 MB Fly machine.

Automated coverage exercises pursuit/memory, water and bridge changes, bounded
search, stable quotas, two-player assignment, target invalidation, finite
arrivals, owner-only access, disabled test capability and campaign restart.
Desktop and phone browser cases verify warning, signal, reload and readable
controls. The HE missile test now places a defender at a committed impact so
its damage assertion does not depend on the old crawler movement speed.

Validation: `pnpm check` passed all 436 tests across 66 files and type checking.
After the recovery-grace adjustment, type checking and 21 affected tests passed
again. Both desktop and phone frenzy browser cases passed; screenshots were
inspected. The local server exposes the new test capability. No commit, push or
Fly deployment was performed for this checkpoint.

## Findings before this implementation

- `public/combat.js` acquires ordinary ground targets within six tiles and
  retains them within eight. Normal movement is 1.1 tiles/second. Site guards
  also have a home leash; fresh scanner reports can extend awareness.
- `public/naval.js` moves swimmers at 1.85 tiles/second and retains an eligible
  ship target without a distance cutoff. Copying this literally would permit
  planet-wide pursuit. Reuse the persistent pursuit idea with explicit limits.
- `public/conquest.js` currently places each facility kind near fixed preferred
  coordinates. Its function name `seedConquest` does not mean that campaigns
  receive different random seeds. `public/planet-world.js` also uses a common
  deterministic terrain layout.
- Ground `findPath` allocates an array for the whole map and can search an
  entire connected landmass. More frequent or longer pursuit needs bounded
  enemy routing before increasing population; naval routing already has a
  node budget. Do not change player routing as an incidental AI adjustment.

## Stage 1: make existing land enemies commit to a fight

Player loop: approach a hostile site, attract defenders, use movement, cover
and weapons to survive, then destroy the site permanently. Escaping must remain
possible, and a distant artillery operator must not become magically visible.

Proposed states: guard -> pursue -> wind up -> strike -> pursue; after losing
contact, investigate the last observed point briefly, then return to a living
home. If home was conquered, survivors remain in a bounded local area without
healing, rebuilding the site or creating fresh guards.

Initial tuning candidates: ten-tile circular local acquisition, fourteen-tile
retention, four seconds of last-position investigation, and 1.6 tiles/second
normal pursuit. Keep the existing home leash, scanner rules and readable attack
windups initially. Local circular sensing remains alien proximity sensing;
scanner beams retain their separate obstacle/line-of-sight rules. Loss of
contact must stop live position updates, not merely start a timer while following
an invisible target. These values are tuning proposals, not accepted balance.

Keep a valid target instead of continually switching to the nearest object.
Prefer a nearby reachable active combatant when acquiring; eligible facilities
remain attack targets. Preserve facility armor checks. An unreachable target
gets a bounded retry/backoff and must not monopolize pathfinding forever.
Enemies stay on their valid terrain and cannot melee aircraft or ships across
water. Include robot bodies guarding while their player operates a facility.

Preserve fire avoidance, burning panic, gas attraction, respawn shields and
fixed-point attack warnings. Keep these priorities explicit. Do not add global
movement-noise propagation or let every site call reinforcements. Existing
sector attack reports and scanner marks continue to supply bounded information.

Server owns all decisions. Stagger acquisition and routing, bound searched nodes
and total path work per tick, and cache failed routes briefly. Keep existing
population limits. Log meaningful acquisition/loss/attack outcomes with sampled
summaries rather than one log per movement tick.

Acceptance: robot and tank provoke pursuit, dodging a windup works, retreat
loses contact, impossible water/obstacle routes back off, hazards still work,
and two players share the same enemies. Save/reopen must preserve health,
conquest and valid AI memory without spawning duplicates. Check simultaneous
fronts, tick duration and memory before claiming Fly capacity.

## Stage 2: a saved seed per campaign

Use one seed and generator version per campaign, shared by every teammate.
Different new campaigns receive different seeds; reopening or joining never
rerolls the world. Keep terrain unchanged in this first population stage.

Generate bounded encounter groups from authored templates, then vary positions,
orientation, composition and difficulty within safe ranges. Examples:

| Group | Tactical purpose |
| --- | --- |
| Crown with guards | Silence reinforcement calls |
| Mortar with a root | Approach under bombardment; clear a defended area |
| Flak with ground defenders | Open a route for aircraft |
| Contaminator with an external defending site | Destroy concealment from range |

Do not randomly stack every powerful facility into one opening encounter.
Guarantee a viable foothold, usable transport/building space, separation between
encounters, and an attainable first HE objective. Validate terrain, footprints,
approach routes and a finite placement-attempt budget. Skip invalid placements
with a recorded reason; never force them into player infrastructure.

Store the generated site records as well as seed/version. Persist stable site
IDs, compound membership, objective totals, partial HP, conquest and remaining
guard allocations. A later generator change must not reinterpret existing saves.
For existing campaigns, preserve every current site and player object; use a
full backup and atomic, idempotent additions only in approved expansion regions.
No reset, relocation, free salvage duplication or enemy recapture.

Separate static site records from active defenders. Wake encounters near actual
players/units or accepted incoming attacks, independent of camera position.
Dormant state must still receive committed distant damage. Spawning consumes
shared budgets; a full budget defers a bounded request without an accumulating
catch-up wave. Fairness across simultaneous fronts needs explicit scheduling.

Acceptance: same seed/version produces the same valid layout; different seeds
produce meaningful variation across a sample; all sampled starts are viable.
Two clients see identical sites, destroyed sites stay destroyed after restart,
old saves remain intact, and off-screen accepted strikes still resolve once.

## Stage 3: roles before roster size

Start with the existing crawler as the hunter, then add one role at a time:

| Role | Pressure and counterplay |
| --- | --- |
| Hunter | Closes on robots; readable melee windup, vulnerable to area control |
| Breaker | Slow armored vehicle/infrastructure attacker; heavy attacks are telegraphed |
| Spitter | Ranged projectile forces movement; travel warning allows a dodge |

Reuse sensing, memory, navigation and save handling while keeping role-specific
target eligibility and attacks. Determine breaker armor/penetration and spitter
direct-versus-splash damage separately; this proposal does not authorize a new
global armor formula. Preserve red/rust biological silhouettes and purple hit
effects, with distinct shapes and windups rather than color alone.

## Event layer: a coordinated frenzy

Frenzy overrides ordinary acquisition/pursuit distance and the home leash for
assigned event participants. It does not override terrain, bridges, movement
speed, weapon range, armor, attack windups or population limits. It does not wake
every enemy on the planet. Keep fire avoidance, burning panic and gas attraction
until an explicit later enemy role introduces an exception.

Proposed lifecycle: warning -> surge -> resolution -> recovery cooldown. Use
simulation time: pause and owner-reconnect grace freeze the event; closing the
room saves it without rerolling enemies or starting an offline attack. Start with
a manual local-test trigger; the eventual campaign trigger could be destroying
a major hostile compound. Trigger source, warning, duration and repeat interval
need playtesting. No random repeated punishment merely for having more buildings.

The first event should have a finite roster under existing live-enemy caps,
not an endless source of reinforcements. Existing guard assignments retain
their IDs and home/site history. Extra event arrivals, if used, consume a saved
finite allocation and have a visible emergence warning. Keep normal scanner
arrivals within the same capacity accounting and prevent overlapping frenzies
from multiplying the budget. Surviving enemies persist after the event; their
ordinary home rule cannot snap them back or teleport them across the map.

### Shared assignment algorithm

Use a server-owned coordinator for each event. It assigns purposes and target
IDs; ordinary per-enemy movement and attack still execute them.

1. Let N be living assigned event enemies. Initially propose floor(N / 4)
   facility raiders and N minus that count player hunters. Thus 20 enemies give
   5 raiders and 15 hunters; groups smaller than four prioritize players.
   This is a quota, not a new 25% random roll by every enemy every frame.
2. Build candidate sets from eligible player bodies and damageable facilities.
   An embarked player is represented by the occupied vehicle, never a duplicate
   robot. A facility operator's guarding robot is a valid separate body.
   Exclude dead, orbital, shielded or otherwise untargetable bodies; airborne
   and submerged targets retain their medium-specific protection from ground
   melee. Reject facility targets this enemy cannot damage through armor.
3. Select the minority of raiders using role suitability and route cost; later
   breakers can fill those slots. Rank facility targets by strategic value,
   estimated travel cost and existing assigned attackers. Apply a small per-site
   attacker cap. Group nearby infrastructure as one candidate base so placing
   many cheap structures does not multiply its attraction. A distant facility
   is eligible, but is not automatically more attractive than a nearby one.
4. Assign hunters among reachable players, penalizing already concentrated
   assignments. Two equally reachable players split roughly evenly; three
   players do not triple the event population. Prefer stable assignments over
   exact numerical balance on every tick. A taunting/nearby player can still
   attract danger without making another player immune.
5. Keep assignments for a proposed five seconds and refresh the coordinator
   approximately once per second, staggered across work ticks. Immediately
   invalidate destroyed targets, invalid bodies or confirmed broken routes.
   Rebalance only enough units to fill shortages. Permit short defensive
   attacks against nearby combatants without permanently losing a raid order.
6. If no valid facility exists, spare raiders may hunt players. If a hunter has
   no reachable player, investigate its last event contact and then hold/rally;
   do not silently convert the entire roster into facility attackers. The
   facility quota is a maximum while players escape into air/sea. If neither
   category has targets, resolve the attack instead of running expensive retries.

Numeric weights, the per-site cap and assignment interval are tunable, not final
balance. Facility count alone never increases N. The denominator is the event
roster, not all enemies in every dormant region. Finite replacement assignments
must not replenish dead members by accident.

### Target information and global travel

Ignoring distance needs an explicit information rule. Proposed frenzy fiction:
an alien signal periodically marks eligible ground combatants for the event.
The HUD warns that the signal is tracking them. Event participants receive a
sampled position at the coordinator cadence; this is an intentional temporary
exception to ordinary local sensing, not continuous free knowledge for all AI.
Obstacles still block attacks and constrain routing. When the signal ends or a
body becomes ineligible, only its last observed point remains. Ordinary scanner
marks and their cover rules remain separate. This signal rule needs acceptance
before implementing it; longer commitment alone can instead use last sightings.

Facility raid orders can retain a known fixed destination regardless of distance.
Connectivity must distinguish connected land from islands and account for built
bridges. A ground enemy cannot raid a distant island without a route. Cache
terrain-region connectivity, update it when crossings change, and combine coarse
waypoints with bounded local routing. Add negative-route caching and a global
per-tick search budget; a node-budget exhaustion means deferred/unknown, not proof
that a route does not exist. Do not run full-planet BFS for every assignment.

Keep real travel time. No relocation of an existing enemy near its destination,
no attacks performed just because a target is outside the camera, and no
off-screen damage shortcut. A later amphibious or flying attacker can expand
reachability through an explicit movement/attack role. A finite event can end
before a distant raider arrives; loss of frenzy returns it to bounded ordinary
behavior around its current area if home is far away.

### Defeat and recovery

The current economy already supports destroyed facilities, free robot revival,
emergency orbital recovery after all cores are lost, and a gated emergency HE
tank. Preserve those paths while strengthening attacks.

Recommended first consequence: a failed defense with real lost equipment,
destroyed production and recoverable wrecks, followed by rebuilding. Do not
reset the planet, restore conquered enemies or deduct supplies a second time.
Being disabled while a usable respawn point exists is ordinary player loss,
not automatic campaign defeat. A team wipe with no usable recovery point can
be labelled a failed expedition and offer the existing return-to-orbit recovery.
Disconnection alone is never a death or loss condition; evaluate actual saved
body/recovery state and retain occupied-vehicle recovery rules.

A future defend-a-specific-base event may have its own explicit loss condition,
shown before the surge, even if players survive. Permanent campaign game-over
would be a separate opt-in design decision with restart/save policy. Do not
disable emergency recovery to manufacture difficulty. After a failed expedition,
resolve the frenzy and provide a recovery grace period so a new emergency core
cannot immediately be trapped by the same event. Exact grace and event outcome
rules must be settled before enabling natural campaign triggers.

Acceptance checks: stable quota and target allocation, two-player fairness,
no cloning on join/restart, bounded work for unreachable islands and distant
bases, correct bridge changes, no invalid armor/air/sea attacks, finite arrivals,
once-only event outcomes and preserved partial HP/conquest. Test all-player
disablement, disconnect/reconnect, boarding and respawning during the event.
Budgeting must include simultaneous ordinary combat and saved distant strikes.

## Seeded compounds and Breakers: 19 October playable checkpoint

The author accepted the ordinary pursuit/frenzy playtest, then approved seeded
outpost generation and additional enemy roles. This stage adds one new role to
test its counterplay before adding ranged enemies.

Open **Planet (N) → Alien compounds → View surface**. The selected compound's
required structures and permanent completion count appear in Operations. Existing
O/Shift+O objective cycling also includes these sites. Surveying only moves the
camera; travel/deployment still follows the existing rules.

New and existing named campaigns gain up to seven compounds: two in Aurora, two
in Haven and three in Meridian. Cinder and the original 128×96 region retain
their existing layout. Templates combine crown/root, mortar/root, flak/root or
crown/mortar/root. Fog/lance combinations are deferred. Positions and template
choices vary by campaign seed; all teammates share the same records. This is
outpost generation, not terrain regeneration or rolling enemy respawns.

Placement keeps each structure at least 39 tiles from its regional survey
center, reserving central staging space beyond flak/mortar range. Compounds have
spaced centers and clear land around their structures/arrival areas. Existing
player objects, rails, bridges, reclaimed floors and old objectives exclude
nearby placement. Bounded candidate search skips an occupied slot rather than
flattening terrain or moving objects. A skipped slot stays skipped in that save.

Before additions, the server backs up the complete campaign SQLite database.
One transaction saves the actual sites with the `seeded-fronts-v1` manifest:
seed, generator version, complete required membership and skipped slots. Reload
uses those saved records; a generator change must not reinterpret old layouts.
Partial HP, conquest, player construction, salvage already collected and both
supply pools are retained. Existing site salvage rules apply; there is no extra
compound completion payment and no recapture.

Each compound has one finite initial allocation of two Hunters and one Breaker.
Guards wait for local activation or a reported attack, use warned emergence,
and only consume roster entries when placement succeeds. The remaining roster
is saved. Crowns alone can subsequently call ordinary Hunter reinforcements.
All arrivals share the existing 24-living-enemy budget, including pending
reservations, naval contacts and frenzy. No global population increase or
camera-dependent spawning. Existing distant strikes still damage sites.

| Role | HP | Speed (tiles/s) | Hit | Windup | Recovery | Facility penetration |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Hunter (existing crawler) | 60 | 1.6 | 25 | 0.65 s | 1.4 s | 2 |
| Breaker | 180 | 0.95 | 50 | 1.4 s | 2.2 s | 3 |

Breakers favor nearby damageable vehicles/infrastructure during ordinary
acquisition; Hunters retain player-first behavior. Stable pursuit, home leash,
cover and remembered positions still apply. Frenzy prefers Breakers for its
limited raid slots without changing the player-majority quota. Heavy strikes
lock a one-tile-radius warning at the target's current position and hit only
that target if it remains in reach and unobstructed. The attacker stops during
the windup, so moving out dodges the hit. It is not splash damage.

The Breaker's broad plated body and heavy forelimbs distinguish it from Hunters;
its health bar uses 180 HP and close views label it. Plating is presentation and
higher HP, not a newly introduced enemy armor formula. Fire/gas remain lethal,
gas spends one charge per kill, and burning panic/friendly immunity stay intact.

Validation: `pnpm check` passed type checking and 445 tests across 68 files.
Coverage includes 24 deterministic seed samples, protected-space skips, saved
membership, shared layouts, backed-up additive migration, partial conquest and
supplies, finite mixed rosters, blocked arrivals, strike/dodge/restart behavior
and lethal hazards. A final placement refinement also protects remote tank pod
panels; type checking and all 13 focused generation/Breaker checks passed,
including dock, bridge, flooring and recycler preservation. Desktop and phone
browser checks passed again after linking compound selection to the Operations
checklist; screenshots were inspected. `scripts/probe-seeded-fronts.mjs` exercises 24 mixed defenders and
four ground targets at separate compounds for 30 simulated seconds. One local
sample measured 0.39 ms p95, 7.99 ms maximum, 89.3 MiB peak RSS and 0.84 ms
generation. These are simulation-only measurements, excluding HTTP/SSE, SQLite,
other rooms and rendering; they do not establish Fly capacity.

Next: playtest encounter density and Breaker counterplay, then a separate
Spitter role with a dodgeable ranged attack. Natural frenzy triggers and coarse
region navigation remain later stages. No push/deployment or README checkpoint
is included here.

## Density refinement after playtesting: 19 October

The author found two/three clusters per continent too sparse and requested more
separate encounters across the land. The new targets are **Aurora 6, Haven 6,
Meridian 12**, including existing/conquered compounds. The generator samples a
broader elliptical area rather than a narrow ring, with at least 32 tiles
between compound centers. Structure footprints, clear emergence ground, the
39-tile exclusion around survey centers, existing player construction and the
original region remain protected. Across 24 tested seeds without player
construction, 22–24 compounds were placed. Busy saves may receive fewer.

`seeded-fronts-v2` is a separate additive migration using the campaign's existing
seed. It preserves the v1 layout and all saved HP/conquest/guard consumption,
counts existing compound IDs toward each regional target, and backs up the
complete database before committing new records and the v2 manifest together.
It runs once; neither cleared compounds nor skipped slots regenerate on reload.
The v1 generator remains unchanged for existing-version reproducibility.

Every compound still uses the same finite initial guard roster. The shared
living/pending enemy cap remains **24 across the room**. More compounds add
objectives, saved data and facility scanning work, not a separately active army
at every site. The tradeoff is more frequent encounters during travel and
overlapping defensive sectors, with fewer empty stretches between them.

Validation: `pnpm check` passed type checking and **453 tests / 68 files**;
desktop and phone browser checks passed, and the denser globe was inspected.
Tests cover deterministic regional counts, clear staging areas, existing-site
preservation, conquered groups counting toward density, blocked-placement skips,
the full backed-up seven-cluster-save migration, supplies and restart idempotence.

`node scripts/probe-front-density.mjs` and the same command with `--dense`
exercise separate local Node processes with one named campaign, four connected
SSE clients and 24 mixed defenders across four fronts for 30 real seconds.
Both runs use the same seed, initial defenders and player positions. HTTP/SSE,
SQLite, autosaving and local HTTP clients are included; browser rendering and
additional active rooms are not. One Windows/Node 26 sample:

| Measurement | 7 compounds | 24 compounds |
| --- | ---: | ---: |
| All hostile-site records, including original objectives | 23 | 60 |
| Serialized initial site records | 9.6 KiB | 28.2 KiB |
| End combat snapshot | 23.3 KiB | 47.9 KiB |
| Peak process RSS | 154.0 MiB | 165.6 MiB |
| Peak JS heap | 43.3 MiB | 43.6 MiB |
| Process CPU time / elapsed time | 2.6% | 4.9% |
| Event-loop delay p95 (10 ms sampler) | 18.01 ms | 18.87 ms |
| Aggregate SSE traffic for four clients | 1009.1 KiB/s | 1938.8 KiB/s |

The measured RSS increase was 11.6 MiB. This supports a bounded density increase
locally, not a promise that every game fits a 256 MB Fly container. Windows RSS,
local machine CPU and the probe's in-process HTTP clients differ from deployment.
SSE traffic nearly doubled because full combat snapshots include all sites;
repeated static metadata/dormant-site updates are a candidate for later measured
optimization. Verify longer battles and the allowed two simultaneously active
rooms on Fly before increasing live populations or claiming deployment capacity.
No infrastructure size, economy price, weapon roster or deployment was changed.

### Armored enemy and pursuit tuning, 19 October 2026

The author requested a slow high-HP enemy, a slower cannon-target enemy, and
ordinary enemies only slightly slower than the robot. The existing Breaker
provides the first role. The approved armored exception accepts **HE/explosives
and the charged magnetic cannon**. This is a weapon-class rule for Bulwarks,
not a new armor formula for every unit.

| Role | HP | Speed (tiles/s) | Purpose |
| --- | ---: | ---: | --- |
| Hunter | 60 | 2.6 | Pressures the robot; robot speed remains 3.0 |
| Breaker | 180 | 0.95 | Tough, slow melee; ordinary weapons still work |
| Bulwark | 450 | 0.65 | Armored siege target; bring HE or magnetic rounds |

Bulwarks ignore APCR, naval secondary bullets, lasers (including the orbital
cutting beam), burning, fuel jets, incendiary and gas. Heat does not slow or
redirect them; gas neither lures them nor spends a charge on contact. HE from
existing cannon, missile, bomber, naval and orbital paths retains its normal
blast/falloff rules. Magnetic rounds deal their existing direct damage. Friendly
immunity is unchanged. Blocked direct hits produce gold sparks and a brief
ARMORED / USE HE OR MAG label, without falsely showing blood or ignition.
Automatic robot guards and bullet/fuel sentries prefer enemies they can damage.

The Bulwark's melee strike has a locked ground point, 1.8-second windup,
2.8-second recovery, 75 damage, 1.4-tile reach, 1.1-tile strike radius and
penetration 3. Moving out of the strike remains a counter. Its broad sealed
carapace, side spikes and label distinguish it from the Breaker's exposed limbs.
The shared enemy navigator now permits this role to ignore heat while still
checking solid obstacles/water, using the same collective search budget.
Waypoint movement carries unused distance forward instead of pausing a tick at
each tile; short collision/contact steps keep the configured pursuit speed real.

A one-time `bulwark-roster-v1` migration replaces one remaining Hunter in each
eligible mortar-bearing seeded compound (Bile bastion / War colony). It backs up
the complete campaign DB first and atomically commits the roster and marker.
It does not transform living enemies, add guards, refill exhausted rosters,
revive conquered sites or alter pending emergence warnings. The v1/v2 seeded
layout generators remain unchanged. Reopen an existing campaign to apply it;
previously exhausted compounds will not suddenly grow new defenders.

The living/pending cap remains 24 across the room. Art and sparks stay on the
client; the server adds a role and occasional blocked-hit timestamp, not
individual armor plates or particles. Earlier density probes are historical
one-room evidence, not a fresh measurement of this enemy mix on Fly.

Validation for this checkpoint: `pnpm check` passed type checking and **471 tests
across 69 files** using an isolated local verification server. Desktop and phone
browser checks passed; both rendered views were inspected. Focused cases cover
real bullet/laser/fuel/HE/magnetic damage paths, orbital beam rejection, hazard
immunity without gas consumption, bounded navigation, measured pursuit speed,
dodgeable heavy strikes, automatic targeting, finite guard emergence and a
complete backed-up campaign migration with restart. The rail-shell arrival test
now uses a stationary target so its damage assertion does not depend on the old
pursuit speed. These changes are local and have not been committed or deployed.


## Mixed local Test frenzy roster, 19 October 2026

The author could not see the newer enemies through the local test event.
Test frenzy now requests eight Hunters, two Breakers and two Bulwarks. It
borrows nearby living ground units within 32 tiles without changing their
identity, health or home. Missing heavy roles get the first available arrival
reservations before filling ordinary Hunter slots. If population capacity is
full, nearby existing units can fill slots instead; terrain/capacity can reduce
or change the mix. No units are killed, healed, transformed or teleported to
force a demonstration. Aquatic enemies and the unimplemented Spitter are not
part of this ground event.

Arrival points persist their role through the warning and campaign checkpoints.
The combat spawn path uses the shared enemy profiles, including full Breaker
and Bulwark HP and their existing attack/immunity rules. Older saved warnings
without a role still produce Hunters. The status shows actual role counts,
including reserved arrivals during warning. This changes only the local test
roster: existing warning/surge/cooldown timing, owner access, production gate,
shared 24-enemy cap and permanent conquest remain unchanged.

Validation: typecheck, focused frenzy/role/AI tests and both desktop/phone
frenzy browser cases. Browser checks confirm all three roles arrive, warnings
show their names and the tracking signal survives reload. Tests also cover
warning restart, limited-capacity priority, survivor preservation and blocked
approaches. Local implementation only; no commit, push or deployment.


## Mobile anti-air follow-up, 19 October

See [Mobile laser enemies](MOBILE_LASER_ENEMIES.md). This replaces two Hunters in
the local mixed Test frenzy with one twin-lens and one heavy-lens creature, keeping
twelve requested members. Aircraft specialists are excluded from ground assault
assignments. Ordinary seeded air-defended compounds can trade one unspent guard
through the backed-up mobile-laser-roster-v1 migration. No new global population.

## Natural encounters — 19 October

`NATURAL_ENCOUNTERS.md` now defines recurring pressure for named campaigns.
Opening rosters remain intact, then living compounds replenish up to six defenders.
One seeded, warned raid per room can reach cleared land or water. This supersedes
the earlier test-only event/finite-only reinforcement scope; ordinary sensing,
armor, navigation budgets and permanent conquest remain in force.

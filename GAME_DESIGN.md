# Frontier game design harness

Version 0.24, 11 October 2026. This is the central guide for deciding what belongs
in the game and what a playable stage must establish. It consolidates agreed
direction; it does not authorize every future feature or implement new rules.

**Combat is the core.** Construction, territory, vehicles and persistence should
give players reasons to fight, tactical choices during fighting, and consequences
worth returning to.

The author approved this staged order on 11 October: environment modifier,
small alien settlement, anti-air facility, then attack jet. The first
[environment modifier](docs/ENVIRONMENT_MODIFIER.md) is implemented locally:
fixed cosmetic alien ground, HE conquest and permanent visual recovery. The
[small settlement](docs/ALIEN_SETTLEMENT.md) now combines a crown, mortar and root
with a saved 0/3 checklist and permanent conquest. The first
[anti-air outpost](docs/ANTI_AIR.md) now adds warned, fixed-prediction flak bursts,
bomber HP and recoverable aircraft loss locally. The attack jet remains next;
use feedback from each playable stage to refine the next.
New armor, economy and planetary-victory rules are not implied.

The author then selected the [air contaminator](docs/AIR_CONTAMINATOR.md) as the
next separate playable addition: a large opaque cloud, surveyed coordinates,
long-range aiming exceptions, HE destruction and permanent clearing. Fog changes
player visibility, not physics or alien sensing. The subsequent
[lance tower](docs/LASER_TOWER.md) adds slow ground tracking, visible charge,
two-second beams, five-second cooldown and permanent HE conquest. Its full-length
beam tracks by angle only, slowly enough for sideways escape in open ground;
hits and solid cover stop the ray. Its first
encounter stays outside contamination fog. Blight hatching remains future work.
Missile batteries and submarines now clamp distant aim to a legal strike
rectangle; minimum-range and capacity rules remain.

The 11 October [defensive-sector stage](docs/DEFENSIVE_SECTORS.md) distinguishes
overview territory shading from combat range. Hits inside hostile territory
produce bounded reports of the attacked position; only intact alert stations
call reinforcements. Tank weapons accept distant aim and stop at their own range.

**Author's direction, 10 October:** combine satisfying heavy military equipment,
meaningful tactical choices and recoverable consequences for unsuitable operation.
Reopen economy design, and explore terrain height affecting shots while retaining
existing movement and overhead 2D presentation. Turret limits and ballistics can
shape tactics; additional visual realism supports readability and impact. See
[economy design](docs/ECONOMY_DESIGN.md) and
[elevation proposal](docs/ELEVATION_DESIGN.md). Economy choices and elevation rules
remain design work, not new runtime behavior.

The author's next combat proposal is a circular-search/focused-tracking alert
station, a detected status extending pursuit, visible burrowing arrivals and
local alien sensing/noise sharing. [Detection and alarms](docs/DETECTION_AND_ALARMS.md)
records the proposed states and medium/target exceptions. The author confirmed
that tracking stops circular search, lost-lock marks fade after a countdown, and
solid obstacles block the tracking beam. Other sensing/noise details remain open.
The first scanner, detected-status and defender investigation stage is now
implemented locally. Noise and neighbor sharing remain future work; tuning needs
playtesting. The linked brief distinguishes this implementation from the roadmap.

## 12 October construction and economy checkpoint

The author approved the complete placement -> recovery -> supplies -> recycler and
rocket shipment -> factory/destructible-facility pipeline. It is implemented locally
in [Construction and logistics](docs/CONSTRUCTION_LOGISTICS.md), with shared balance,
recovery exceptions and provisional tuning in [Economy design](docs/ECONOMY_DESIGN.md).
This supersedes the older globally unrestricted large-infrastructure rule and the
older economy/HP deferrals below. Permanent conquest and ordinary weapon behavior
remain unchanged. Existing equipment is retained, with one initial reserve per save.
There is no offline income or ongoing cost for ordinary firing/robot revival.

The recycler now supports E/WASD driving and parked collection/unloading, with
remote destination commands when empty. Forward airstrips and passenger
transport remain separate work. Review the playable economy before elaborating its
resource types or adding continuous production chains.

The subsequent [bridge-builder stage](docs/BRIDGE_BUILDER.md) adds a drivable
engineering rover and saved, three-tile-wide crossings. Two steel cables connect
3-by-1 bank anchors before the deck unrolls in 1-by-3 sections. Completed bridges
open alternate ground routes and reserve their deck for traffic; ships cannot
pass beneath them. This first stage has straight crossings only, provisional
material costs and no bridge HP. The subsequent
[armored transport](docs/ARMORED_TRANSPORT.md) carries one unoccupied tank, recycler
or builder between docks and remote shore access points. It retains the vehicle's
saved identity, adds a bow turret and reuses naval side guns. Transport loss
destroys its cargo; passenger seats and aircraft carriers remain future stages.

## 13 October construction presentation checkpoint

[Construction and shipyards](docs/CONSTRUCTION_AND_SHIPYARDS.md) records capsule
arrivals and cosmetic assembly drones for logistics equipment, plus explicit
naval deploy/manage/rebuild actions. This first stage is implemented locally and
uses existing server timers, prices and fleet caps. The author confirmed visual
workers first and reusable permanent shipyards separate from retractable shore
ramps. The subsequently approved batch implements paid 12-second shipyard production,
bounded persistent sinking traces and a folding ramp sentry. Existing docks migrate
with backups; prices and limits are provisional and recorded in the stage brief.

## 1. How to use this document

11 October stage: build the [corrosive-mortar outpost](docs/MORTAR_OUTPOST.md)
after the alert station. The [orbital cleanup unit](docs/ORBITAL_CLEANUP.md) is an
author-requested future idea, recorded only; it must preserve permanent conquest.

The status of a statement matters:

- **Agreed:** a direction established with the author; preserve it unless revised.
- **Current:** behavior present in the prototype, including temporary limitations.
- **Proposed:** a recommendation for discussion, not approved implementation scope.
- **Open:** an unresolved decision; do not silently choose a permanent rule.

This file defines game intent and boundaries. [CLAUDE.md](CLAUDE.md) defines how
the agent works and protects that intent. [README.md](README.md) argues what
makes the game good. [PROCESS.md](PROCESS.md) explains development decisions.
[GAME_DESIGN_WORKSHEET.md](GAME_DESIGN_WORKSHEET.md) provides short prompts and
reusable site/enemy/facility cards; its examples and unanswered fields are not
approved mechanics. Start with its four short questions, not every card at once.
[GAME_IDEAS.md](GAME_IDEAS.md) preserves the brainstorm, and `docs/` records
individual stages. Old stage records can describe superseded behavior: for
example, vehicle destruction exists despite older weapon notes calling it future
work. Check the later stage record and code when stating what works today.

When implementation and intent disagree, identify the gap. Neither an old
brainstorm nor an incidental implementation detail automatically settles it.
New decisions should update this document's status and the relevant agent rule,
stage record and checks. Keep detailed balance constants in weapon profiles and
stage documents, rather than maintaining competing copies here.

## 2. Game identity and boundaries

**Agreed direction:** a cooperative planetary war game, playable alone and more
interesting together. Players deploy robot bodies, operate military equipment,
fight hostile aliens, establish positions and eventually secure the planet.
It uses pure overhead 2D presentation and a square construction grid. Units can
move and aim continuously; the grid does not require eight-direction aiming.

The intended audience enjoys powerful weapons, visible impacts and tactical
preparation. The intended session supports one to four players; named rooms enforce
four participants, but sustained four-player battle capacity is not validated.
The course multiplayer requirement still needs
at least two simultaneous people. Evaluate supported capacity with representative
battles on the configured shared CPU and 256 MB server.

| Boundary | Decision and status |
| --- | --- |
| Opponents | Agreed: cooperative players versus computer-controlled aliens. PvP and friendly weapon damage are outside the present direction. |
| Player role | Agreed: directly control one body or facility at a time; switch between fighting, operating and building. Whole-army command is not required. |
| World scope | Agreed target: a large explorable planet with a territory overview and local battles. Current locally: isolated host-owned saves retaining teammates' changes, plus the preserved legacy world. Owner exit saves and closes the room. Exact planet scale remains open. |
| Building | Current locally, 12 October: large infrastructure requires a completed friendly core or factory within construction range. Tanks, sentries, recyclers and rails retain global deployment subject to terrain/footprints/caps. Conquest is not a permission gate. Facility HP and numeric armor now apply to ground claws and acid; friendly fire remains disabled. |
| Forces | Current: ground weapons/vehicles, artillery, missiles, gunship, submarine and first bomber. More force types do not by themselves complete the game. |
| Long-term progress | Current locally: alert station, mortar and environment modifier, with safe additive placement in named campaigns. HE conquest is permanent; red regions disappear and surviving defenders remain. The modifier's ground coating clears. No recapture or regeneration. Settlements and planet victory remain ahead. |
| Entry | Current locally: optional Email/Demo accounts, Caldera planet selector, create/join/resume campaigns, code invitations and orbital core landing. Guests join campaigns; accounts may host. Optional introduction remains later work. |
| Realism | Agreed: convincing weapon motion and feedback. Detailed fluids, real ballistics, full 3D/FPS/TPS production and anatomical gore are not requirements. |
| Hosting | Current configuration: one shared-CPU Fly machine, 256 MB RAM and its persistent volume. On 9 October the author reported that the teaching team can consider a justified RAM increase. No new size or approval is recorded; a personal computer is not an established production dependency. |

## 3. The loops to define first

**Entry direction, 9 October:** optional skippable video -> registration/login
(real email or Demo, with guest entry retained) -> planet selector -> own campaign
or join a friend -> orbital landing selection -> accepted core descent -> robot.
Ordinary email addresses are allowed; no ANU restriction. Start with one reusable
rotating planet card, with blurred terrain and an upper-left scientific-style
name. Before initial core deployment the participant has no ground body; returning
players resume saved presence rather than receiving another free landing.
[ENTRY_AND_CAMPAIGNS.md](docs/ENTRY_AND_CAMPAIGNS.md) records the distinction
between identity, planet template and owned campaign, migration questions and
checks. Accounts, campaign isolation and the one-planet selector are implemented
locally at `/` and `/campaigns/`. The legacy shared guest world is retained at
`/?legacy=1`. Orbital selection -> core descent ->
robot is now implemented. No-core/unseated legacy guests also enter orbit while
retaining identity and owned objects. The painted helipad and its reserved area
are removed; those tiles follow ordinary terrain rules.

**Current testing tool:** a local operator reset backs up and clears that entire
shared test world while the server is stopped. This deliberate test operation is
separate from permanent conquest and ordinary saved return; it is not available
to public guests or executed on Fly in this stage.

**Agreed moment-to-moment loop:** recognise danger -> position and aim -> attack
or control an approach -> read hit/kill feedback -> reassess while weapons reload
and enemies respond. Building and vehicle choice should change these decisions.
Heavy weapons need readable limitations; damage alone should not make every
other weapon irrelevant.

**Current session loop:** enter as an orbital guest, choose a core site, land as
a robot, deploy/operate equipment, optionally start ground or naval encounters,
fight, recover after applicable losses, and return to saved construction and
presence. Existing core owners and occupied vehicles resume their saves. Clearing
a drill is not territory capture. Spore flak now threatens airborne bombers;
disabled pilots recover through friendly cores while their airbase replaces the
lost aircraft.

**Agreed campaign direction, clarified 7 October:** explore a large planet,
identify hostile sites and objectives on the map, deploy combat support where
needed, conquer a site permanently, see its hostile overlay change, and push
farther across the planet. Construction can precede conquest; enemies make
forward deployment risky. Facility loss never reverses completed conquest.
The author suggested red hostile regions becoming blue or losing their red
overlay; the exact visual treatment remains a presentation choice. Landmarks
or missions are candidate ways to give conquest a concrete purpose.

```mermaid
flowchart LR
    A[Explore the planet map] --> B[Choose hostile territory or an objective]
    B --> C[Deploy support and fight the objective]
    C --> D[Save permanent conquest and update the map]
    D --> E[Prepare the next advance]
    E --> A
```

This diagram records the overall direction; the first alert-station loop is now
implemented locally, while full planetary victory remains future work. There
is no automatic return from conquered to hostile: no recapture, regeneration
timer or recurring obligation to hold the same objective. Enemy attacks on
facilities are a separate combat rule. Before implementing it, decide:

1. What exact objective starts and ends a battle?
2. What completes each site's objective: destruction, sabotage, environmental
   conversion, or another visible one-time action?
3. What is gained, what can be lost, and what persists after that encounter?
4. How does an additional player help without becoming mandatory?
5. Can the player safely stop a session, and what happens to an unfinished fight?

**Open:** campaign length, region boundaries/count/size, capture condition,
planet-wide victory condition and post-victory play. A large planet is the goal;
its dimensions and loading strategy need evaluation before becoming promises.

### Territory contract for a first capture stage

**Agreed outcome:** completed sites remain conquered in the shared save and on
the map. Buildings can be placed before or after conquest. Combat remains local
and directly controlled; the overview shows the next meaningful objective and
what has changed. This supersedes the 6 October construction-unlock proposal.
Color should be supported by boundaries, icons or labels so control is readable
without relying on red/blue alone.

**Current first scope:** one capturable alert-station region on the existing
battlefield. Review that fight/conquer/save loop before expanding the map.
This is a small implementation step toward the
large planet, not a replacement of that campaign goal.

The server should validate objective completion and save it exactly once. Return,
restart, facility loss and ordinary enemy movement cannot undo it or repeat its
reward. Global deployment does not bypass rocks, water restrictions, occupied
footprints, runway requirements, ownership or the need to avoid trapping units.
It does not automatically remove existing platform/deployment prerequisites.

**Proposed hostile-area model:** each objective site has a saved identity, type,
position and associated region. That region contributes a red hostile-control
overlay while the site is unconquered. Completion clears its contribution or
marks its region blue. Multiple sites' contributions must be resolved consistently;
neutralising one site must not hide another unconquered objective. Region shape,
overlap and coast/ocean boundaries remain open. Control color is distinct from
current enemy presence: remaining or roaming enemies need their own markers.

| Candidate site family | Candidate completion action | Candidate permanent effect |
| --- | --- | --- |
| Nest | Destroy the nest objective | Stop that site's future spawning; existing enemies do not need to vanish instantly. |
| Hostile facility | Sabotage a specific component or destroy the installation | Remove its local defense or reinforcement function. |
| Environmental landmark | Complete a conversion objective after clearing access | Visually transform the landmark and record human adaptation of that area. |

These are earlier candidate families, not three simultaneous implementation
tasks. The filled worksheet now proposes environment modifiers, corrosive-mortar
outposts, alert stations and cities. **Requested direction:** only alert stations
call reinforcements; guards and sparse patrols are separate. This supersedes the
generic spawning-nest recommendation. First-station rules are now recorded below;
additional site completion and patrol sources remain open. See
[the enemy design discussion](docs/ENEMY_DESIGN_DISCUSSION.md) for the author's
inputs, unresolved conflicts and a proposed small alert-station encounter.
[The first conquest record](docs/CONQUEST_STAGE.md) now records the implemented
alert station: all HE delivery platforms damage it; its destruction permanently
conquers the region, while surviving defenders remain. Calls require nearby
players or recent attacks and have a living-population cap. The author's requested
slightly unpleasant biological style is a procedural first pass: chitin, swollen
purple sacs, twitching roots and a persistent ruin. Economy stays deferred.
The [mortar outpost stage](docs/MORTAR_OUTPOST.md) adds a second saved objective:
a rotating biological launcher with warned acid bombardment, two initial guards
and permanent HE conquest. No repeated reinforcements or facility damage are
introduced. [Orbital cleanup](docs/ORBITAL_CLEANUP.md) is recorded for later.
A shared site record can carry completion state and map feedback while each type
supplies its own objective rule. Detailed terrain simulation is not implied by
environmental conversion.

**Worksheet direction:** the first station now accepts all HE delivery platforms,
while robot weapons fight defenders; the orbital overview may later be a draggable globe; red
area size shows extent, while varying darkness to convey resistance remains future
work. Free equipment deployment supplies solo access in this stage. Keep gameplay
distances independent of screen resolution and camera zoom.

**Open for later stages:** other sites' completion conditions, resource rewards
if an economy is introduced, deployment costs and the final set of objectives
that constitutes conquering the planet. The first station saves partial damage,
defenders and conquest without a currency reward.

**Proposed scaling approach:** store the planet's terrain/control independently
of actively simulated encounters. A large map need not run enemies everywhere
continuously. Any activity scheme must still resolve accepted long-range attacks
and shared outcomes outside the camera; hiding a region cannot cancel a strike
or make players disagree about its ownership. Measure active combat limits before
increasing simultaneous fronts.

## 4. Combat rules and reusable parts

**Agreed weapon identities:**

| Family | Tactical purpose | Rule to preserve |
| --- | --- | --- |
| HE | Resolve an immediate concentration of enemies | Impact damage resolves once. Cosmetic crater size is separate from damage radius. |
| Incendiary | Deny routes for a limited time | Current susceptible monsters die on lethal contact; approaching enemies avoid fire. Fire expires in simulation time. |
| Gas | Draw enemies into a finite trap | Contact kills consume capacity exactly once. At zero the field ends; current gas has no lifetime timer. Fire avoidance wins over attraction. |
| Direct rounds / magnetic shot | Focus damage along a firing line | No inherited HE explosion. Magnetic fire has a charge and fast projectile; APCR is not proof of an implemented armor model. |
| Liquid fuel / laser | Robot and close-defense weapon identity | Fuel has travelling stream segments; the laser traces to its first valid obstruction/target. Surviving burning enemies can flee and later reacquire. |

Warhead behavior and its delivery are separate reusable parts. A cannon,
missile and bomber may share impact resolution while retaining different aiming,
flight, area, reload and ammunition rules. Reuse does not mean every platform
automatically receives all three warheads: the current bomber carries HE only,
and sentries currently offer machine gun or fuel jet.

For each weapon, define: role, eligible targets, range/minimum range, aim and
traverse, charge/reload, cost/ammunition, obstacle interaction, hit rule, persistent
or transient result, feedback, and simultaneous-use budget. State what cancellation
does. Changing ammunition cannot erase an existing reload or rewrite a shot
already accepted by the server.

**Agreed constraints:** desired aim and actual weapon direction can differ;
damage follows the authoritative weapon solution. Friendly players, vehicles
and structures receive no friendly weapon damage. Decorative particles and
craters do not silently become damage, collision or permanent terrain changes.
Lethal hazards can be balanced through coverage, access, timing and capacity;
enemy resistance is a separate design decision, not an automatic workaround.

See [combat concepts](COMBAT_DESIGN.md), [artillery fields](docs/ARTILLERY_FIELDS.md),
[ground weapons](docs/GROUND_WEAPONS.md) and [ship armament](docs/SHIP_ARMAMENT.md).

## 5. Threat, failure, rewards and construction

**Agreed:** combat must threaten players, communicate avoidable danger, and make
hits and kills satisfying. Existing crawlers and swimmers provide a starting
point. Red-skinned aggressive monsters, possible two-headed silhouettes and
purple blood are visual direction, not a completed enemy roster.

Each new enemy needs a role, target priorities, pursuit/attack limits, attack
tell, avoidance opportunity, penetration and damage, response to fire/gas, death
feedback, spawn source/cadence and a share of the active-enemy budget. Increasing
health or enemy count alone is not a new tactical role. Numeric tuning and
multiplayer difficulty scaling remain open.

**Agreed pursuit direction, 9 October:** enemies give up tracking a player who
gets sufficiently far away. Acquisition range, disengagement range, distance
from the home site, and return/patrol/retarget behavior remain open. This is not
the same as deleting the enemy or putting an entire region to sleep. Disengagement
must not imply automatic healing, objective reset or ignored long-range attacks.
The current crawler already uses local target ranges; a common policy for the
future roster still needs implementation and testing.

### Facility durability and penetration

**Agreed, not yet implemented:** facilities have HP and a numeric armor tier.
An enemy attack can damage one only when `penetration >= armor`. Below that
threshold it deals zero damage. Equality permits ordinary attack damage; the
tier is not itself the amount of damage or a percentage reduction. The author's
example is armor 2 versus penetration 2: damage is allowed. This is an example,
not the final sentry stat. This first rule covers enemy attacks on facilities;
do not silently change existing robot/vehicle damage or lethal alien hazards.

The server must still check a valid hostile hit, range/geometry and attack
timing. Friendly immunity remains in force. Persist facility damage and one-time
destruction; reconnecting must not repair it. Give blocked attacks distinct
feedback, so armor protection is understandable. A proposed targeting rule is
to stop enemies repeatedly attacking armor they cannot penetrate and look for
an eligible reachable target instead. Exact targeting priorities are open.

Facility state is independent of site conquest: `operational -> destroyed`
does not make a completed objective hostile again. Before making cores or
airbases destructible, specify occupied-facility handoff, robot/aircraft recovery,
replacement and what happens if every recovery core is lost. Record owner and
seat consequences without duplicating bodies or stranding a save.

### Define roles before a large roster

**Proposed first enemy roles:** a hunter that pressures moving players and a
breaker that can threaten deployed facilities. A ranged disruptor can follow
only if the first two leave an identifiable tactical gap. Their exact armor,
penetration, speed and spawn mix remain untuned. Armor is deliberately binary;
a poorly chosen mix could make the base completely immune or make armor useless.

For each facility, fill in a compact design card: purpose, targets, footprint
and terrain, HP/armor, attack or support behavior, relevant range/reload,
ownership/control, loss/replacement, and active simulation cost. Existing roles
already include sentry defense, core recovery, artillery/missile support and
airbase servicing. Add a new facility when it supplies a missing decision, rather
than requiring a bespoke counter-facility for every monster.

**Current failure:** robot disablement and tank/ship destruction have recovery
paths through friendly cores. A lost vehicle does not create a second living
robot outside it. Core destruction is not implemented; current recovery circles
are not universal invulnerability zones. The aircraft and airbase still lack
enemy damage, so their current safety is a prototype gap, not settled balance.

**Agreed progression goal:** players' positions and facilities should remain
worth returning to. **Open:** resources, build costs, passive-income rate,
offline income, repair costs and rewards for objectives. Passive accumulation
was requested; its accounting is not implemented. Temporary deployment caps
are technical limits, not an economy. Do not add currency merely to prolong play.

**Agreed deferral, 9 October:** reserve economy for a later stage. Keep current
free deployment and technical caps. [ECONOMY_DESIGN.md](docs/ECONOMY_DESIGN.md)
is the placeholder for rules, ownership and server/persistence integration;
it introduces no balances, prices, resource types or income behavior.

**Update, 10 October:** economy design is now reopened at the author's request.
Shared versus personal funds, equipment versus ammunition costs, and income
sources are being decided. Deployment remains free until the first economy stage
is agreed and implemented; prior deferral no longer prevents design discussion.

Before adding destructible cores, define recovery when all cores are lost.
The author's earlier orbital-redeployment idea is a candidate, not an implemented
fallback. Do not introduce an unrecoverable save or silently grant free cores.

## 6. State machines: separate the things that can change

Use several small state machines instead of a single enormous game state.
Being disconnected, piloting a vehicle and having low health are different facts.
The table uses conceptual labels; where noted, implementation uses timers or
independent fields rather than a matching enum.

| System | Current states/transitions | Important boundary |
| --- | --- | --- |
| Robot life | `active -> disabled -> arriving -> active`; blocked arrival returns to disabled | Disabled bodies cannot fight/build. Recovery chooses a completed friendly core and revalidates landing. Health/life survive restart. |
| Control | On foot <-> facility operator; on foot <-> vehicle pilot | One operator per facility/seat. A facility may leave a guarding robot; an embarked robot has no extra outside body. Ownership is distinct from occupation. |
| Ground encounter | `ready -> active -> cleared/failed`; another accepted drill restarts it | Named campaigns checkpoint combat; the legacy world remains transient. Drills do not represent campaign victory or saved capture. |
| Tank/ship life | Incoming -> operational -> destroyed -> replacement incoming | Deployment and replacement use timers. Loss, occupant removal and pilot disablement must agree and save together. |
| Submarine depth | Surfaced -> diving -> submerged -> surfacing | Depth is separate from hull/seat state; underwater weapons and exits have restrictions. |
| Aircraft flight | Parked -> takeoff -> flying -> landing -> parked | Rearming and bomb release have separate timers. Positive-speed flight differs from ground movement; no reverse or hover. |
| Weapon action | Ready -> charge/accepted shot -> reload -> ready, as applicable | Validate capacity and access before spending ammunition; retain accepted trajectory and damage outcome across viewers. |
| Hostile site | Current locally: one alert station, hostile -> permanently conquered | One-way saved completion, partial damage and defenders. No regeneration/recapture timer and no build-permission gate. |
| Facility durability | Planned: operational -> destroyed; replacement policy open | HP/armor and damage are server-owned. Loss does not undo conquest; occupied facilities and all-core loss need recovery rules. |

For every transition, specify its trigger, server preconditions, state changes,
resource changes, save point, visible feedback and rejection result. Also specify
what a repeated request, disconnect or restart does. A rejected action should
leave the player able to understand and correct it.

## 7. Shared world, authority and persistence

**Current:** the server owns movement/collision, ownership, control, hits, deaths,
reloads and hazard accounting. Clients send intent and render feedback. Rendering
distance and camera zoom do not decide whether a distant hit is valid.

Save construction and critical accepted transitions before confirmation. Moving
poses use half-second checkpoints; a crash may lose motion since the last one.
The world and durable vehicle/player consequences survive restart/redeploy.
Named campaigns also checkpoint enemies, in-flight attacks and active hazards;
legacy-world combat and cosmetic traces remain transient. Host-owned campaign
isolation is implemented locally. Optional accounts now link the same player
ID and support password recovery; unlinked guests remain browser-bound. Real
SMTP delivery is implemented and tested with local capture, but receipt through
Brevo remains unverified.

**Current account layer, 9 October:** explicit real-email and Demo registration/
login, verification, recovery and a private simulated inbox, with guest entry
retained. [ACCOUNT_DESIGN.md](docs/ACCOUNT_DESIGN.md) records architecture and
checks. The stated implementation defaults preserve guest progress at activation,
rotate the old guest credential, and ask for explicit takeover before replacing
another session. A different guest is never silently merged during login. These
defaults remain revisable by the author. Campaign creation is a separate explicit
action at `/campaigns/`, not an automatic effect of registering.

An empty world pauses simulation. An individual disconnect does not imply the
world is empty: vehicles can remain vulnerable with another viewer present;
an airborne bomber continues its current flight with boundary guidance. Facility
control is released, held input expires, and saved vehicle seats follow their
existing reconnect rules. Define any change to these policies explicitly.

Finite enemy, projectile, hazard and build budgets are part of every stage.
Use client-side effects rather than a server entity per spark. One successful
small battle is not evidence for four sustained combined-forces players.
The current Canvas/Node implementation is an architectural choice, not a ban on
future game engines; any migration must preserve shared rules and saves.

### Large-planet resource budget

**Hosting clarification, 9 October:** 256 MB is the current measured baseline,
not an absolute design ceiling based on the author's latest teaching-team
guidance. A higher allowance may be requested with reasonable evidence. Until a
specific change is agreed, keep the deployed configuration unchanged. A request
should identify the desired battle, reproduce the measured bottleneck, record
optimizations attempted, and propose a justified size with headroom. Increasing
RAM does not establish additional CPU or network capacity. Earlier fixed-limit
wording in stage records describes the constraints used for those measurements.

**Assessment:** this design is plausible with bounded active combat, but the
complete planet and enemy/facility roster have not been validated on Fly. Armor
comparisons and saved completion flags are simple operations; enemy routing,
target searches, simultaneous fronts, projectiles and snapshot traffic are the
likely scaling risks. Map storage and visible area are not measures of combat
capacity, and the process needs memory headroom for temporary work and the OS.

**Proposed rules for the first scaled test:**

- Store terrain and completed sites independently of live encounters; load the
  required world regions without constructing a live enemy population planet-wide.
- Use a shared world budget plus per-encounter limits. Enemy type count, spawn
  cadence and maximum living population are separate settings. At capacity,
  delay spawning without accumulating an unlimited catch-up queue.
- A dormant remote facility does not constantly scan every enemy on the planet.
  Facilities under attack, active players and accepted long-range strikes must
  participate in an authoritative encounter even outside anyone's camera.
- Permanent conquest stops the conquered source's contribution; do not resurrect
  it when reloading a region. Sleep/resume rules for unfinished fights must not
  silently heal objectives, duplicate spawns or erase accepted damage.
- Bound route searches and reuse suitable results; send relevant state changes
  rather than broadcasting a growing planet's complete data on every tick.
  This is a proposed optimization, not a description of the current transport.
- Measure peak memory, tick duration, CPU, snapshot size/update delay and saved
  return during sustained mixed combat with players on separate fronts. Test
  simultaneous target searches and facility destruction, not only empty terrain.

Existing [missile checks](docs/MISSILE_LAUNCHER_DESIGN.md) include a short isolated
256 MiB container workload that peaked at 31.0 MiB; the separate
[naval check](docs/VEHICLE_COMBAT.md) recorded 130.4 MiB process RSS with server
and test clients in one Windows process. These are different small workloads
and measurement scopes, not interchangeable capacity estimates. Neither proves
a populated large planet. Set initial caps after the first representative test;
do not promise a particular enemy count from these figures.

## 8. Art, sound and control language

**Agreed presentation:** overhead square terrain; consistent unit scale, palette
and silhouettes; independent hulls/turrets where needed. Shadows, smoke, trails
and timed impact cues imply height without changing to isometric projection.
See [ART_WORKFLOW.md](ART_WORKFLOW.md) for asset selection and provenance.

Readable combat takes priority over effect density. Players should distinguish
enemy attack warnings, their desired aim, actual weapon bearing, damage areas,
friendly structures and reload states. Use shape, motion and labels as well as
color. Show fire and gas throughout their active lifetime, not merely during
the explosion. Reduced effects must preserve gameplay information.

Fuel should read as an ejected liquid stream; lasers as clear lines; HE as a
short impact followed by debris and a cosmetic trace. Red lasers and hot
red/orange/gold fragments are established direction. Exact monster sprites,
surface textures and audio remain polish work. Sound should communicate firing,
impact, threat, death and readiness; it must not be the sole source of a warning.
Keep source/license records for selected assets, including audio.

Maintain a fullscreen battlefield with contextual controls. Vehicle-specific
movement is intentional: WASD world movement for robots, steering/throttle for
ships, and positive-speed flight for bombers. A common control layout does not
mean identical movement physics. Desktop, touch and keyboard alternatives must
make the currently available actions clear.

## 9. Gate for the next playable stage

**Implemented locally after accounts:** campaign ownership, membership, isolation,
code invitations, lifecycle, the one-planet entry interface and one alert-station
conquest encounter. Review that fight and art before adding another site. See
[CAMPAIGN_STAGE.md](docs/CAMPAIGN_STAGE.md) for the staged plan, acceptance checks
and the review of the author's filled answers. The requested direction includes
code/email invitations, no public room directory, solo-only pause and shared use
of unoccupied equipment. Follow-up decisions require owner-present rooms: owner
exit saves and returns everyone to the lobby. Email/Demo accounts may host;
unregistered guests may only join. Invited accounts retain membership for future
room sessions. Departing guests' contributions persist, and the host may manage
their buildings. Owner disconnect freezes the room for a 30-second reconnect
grace period; solo pause resumes with a warning when another player joins. The
stage record specifies guest visit expiry and combat checkpoint durability.
Review recommendations are not accepted decisions.
Preserve the legacy shared save and account identities during any migration.

**Current combat review:** the alert station now has a circular pulse, focused
tracking, fading marks and defender investigation, alongside bounded calls and
permanent completion. Playtest the encounter using
[DETECTION_AND_ALARMS.md](docs/DETECTION_AND_ALARMS.md) before adding ordinary
alien sharing/noise. The next structure, the corrosive-mortar outpost, is now
implemented locally under its linked stage brief. A later facility/enemy pair can exercise HP and
the agreed armor rule. The new request for mitigated
damage across robots, vehicles and facilities differs from the earlier binary
facility threshold; resolve this before implementing that damage stage. The
request for fearless aggression also needs reconciliation with existing fire
avoidance and burning panic. Enemy/art recommendations are recorded in
[ENEMY_DESIGN_DISCUSSION.md](docs/ENEMY_DESIGN_DISCUSSION.md), with numbers open.
Optional accounts are implemented locally; real-mail receipt remains unverified.
Campaign work can proceed while these combat choices are discussed.
Verify global placement, facility loss, shared map changes and saved return, then
measure their combined resource cost before growing the planet or roster.
If aircraft participate, settle their threat and failure loop before
treating them as a balanced option. This is a proposed sequence, not an instruction
to implement all of it in one update.

Write a short stage brief before coding:

1. **Player story:** what the player tries to do, and why it matters.
2. **Scope:** one playable result, the existing systems reused, and what waits.
3. **Rules:** start, success, failure/recovery, rewards/costs and affected states.
4. **Shared consequences:** authority, conflicts, disconnect and save behavior.
5. **Feedback:** how players see/hear each important outcome with placeholder art.
6. **Budget and checks:** bounded workload, relevant automated checks, two-browser
   agreement, saved return, desktop/phone review and the author's playtest question.

Accept, revise or reject that stage from observable play. Automated checks can
prove rules and persistence; human review must judge whether danger is fair,
weapons feel powerful and cooperation creates useful choices. Refine visuals
after the mechanic is legible enough to evaluate, rather than adding the whole
future roster before establishing the campaign loop.

# Frontier game design harness

## 2 November 2026: walk-up colony bed inspection

The author wants relaxed inspection by walking onto or near a growing bed.
The [nearby inspection stage](docs/COLONY_NEARBY_INSPECTION.md) opens the existing
plant/seed panel automatically, follows the local worker between beds and closes
on departure. Explicit tools/manual inspection keep priority; Esc/X dismissal
lasts until leaving and returning. Phone direction controls remain usable.
Tending actions are still deliberate. Industry, charging, fishing, ponds,
cabins and the colony commissioning goal remain planned.

## 2 November 2026: colony atmosphere and cinema implementation

The author approves the first visual stage for playtesting. The
[atmosphere/camp/cinema stage](docs/COLONY_ANIMATION_AND_MEDIA.md) adds shared
24-minute daylight and seeded six-minute weather slots, host-only visual presets,
up to four free campfires and one free cinema, improved irrigation effects and
on-demand Big Buck Bunny playback. Camp placement protects workers and essential
routes. Weather is visual-only; it does not water crops or change production.
Movie position follows the shared active clock, while sound is personal. Reduced
effects retain smooth movement. Industry, fishing and cabins remain later stages.
Local validation passed: 41 focused tests, TypeScript and nine integrated browser
checks including desktop/phone controls, shared cinema, host reconnect and the
existing gardening loop. Local visual/performance evidence is in the stage
record; no real saves were reset and this stage has not been deployed.

## 2 November 2026: colony animation and supplied movie

The author requests animated irrigation, fire, rain and related effects, and
supplies Big Buck Bunny from Blender's official download directory. The
[animation/media record](docs/COLONY_ANIMATION_AND_MEDIA.md) distinguishes the
existing rotating sprinkler and droplets from planned effects. The local
320-by-180 film passed Chrome playback/seek checks; provenance and credits are
recorded. The source is prepared, but bonfires, weather and cinema remain planned.

## 2 November 2026: proposed life at the colony

The author adds fishing, a buildable pond or lake editing, a bonfire, a wooden
cabin, an outdoor movie screen and shared sunrise/sunset/weather to the industry
discussion. The [settlement-life proposal](docs/COLONY_INDUSTRY_PROPOSAL.md#life-at-the-settlement)
keeps these voluntary and supports continued play after network commissioning.
Natural-water fishing and a bounded pond precede freeform terrain changes;
day/weather use saved active time. The author's follow-up confirms that guests
adopt the host expedition's current server state on join/reconnect; there are
no independent guest weather histories. Film candidates and license requirements are
recorded with official sources. This records design intent; no fishing, weather,
decorations or movie playback were implemented in this discussion.

## 2 November 2026: proposed colony industry and completion

The author asks how conveyors, food processing, bio-power and worker charging
could add mild pressure and lasting purpose. The
[industry proposal](docs/COLONY_INDUSTRY_PROPOSAL.md) recommends a compact
production chain and a finite human-network commissioning goal, followed by
optional continued building. Recoverable production failures and optional rush
orders provide tension. This is a design proposal; only the existing growing,
sprinkler, harvest and raw-sample exchange loop is implemented.

## 2 November 2026: four compact tracks for the colony worker

After reviewing the walking animation, the author chooses four compact tracks
with rolling belts and light suspension. The worker now has four separate dark
belts, exposed rollers and white guards, retaining its four arms, cyan visor and
white/violet upper body. Treads follow rendered travel; suspension settles when
stopped and cosmetic motion respects Reduce animation. This replaces the feet
from the first art pass without changing movement rules or saved positions.
See the [tracked-worker follow-up](docs/COLONY_MOVEMENT_AND_PERFORMANCE.md#tracked-worker-follow-up).

## 2 November 2026: colony controls and movement polish

The author reports jerky worker movement and requests Esc for the expedition
menu. The [movement/performance fix](docs/COLONY_MOVEMENT_AND_PERFORMANCE.md)
keeps worker and camera motion smooth between sparse server updates, including
with reduced cosmetic animation. Esc closes the current panel/placement first,
then opens the existing Crew menu. This stage first improved the four-foot
walking cycle, before the author's tracked redesign above. Fixed machinery is cached and
offscreen objects are skipped. These are local presentation/input changes;
movement authority, farming rules, saves and the combat branch remain unchanged.

## 1 November 2026: HUD and polish stage

The author approved a HUD readable in one second, in the spirit of Dead Space:
information on the unit and world, not in corner panels. A folded mission bar and
one menu replace the Operations panel and top bar. Cannons open near their targets
instead of on the whole planet. Deploy becomes a small shelf where left-click drops
with ORB and right-click builds with GND. The interface moves to graphite and gold,
and Caldera becomes the blue world of the author's concept art. Presentation and
input only; saves and rules are unchanged. See
[HUD and polish](docs/HUD_AND_POLISH_STAGE.md).

## 1 November 2026: separate peaceful colonization mode

The author places agriculture in a later expedition, separate from the combat
campaign. Another ship, operated by preserved human heads with AI assistance,
arrives after conquest to cultivate and adapt the planet and connect it to human
society. [Colonization mode](docs/COLONIZATION_MODE_DESIGN.md) records the confirmed
premise and proposed farming, automation, orbital exchange and settlement loop.
The earlier suggestion of gardens during active fighting is superseded.
The author then approved implementation with a warm, cute presentation. The
[first playable stage](docs/COLONIZATION_STAGE.md) adds standalone New Game
entry, separate peaceful saves, three crops, watering, sprinklers and orbital
sample deliveries. Its compact surveyed district uses the chosen planet's
palette; it is not a clone of a military map. Combat saves remain intact.
Automation, wider settlement development and an optional post-campaign handoff
remain future stages. Local implementation and checks do not establish deployment.

### Colony visual direction after the first review

The author likes the peaceful environment and wants the machines and player to
remain part of Frontier's human civilization. The [visual direction](docs/COLONIZATION_VISUAL_DIRECTION.md)
records a dedicated Colonization entry between Continue and Join, separate save
browsing, three new colony destinations, and MYCORRHIZAL's shuttle arrival.
The author then supplied an agricultural robot sheet and requested a first
visual pass. The [agricultural art pass](docs/COLONIZATION_ART_PASS.md) implements
the 55-degree view, a directional four-arm/four-leg worker, white metallic
facilities and a compact illustrated interface. Existing save coordinates,
quotas and rules remain intact. The later [HUD and planets stage](docs/COLONIZATION_HUD_AND_PLANETS.md)
groups the controls into a translucent header and contextual bottom dock, adds
the separate Colonization menu/save branch, and implements Morrow, Nacre and
Aurelia in the opening scene and playable districts. Old colony saves remain
accessible and unchanged. The [carrier arrival stage](docs/COLONY_CARRIER_ARRIVAL.md)
adds MYCORRHIZAL hovering over the selected colony world in New and Continue.
Its shuttle detaches only after admission, banks through the atmosphere with
wind ribbons, and fades into the garden; combat keeps its drop pod.
The author's [white-and-gold revision](docs/COLONY_WHITE_GOLD_VOYAGE.md) uses the
middle overhead ship view with two bow shuttles, smooth steered travel between
planets and golden sunlight through thin haze in dark space. The subsequent
[lensing revision](docs/COLONY_LENSING_TRANSITION.md) keeps three civilian
destinations, starts New/Continue on Morrow, and groups legacy peaceful saves
without altering them. Branch changes use a contracting distortion rim over a
full-size planet, with persistent stars: gold into Colonization and blue back
through War Zone.
The author's next refinement extends the worker's mechanical detail to facility
roofs and camera-facing sides, retaining their fixed orientation and footprints.

## 1 November 2026: Sirocco desert planet

The author approved the third playable world with distinct firm desert and
navigable sand seas. [Sirocco](docs/SIROCCO_PLANET.md) adds four starting plateaus,
defended oases, cosmetic dunes, alien palms, impassable mesas and a heavy-bridge
strait. Ships skim the loose sand, sandports retain dock rules, and submarines
burrow using the existing depth/endurance controls. The shared enemy AI, pressure
budgets and permanent ending apply. Only new Sirocco campaigns use this generator;
existing planets and saved construction are unchanged. This is a local stage,
not a deployment or hosted-capacity claim.

## 31 October 2026: first siege centipede

The author approved a first playable giant before wider balance refinement.
The [siege centipede](docs/BROOD_CENTIPEDE.md) is a slow eight-part ground enemy
with one hittable body/HP pool, facility priority and existing heavy protection.
Only living Blight Roots produce it, with warned arrivals, limited replacements
and bounded land-unit offspring sharing island/global budgets. Destroying its
Root stops production but leaves survivors to fight. Protected starting cores
and final conquest remain intact. Universal armor/penetration changes and
burrowing are not part of this local stage.

## 31 October 2026: mobile AA and first flying enemy

The new tracked AA fires twin 35 mm guns with LMB and the tank machine gun with
RMB while moving. Cursor aim stays free; a separate turret solution can lead a
nearby flyer. Parked, unoccupied AAs prioritize air defense. The skimmer attacks
robots and ground vehicles with a warned strike, never actual facilities, ships
or friendly aircraft. Air and ground hits have explicit eligibility, and the
robot laser remains a fallback. City production shares the existing island and
global budgets, with four skimmers at most including pending and sleeping units.
The [mobile AA stage](docs/MOBILE_AA_AND_SKIMMER.md) records implementation,
controls and verification. This supersedes the earlier anchored AA proposal.
The author's follow-up now adds continuous held fire with alternating barrels,
one 20-damage round per 125 ms, and short sequential tracer flashes. The nominal
damage rate is unchanged; decorative flashes create no extra damaging bullets.
The skimmer's art now follows the author's manta sketch: two broad wings, thin
tentacle tails, three bloodshot eyes and three veined bile sacs in red, yellow
and purple. Its three cosmetic droplets converge on the existing single warned
ground impact. The author's next revision adds a stationary twin-35 mm AA sentry
with strictly airborne targets, no ground fallback. It costs 80 ORB / 20 GND,
has 140 HP and covers 26 tiles. The [sentry and co-op stage](docs/AA_SENTRY_AND_COOP.md)
records its validation and the scope of the multiplayer rehearsal. No air-to-air
combat or aerial attacks on facilities are added.

## 30 October 2026: shared island pressure and sparse roaming

Hostile compounds now share a bounded replenishment allowance per occupied
island, scaled once by `1 + 0.7 × (eligible players − 1)`. Destroying nearby
facilities reduces production. Cleared land receives occasional warned hunter
groups from a surviving same-island source; enemies investigate a fixed location
and use ordinary perception. All arrival paths share the existing 24 active plus
reserved cap, and final planetary conquest stops every new arrival. Saved worlds
keep their geometry and progress. Numbers, capacity limits and local evidence are
in the [island pressure stage](docs/ISLAND_PRESSURE_STAGE.md).

## 30 October 2026: save management and floating lobby feedback

Continue lets an owner delete a closed save after confirming its name, freeing
one of the three owned slots. Active rooms must be saved and left first; joined
worlds cannot be deleted by members. Private files remain recovery archives,
with no player restore command. Lobby notices float without a box or layout
space. Details are in [campaign save management](docs/CAMPAIGN_STAGE.md) and
[entry presentation](docs/ENTRY_VISUAL_DESIGN.md).

## 30 October 2026: four footholds and denser new campaigns

New Caldera and Vesper campaigns now offer four shared starting clearings. Players
can preview a clearing in orbital core placement or find it in Planet overview,
then explicitly confirm their own landing. Nearby custom placement stays legal;
the clearings are not exclusive player slots or permanently safe territory.
New hostile compounds fill more of the remaining usable land, with separated
production/defense clusters and open routes around structures. Water, mountain
chains and saved worlds keep their geometry. This layout is saved once for new
campaigns; existing campaigns are not rebuilt. The shared active-enemy cap and
spawn cadence remain unchanged. Details and checks are recorded in the
[enemy design plan](docs/ENEMY_DESIGN_DISCUSSION.md).

## 30 October 2026: sustained hostile resistance and survivor cleanup

The author wants strong player-focused resistance in alien cities, sustained
production from surviving hostile facilities, and sparse roaming pressure on
cleared ground while the planet remains contested. Nearby friendly facilities
have weaker attraction; defeat stays recoverable and heavier equipment should
make assaults more effective. Once all hostile facilities are destroyed, stop
new enemy spawns and leave existing survivors to clear. Permanent conquest stays
intact. The [enemy design direction](docs/ENEMY_DESIGN_DISCUSSION.md) records a
behavior, pressure and city-layout sequence, with the shared population budget
and approved island multiplayer scaling. The first behavior/ending stage is now
implemented locally: seeded patrols, visibility-based pursuit and investigation,
player-focused priorities with limited local siege, and the planetary spawn gate.
A gold striped CONQUERED ribbon marks the permanent result and counts surviving
enemies until all threats are cleared. New pressure rates, sparse roaming arrivals
and denser city layouts remain later stages; this checkpoint is not a deployment.

## 29 October 2026: assessment and gameplay planning

The author confirmed COMP8020 and island pressure scaling of
`1 + 0.7 * (connected players - 1)` (solo remains 1x). The
[readiness and gameplay plan](docs/FINAL_PROJECT_READINESS_AND_GAMEPLAY_PLAN.md)
records multiplayer validation, entry-page clarity, patrol/perception and island
pressure, then a paired flying-enemy/AA-vehicle stage. Giant encounters, crate and
orbital-shell presentation, and another planet remain later proposals. This
planning checkpoint does not implement those mechanics or authorize a release.

Version 0.25, 14 October 2026. This is the central guide for deciding what belongs
in the game and what a playable stage must establish. It consolidates agreed
direction; it does not authorize every future feature or implement new rules.

**Combat is the core of the combat mode.** Its construction, territory, vehicles
and persistence should give players reasons to fight, tactical choices during
fighting, and consequences worth returning to. The separate colonization mode
has peaceful cultivation and settlement goals, described above.

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
with backups; prices and limits are provisional and recorded in the stage brief. The subsequent dock-first refinement replaces the two naval selectors with one
shipyard panel (E on an owned dock), one vessel per dock and paid automatic hull
repair. Different docks may build the same type; the four-active-ship campaign cap
remains. See the stage record for rates, cooldowns and durability checks.

## 14 October bomber and support-network direction

[Bomber and support network](docs/BOMBER_AND_SUPPORT_NETWORK.md) records the
author's next design: automatic marked-area bombing with the existing aircraft,
HP-based paid aircraft repairs, global orbital delivery, cheaper/slower local
construction, core salvage receivers and a small energy/support outpost. It also
records wreck recovery and recycling without duplicate rewards. These are design
changes, not implemented behavior. Confirmed: one free bomber delivered to an
existing airbase per campaign; the 2-by-2 support outpost also allows robot respawn.
The author requests cheaper local recycling and reusable cargo rockets with a
provisional two-minute shipment cycle and return animation. The author confirmed
separate campaign-shared ground supplies for local construction/repair and orbital
supplies for orbital deliveries. Initial balances, passive income and save migration
remain open; preserve existing recovery paths. The proposed
first playable slice is an automatic HE sortie, reusing real flight and anti-air.

## 14 October shared economy implementation

25 October update: both campaign pools now refill while the map runs, with
thresholds based on distinct connected players. Solo: 250 ORB / 50 GND;
multiplayer: `250 × players − 100` ORB / `50 × players − 15` GND. Rates are
2 ORB/s and 0.4 GND/s; joining grants no immediate supplies and leaving never
deducts an earned balance. See [Shared passive reserves](docs/SUPPORT_NETWORK_STAGE.md#25-october-shared-passive-reserves).

The author prioritized economy and support before bomber automation, confirmed
that all cores and teammates share one ground pool and a separate orbital pool,
and requested orbital unfolding plus a one-tile local drone store. The local
implementation is recorded in [Support network stage](docs/SUPPORT_NETWORK_STAGE.md).
Existing SUP becomes orbital SUP with no duplicate ground grant. Core/outpost
processing earns ground SUP; rocket shipments earn orbital SUP. Outposts also
provide shared respawn and local construction. Local orders cost 25% and take
60 seconds; orbital placement is global subject to normal site rules. Power
simulation and the automatic bomber remain separate future work.

## 1. How to use this document

19 October tank handling: the author approved the first semi-realistic vehicle
slice. Tanks now accelerate/brake, turn their hull gradually and reverse more
slowly while preserving world-direction controls and independent turret aiming.
HE/Magnetic firing adds cosmetic barrel/hull recoil. See the latest section of
[Ground weapons](docs/GROUND_WEAPONS.md) for tuning, safe-stop behavior and the
validation scope. Ships, aircraft and terrain-height changes remain
separate stages; this local implementation has not been deployed or load-tested.

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
| World scope | Agreed target: a large explorable planet with a territory overview and local battles. Current locally: isolated host-owned saves retaining teammates' changes, plus the preserved legacy world. Owner exit saves and closes the room. The first expanded field is 512 by 384 with a rotatable campaign globe; ground travel retains closed rectangular boundaries. See docs/PLANET_EXPANSION.md. |
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
implemented locally. The 30 October stage adds planetary victory and stops new
spawns after all required hostile facilities are destroyed. There
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

### Automatic HE bomber checkpoint (14 October)

See [Automatic bomber missions](docs/AUTOMATIC_BOMBER.md): H opens shared air
support; one existing bomber flies one HE carpet run and returns. Caller control
remains with their current unit. Abort/base-loss recovery, saved mission identity
and accepted projectile persistence are part of this local stage.

### Bomber payload checkpoint (16 October)

The same bomber now offers HE carpet, one heavy HE bomb, incendiary carpet and
gas carpet. Heavy HE uses both bay charges; each carpet uses one. The automatic
approach includes a visual dive and pull-out; collision, speed and flak rules stay
2D. Manual LMB drops also support the four payloads. Fire/gas reuse bounded hazard
fields, and the larger heavy-bomb crater is artwork rather than extra damage area.
The author excluded bomber strafing. Carrier operations remain future work.

### Shared airfields and cruise checkpoint (16 October)

See [Shared airfields and cruise](docs/AIR_TRAFFIC.md). Beside a parked aircraft,
Launch to cruise starts a saved unmanned patrol; E still boards. Air support
assigns bomber strikes from cruise and recalls to a chosen free friendly runway.
Aircraft in flight retain fleet capacity; empty bases enable cross-map transport.
This is the shared landing foundation for carriers, which remain future work.

### Aircraft carrier checkpoint (17 October)

See [Aircraft carrier](docs/AIRCRAFT_CARRIER.md). One movable deck reuses shared
airfields, cruise, bomber orders and visitor landing. Stop to launch or recover;
return reservations prevent sailing away beneath an incoming aircraft. A compact
3 x 5 hull carries defensive side guns and a 120 GND store for paid hull and
aircraft repairs, refilled at docks. Shipyard assembly costs 100 GND / 60 seconds.
Carrier loss preserves airborne aircraft identities and attempts diversion; deck
aircraft are lost. This locally implemented stage supersedes the earlier carrier
deferral. More deck slots, dimensions and balance remain playtest decisions.

### Orbital weapons checkpoint (17 October)

The approved [orbital roster](docs/ORBITAL_STRIKES.md) proceeds through walking
HE, an incendiary curtain, gas seeding and an optional cutting beam. Only walking
HE is implemented in this stage. V or Deploy > Strike > S-02 opens its planner.
A global committed target, travel delay, shared ORB payment and shared recovery
time distinguish orbital intervention from repeated local artillery. Five rows
advance along a selected direction; every teammate sees the call and countdown.
Named campaigns preserve impact progress and permanent conquest across restart.
Balance and visuals need playtesting before the next payload.

### Completed orbital roster checkpoint (17 October)

The next authorized stage adds incendiary curtain, gas seeding and cutting beam
to the same V planner, superseding the HE-only checkpoint above. Fire divides
ground approaches; gas attracts enemies and spends a shared finite kill budget;
the beam sweeps a chosen line and damages hostile structures at its moving
contact. Fire/gas footprints must stay on land. All four share ORB spending and
recovery, with committed targets and progress preserved through saves. See the
[orbital stage brief](docs/ORBITAL_STRIKES.md) for provisional prices, limits and
validation. Review this small roster before expanding maps and refining AI.

### Land AI and campaign variation proposal (18 October)

The author's next direction is more committed ground pursuit, different seeded
facility combinations per campaign, then additional enemy roles. See
[Land pursuit and seeded hostile fronts](docs/LAND_AI_AND_SEEDED_FRONTS.md) for
current-code findings, the proposed three-stage order and acceptance checks.
The dated checkpoints below record which parts of that proposal are implemented.
Preserve permanent conquest, shared campaign state and bounded simulation work.

The follow-up accepts ordinary pursuit and proposes a temporary frenzy layer:
most event enemies hunt players while a smaller assigned group raids facilities,
without ordinary distance leashes. The same brief records proposed shared quotas,
global route eligibility, a telegraphed targeting signal and recoverable defeat.
These event details remain design proposals; neither campaign erasure nor a
change to existing emergency recovery is authorized.

The approved pipeline now has its first local playable checkpoint: stronger
ordinary pursuit and an owner-triggered local frenzy test. The brief above
records ten/fourteen-tile awareness, last-position memory, shared bounded enemy
navigation, finite warned arrivals, player/facility assignment, saved event
timers and recovery cooldown. Existing campaign progress and recovery remain.
The author accepted this checkpoint in playtesting. The manual test trigger
remains disabled on Fly/production.

The 19 October local checkpoint adds saved, campaign-seeded compounds in Aurora,
Haven and Meridian, preserving the original region and existing progress. Up to
seven spaced compounds reuse two/three-structure objectives with explicit saved
membership; completed objectives never regenerate. A backed-up transaction saves
the layout/seed/version once, and unsafe occupied slots are skipped. Planet
overview provides a compound selector and permanent completion counts.

Each compound has two Hunters and one new Breaker in a finite initial roster,
under the same 24-enemy cap. Breakers have 180 HP, slower movement, a 1.4-second
locked strike warning and facility penetration 3. They favor damageable vehicles
and infrastructure; fire/gas remain lethal. Plated artwork adds no new global
armor formula. See the linked brief for provisional numbers and validation.
Spitters, natural frenzy triggers and coarse region navigation remain later
stages after reviewing these encounters.

The subsequent density refinement targets 6 Aurora, 6 Haven and 12 Meridian
compounds instead of 2/2/3, spread across larger continental areas. A separate
backed-up v2 migration adds safe sites to existing saves without relocating old
ones; conquered groups count toward the target. Central landing space and the
shared 24-living-enemy cap remain. Busy/obstructed areas can yield fewer clusters.

### Enemy role refinement, 19 October 2026

Hunters now pursue at 2.6 tiles/s (robot: 3.0). The existing slow Breaker remains
180 HP at 0.95 tiles/s. The new Bulwark has 450 HP and moves at 0.65 tiles/s;
the author explicitly approved HE/explosives plus magnetic rounds as its only
weapon counters. Bullet weapons, all lasers, fuel, fire and gas cannot hurt it.
This exception does not change ordinary enemy hazard vulnerability or friendly
immunity. Its heavy melee attack is telegraphed and dodgeable. Eligible seeded
mortar compounds trade one finite, unspent Hunter guard for a Bulwark; no cap
increase, conquest rollback or guard refill. Details and migration boundaries:
`docs/LAND_AI_AND_SEEDED_FRONTS.md`.

## 19 October helicopter support stage

[Helicopter and helipad](docs/HELICOPTER.md) adds sustained small-HE support
through a dedicated 3 x 3 pad and a slower hovering aircraft. LMB fires its cannon;
RMB sweeps finite rocket pods for up to five seconds, following changing aim.
The stage reuses the shared economy, damage, repairs, remote orders and saves;
helicopter capacity remains separate from the runway fleet. Values need playtesting.

## 19 October mobile anti-air stage

[Mobile laser enemies](docs/MOBILE_LASER_ENEMIES.md) adds a twin-lens hunter and
heavy single-lens creature. Both stop and brace before telegraphed aircraft-only
beams; bounded angle tracking rewards lateral evasion. Ground weapons counter
them. Finite seeded guards and local Test frenzy share the existing population
cap, with at most four lens creatures alive. Their full combat state persists.

## 19 October parked tank defence

The subsequent fleet decision removes the old per-player and campaign tank caps:
players may fund multiple tanks and park them as cannon defenders. Each still
costs supplies and needs a legal deployment site. L → Field equipment selects
individual tanks for location and replacement; transport and hull identities
persist. See [Tank guard and fleet rules](docs/TANK_GUARD.md).

[Parked tank guard](docs/TANK_GUARD.md) gives unoccupied, operational tanks
stationary automatic HE/magnetic main-gun defence, prioritising visible Bulwarks.
Manual boarding cancels automatic charging; hull-owned reloads survive handoff.
Sentries retain their lighter-target role. No new population or projectile caps.

## Normal campaign combat loop — 19 October

Implemented for playtesting in `docs/NATURAL_ENCOUNTERS.md`: nearby hostile
compounds replenish defenders until all members are conquered; seeded raids also
challenge cleared territory. Eight-second warnings, one room-wide event and
medium-appropriate arrivals replace reliance on test spawning. Timers and dormant
survivors persist; conquest stays permanent. Population/timing values are initial
tuning, not a measured hosting-capacity claim.

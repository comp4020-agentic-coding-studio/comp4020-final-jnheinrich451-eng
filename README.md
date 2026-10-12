# Frontier: a foothold worth returning to

Frontier is a cooperative, overhead 2D war game for people who enjoy building
bases, operating military machines and fighting alien enemies. Designed for
**one to four players**, it supports solo progress and a shared campaign with friends.
The larger goal is to defend a foothold, expand controlled territory, eliminate
hostile forces and eventually secure the planet.

## The experience we are building

Arrive quickly, deploy a robot and support core, then build the means to survive
and advance. Players should move between fighting directly, piloting vehicles
and operating facilities. Ground, naval and air forces should offer different
ways to solve a problem; orbital support belongs to the later vision. Players
can defend, position artillery or fly bombing runs, leaving a base worth revisiting.

The 12 October logistics stage adds two ways around a blocked crossing: an
[engineering rover](docs/BRIDGE_BUILDER.md) unfolds a three-tile-wide bridge, and
an [armored transport](docs/ARMORED_TRANSPORT.md) ferries a tank or utility vehicle
to another shore. These support the same combat loop: open a route, recover alien
salvage, ship it to orbit and fund the next deployment.

## What makes that experience good

**Playable alone, better together.** Essential progress should not require a full
squad. Another player should create useful choices: defending, building,
transporting or attacking together. Friendly weapons should never destroy a
teammate's work.

**Power that remains readable.** Shells, explosions and hit reactions should make
combat satisfying. Players must still recognise threats, intended targets,
actual weapon direction, damage areas and reload states. Survival should reward
positioning and preparation, with understandable recovery after defeat.

**Control without unnecessary friction.** An invited teammate should reach the
battlefield without registration or an introductory video. A host creates an
Email or clearly labelled Demo account to keep ownership of their campaign.
Movement, deployment, boarding
and facility handoffs should explain possibilities and rejected actions.
Desktop and phone controls should keep the battlefield usable.

**Progress with consequences.** Conquering hostile sites should permanently clear
their influence from the map, leaving positions worth defending and revisiting.
Enemies do not recapture completed sites. Construction is available wherever the
terrain and placement rules permit it; conquest is progress, not a building
permission gate. Local objectives now include alert stations, bile mortars,
blight roots, a small settlement, air contaminators and lance towers. Their
permanent conquest is implemented; planetary victory remains future work.

Military behavior should make choices understandable: a turret takes time to
turn, heavy weapons reload, and vehicles need room to operate. Physical detail
supports satisfying combat within overhead 2D and the server budget. The first
local economy connects finite salvage, cargo rockets and shared deployment supplies.
Factories extend construction support and exchange time for lower equipment costs;
enemies can destroy the infrastructure. Free robot recovery and emergency core/HE
equipment keep defeat recoverable. Prices and timing are provisional, and height
remains design work. [The current stage](docs/CONSTRUCTION_LOGISTICS.md) separates
these local mechanics from deployment and performance validation.

## The shared-world contract

The [course brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
requires distinct people acting on shared state, changes reaching other open
sessions within about a second, and persistent consequences across sessions,
restarts and redeploys. Frontier's saved trace is its constructions and vehicle
state, permanently conquered sites, supplies and cargo. Accepted construction saves before
confirmation; movement uses half-second checkpoints. Named campaigns retain
enemies, committed airborne weapons and hazard state across closure/restart;
cosmetic craters remain temporary. The labelled legacy field keeps its earlier
transient-combat behavior.

The owner chooses when their campaign runs. Explicit owner departure saves and
closes the room; a lost connection freezes it for up to 30 seconds to reconnect.
Solo menus can pause the battle; admitting a teammate resumes it with a warning.
[The multiplayer decision](docs/decisions/001-owner-present-campaigns.md) explains
the alternatives and the cost of preventing play while the owner is absent.

These commitments belong in [agent rules](CLAUDE.md) and [automated checks](spec/).
Checks cover persistence, conflicting actions, exclusive controls and
responsive layouts. [Crit 8 Fly checks](docs/CRIT8_RELEASE.md) verified the earlier
shared-world baseline. The newer accounts, campaigns, conquest and operational
logs are a local checkpoint; [current evidence](docs/CRIT_9_10_EVIDENCE.md) separates
local checks from the pending Fly update and classroom rehearsal. Sustained-load
validation remains a gate.
Enjoyment, readability and useful cooperation need human playtesting; the
creator's prototype feedback is an initial signal, not independent validation.

## Scope and development path

Rooms enforce **one to four participants**, but four-player sustained combat
capacity is not yet validated on Fly. The current deployment configuration is
one shared CPU and 256 MB RAM. The author reports that a justified RAM increase
can be discussed with the teaching team; measurement should motivate that request.
Representative multiplayer
battles must determine the supported maximum; reduce it if necessary while
retaining at least two simultaneous players. Entity limits and affordable visual
effects matter alongside player count.

Development proceeds through a saved shared world, reusable ground/naval/air
components, then the connected defense-and-expansion campaign, followed by
balance, performance, textures and sound. The prototype already has construction,
ground combat, artillery, ships and an HE bomber. Local host-owned campaigns add
invitations, remembered account membership, orbital landing and the first
permanent conquest objective. In-game help provides controls;
[GAME_DESIGN.md](GAME_DESIGN.md) holds the boundaries and stage roadmap.

Email/password registration, verification and recovery are implemented locally,
with SMTP for real delivery or a private simulated Demo inbox. Actual Brevo inbox
receipt still needs testing. Guests join by invitation and keep their contributions
in the host's world; only accounts host. [The permission decision](docs/decisions/002-identity-and-permissions.md)
explains server-enforced ownership, shared equipment and the guest lifetime.
Multiple planets, cinematic introductions, final textures and sound are deferred.

## Influences and choices

[Helldivers 2](https://www.playstation.com/en-us/games/helldivers-2/) inspired the
cooperative war fantasy and powerful support weapons. Frontier adds persistent
base-building and deliberately excludes friendly fire.
[Kenney's Top-down Tanks Remastered](https://kenney.nl/assets/top-down-tanks-remastered)
informed the pure overhead presentation: consistent silhouettes and square tiles
make a growing arsenal easier to read and produce. This choice keeps realistic
3D simulation outside the project's scope.

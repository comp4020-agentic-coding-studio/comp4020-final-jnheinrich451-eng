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

## What makes that experience good

**Playable alone, better together.** Essential progress should not require a full
squad. Another player should create useful choices: defending, building,
transporting or attacking together. Friendly weapons should never destroy a
teammate's work.

**Power that remains readable.** Shells, explosions and hit reactions should make
combat satisfying. Players must still recognise threats, intended targets,
actual weapon direction, damage areas and reload states. Survival should reward
positioning and preparation, with understandable recovery after defeat.

**Control without unnecessary friction.** A newcomer should reach the battlefield
without registration or an introductory video. Movement, deployment, boarding
and facility handoffs should explain possibilities and rejected actions.
Desktop and phone controls should keep the battlefield usable.

**Progress with consequences.** Expansion should create defensible positions and
new opportunities. The campaign should make building and returning meaningful;
the current prototype does not yet implement territorial capture or planetary
victory.

## The shared-world contract

The [course brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
requires distinct people acting on shared state, changes reaching other open
sessions within about a second, and persistent consequences across sessions,
restarts and redeploys. Frontier's saved trace is its constructions and vehicle
state. Accepted construction saves before confirmation; movement uses half-second
checkpoints. Enemies, airborne weapons and cosmetic craters are temporary.

These commitments belong in [agent rules](CLAUDE.md) and [automated checks](spec/).
Local checks cover persistence, conflicting actions, exclusive controls and
responsive layouts. Live deployment and sustained-load validation remain gates.
Enjoyment, readability and useful cooperation need human playtesting; the
creator's prototype feedback is an initial signal, not independent validation.

## Scope and development path

The 1–4-player range is a design target, **not an enforced or validated capacity**.
The course provides one shared CPU and 256 MB RAM. Representative multiplayer
battles must determine the supported maximum; reduce it if necessary while
retaining at least two simultaneous players. Entity limits and affordable visual
effects matter alongside player count.

Development proceeds through a saved shared world, reusable ground/naval/air
components, then the connected defense-and-expansion campaign, followed by
balance, performance, textures and sound. The prototype already has construction,
ground combat, artillery, ships and an HE bomber. It currently shares one guest
world; host-owned campaigns remain planned. In-game help provides controls;
[design notes](docs/AIR_FORCE.md) document stages.

Optional email/password registration is planned, with SMTP for real verification
and recovery emails, or a clearly labelled dummy email flow for prototyping.
Neither is implemented; simulated delivery cannot verify an address. Guest entry
remains available. Private rooms, multiple planets and cinematic introductions
are deferred.

## Influences and choices

[Helldivers 2](https://www.playstation.com/en-us/games/helldivers-2/) inspired the
cooperative war fantasy and powerful support weapons. Frontier adds persistent
base-building and deliberately excludes friendly fire.
[Kenney's Top-down Tanks Remastered](https://kenney.nl/assets/top-down-tanks-remastered)
informed the pure overhead presentation: consistent silhouettes and square tiles
make a growing arsenal easier to read and produce. This choice keeps realistic
3D simulation outside the project's scope.

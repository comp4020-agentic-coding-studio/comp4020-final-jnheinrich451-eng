# Frontier: process overview

Crit 8 draft for author review, 5 October 2026. This account was assembled with
agent assistance from the development conversation, implementation and stage
records. File links show present evidence; they do not establish commit chronology.

## From the brief to a playable direction

The [brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
requires shared state, timely updates and durable consequences. The author's
starting question was what becomes more interesting when more people join while
remaining useful alone. A cooperative war game offered that possibility:
players could defend, build and operate different machines together. The author
identified Helldivers 2 as an influence, then added persistent construction and
ground, naval and air forces. [GAME_IDEAS.md](GAME_IDEAS.md) preserves the broader
brainstorm; it is not a list of features already delivered.

The author chose a playable baseline before further discussion. The
[first world](docs/FIRST_WORLD.md) connected movement, shared construction and
saved progress. Later stages added combat and vehicles. The emerging definition
of good in [README.md](README.md) now includes readable weapons, useful
cooperation, immediate entry and reasons to return. Territorial conquest is
still a goal; a collection of working weapons does not yet demonstrate a campaign.

## Stack and resource tradeoffs

The initial implementation uses Node's HTTP server and built-in SQLite, with
browser ES modules and Canvas 2D. [server.js](server.js) and the
[Dockerfile](Dockerfile) show a runtime without npm dependencies. The course's
single shared CPU, 256 MB RAM and persistent volume made a small, measurable
server attractive. This was a practical starting choice, not the result of a
comprehensive engine benchmark.

The server validates actions and owns simulation outcomes. Browsers draw terrain,
units and particles, so visual spectacle does not require the server to simulate
every fragment. HTTP commands carry input; server-sent events distribute shared
snapshots. The simulation ticks every 100 milliseconds. This keeps the transport
simple, but repeated requests and snapshots have overhead. More units and more
players will require measurement before retaining this approach at larger scales.

SQLite keeps durable state on `/data` without a separate database service.
Accepted construction is saved before acknowledgement; movement uses half-second
checkpoints. WAL and full synchronous writes support durability, while synchronous
database work remains a potential source of stalls. Buildings and vehicle state
persist; enemies, airborne weapons and cosmetic craters are temporary. This
boundary limits stored history and must be communicated honestly to players.
Browser-bound guests currently share one world; accounts and host-owned campaigns
are not implemented.

## Art and interaction choices

The author inspected several asset packs and chose pure overhead 2D over
isometric presentation. [ART_WORKFLOW.md](ART_WORKFLOW.md) records their differing
projections and suitability. Square tiles and independently rotating hulls and
turrets reduce the work needed to introduce units. Selected runtime assets carry
provenance; the large local source library stays ignored. This accepts a simpler
visual style while leaving room for stronger impact effects and later audio.

Early phone feedback was that the preview did not feel like a game. The response
was a viewport-filling battlefield, collapsible deployment controls and contextual
vehicle manuals. Later, the author requested separate desired and actual aim
points. [Stabilized turrets](docs/STABILIZED_TURRET.md) made rotation speed visible
and reusable across mounts. These decisions connect readability to mechanics,
rather than relying on a final visual polish pass.

## Directing and correcting agent work

The working loop has been proposal, bounded implementation, automated checks,
then author play and correction. The author supplies priorities, desired feel
and screenshots; the agent inspects code, implements mechanics and records
checks. [CLAUDE.md](CLAUDE.md) carries durable constraints: preserve saves, enforce
shared rules on the server, protect friendly entities, and separate current
mechanics from future proposals. README changes happen at stage checkpoints.

Rails exposed a mismatch between the initial implementation and the intended
building system. Large curves consumed too much space; the author wanted
one-tile corners and branches. [Compact rails](docs/COMPACT_RAILS.md) replaced
new large-curve construction while preserving older saves. Further reports
identified rejected placement on walkable base flooring and a false unit
collision during turns. The resulting rules distinguish solid machinery from
flooring and check the rotating carriage's swept body. Those corrections appear
in CLAUDE, [floor checks](spec/rail-floor.test.ts) and
[turn checks](spec/compact-rail.test.ts), not only in conversation.

Another correction concerned fire and gas missiles: labels appeared, but their
fields looked like ordinary craters. Checking the launch effect alone had missed
the experience after impact. The working agreement now requires inspection of
aged hazards, supported by [browser coverage](tests/browser/missile-fields.spec.js).
It also requires matching client and server build fingerprints so an old renderer
does not silently consume a changed state format.

## Verification and its limits

The harness retains the two supplied [course invariants](spec/invariants.test.ts)
and adds domain, HTTP persistence and browser checks. Temporary databases keep
test activity away from the author's saved world. The
[aircraft checkpoint](docs/AIR_FORCE.md) records type checking, 161 passing
domain/HTTP tests and six desktop/phone browser cases. It also records rerunning
two phone cases after concurrent Playwright runs collided during artifact
cleanup. These are recorded local results, not evidence of a deployed service.

Short resource probes informed limits but cannot establish sustained combined
combat performance on Fly. One to four players remains a design target;
representative battles must determine capacity while retaining multiplayer.
Author feedback establishes that particular interactions were enjoyable to their
creator. Independent playtesting is still needed for onboarding, cooperation,
balance and the connected campaign.

## Evidence gaps and the next checkpoint

The supplied baseline is
[`60ec68b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/60ec68b).
The first game checkpoint is
[`3bda7a0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/3bda7a0),
which collects the prototype, tests and Crit 8 documents after author review.
Earlier stages were not committed individually: the design records explain
decisions but cannot replace that missing history. Future reviewed stages should
produce genuine commits, without inventing a retrospective sequence.

Release preparation reran all 161 tests and the evidence check successfully.
The deployable Docker image also passed the supplied HTTP invariants and the
course page/asset verification under a 256 MB limit. These local release checks
do not establish live deployment or sustained multiplayer capacity.

Crit 8 still needs verified Fly deployment, a returning stranger's saved trace
and public repository status. The [reflection](reflections/crit-8.md) is now
drafted from the author's account of turning ideas into stages and learning
the pipeline. Passing `check:evidence` checks file presence and commit references,
not the quality of either account. Optional email registration is now planned, with
real SMTP delivery or a labelled dummy flow; guest entry remains available.
Next gameplay work should connect the existing systems into defense and
expansion, then test balance and capacity before adding further breadth.

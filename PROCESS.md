# Frontier: process overview

Stage checkpoint updated 11 October 2026, following the Crit 8 account of
5 October. This account was assembled with
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
cooperation, accessible entry and reasons to return. The first permanent alert
station now connects the weapons to a local conquest objective. A complete
planetary campaign remains a goal.

## Stack and resource tradeoffs

The initial implementation uses Node's HTTP server and built-in SQLite, with
browser ES modules and Canvas 2D. [server.js](server.js) and the
[Dockerfile](Dockerfile) show the small runtime; Nodemailer is now its mail-delivery
dependency. The course's
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
persist. Named campaigns now also checkpoint enemies, committed airborne attacks,
hazards and conquest, while cosmetic traces remain transient. Legacy combat keeps
its earlier transient behavior. Each campaign has its own SQLite world; a shared
account/membership registry governs admission. Accounts and host-owned campaigns
are implemented locally, with [migration and retention rules](docs/CAMPAIGN_STAGE.md).

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
combat performance on Fly. One to four players remains a capacity target, with
a four-person admission cap;
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

The [first Fly checks](docs/CRIT8_RELEASE.md) exercised two guests, shared
construction, a returning session and persistence across a machine restart.
The author approved public release; the repository is now public. Final shipping
runs public CI and tags the verified deployment.
Public CI exposed a timing-dependent docking test; it now waits for observed
arrival, with the correction recorded in CLAUDE. The [reflection](reflections/crit-8.md) is
drafted from the author's account of turning ideas into stages and learning
the pipeline. Passing `check:evidence` checks file presence and commit references,
not the quality of either account. That release is historical evidence for the
Crit 8 baseline, not verification of the later local campaign implementation.

## Campaign foundation and Crit 9/10 preparation

The author clarified that the save belongs to its host, guests may join but not
host, registered friends retain membership, and guests leave their constructions
behind. They chose a 30-second owner reconnect freeze, closure on explicit owner
exit, and automatic resume when another player joins a paused solo room.
[ADR-001](docs/decisions/001-owner-present-campaigns.md) records the alternatives
and costs of that behavior against README's definition of good.

The entry sequence became account/guest choice, Caldera selection, campaign
create/join/resume, then orbital core placement before a ground robot exists.
Real-email and private Demo verification/recovery are implemented; actual Brevo
inbox receipt still needs testing. The first alert station adds bounded defenders,
HE damage, saved partial progress and permanent conquest. The author's direction
was mildly unpleasant biological structures that players want to remove, without
changing the pure overhead art or introducing a full economy at this stage.

After reviewing the [Crit 9/10 plan](docs/CRIT_9_10_PLAN.md), the author requested
the supporting functions and a documentation checkpoint. The agent added structured
server logs, correlated heavy launches with delayed objective damage, and preserved
that correlation in combat saves without exposing it in public snapshots.
Rapid inputs and automatic defense use summaries. [ADR-002](docs/decisions/002-identity-and-permissions.md)
records the actual permission boundaries, including the narrower host rights for
abandoned guest construction and the owner-only vehicle replacement exception.

New checks exercise named-room placement/boarding races, redaction, async identity
separation and projectile attribution after checkpoint restore. A browser test
measures peer-visible construction and objective changes with one observer clock
in two- and four-person rooms. Its first fixture incorrectly attempted construction
from a tank and was corrected to use disembark/build/board. Turret readiness also
needs an observed condition rather than a short fixed delay. These test corrections
are not claims of independent player feedback. [Stage evidence](docs/CRIT_9_10_EVIDENCE.md)
records the results and measurement limits.

Economy decisions, elevation and broader conquest remain separate stages. The
new checkpoint still needs an approved deployment, live persistence/latency checks,
and the two-classmate URL-only log narration. Crit 9/10 reflections must use the
author's actual decisions and later findings. `pnpm check:evidence --crit=9` (or
`--crit=10`) now checks the specific week's reflection, so Crit 8 alone cannot
silently satisfy that requested cutoff. No new commits, classroom results or Fly
deployment are claimed by this document update.


## Conquest and Crit 9 checkpoint, 11 October

The author reviewed each new enemy in play: mortar, blight root, settlement,
contaminator and lance tower. The contaminator made visibility a tactical problem
while retaining surveyed coordinates and long-range aiming. The lance exposed a
difference between working damage rules and a dodgeable attack. Author feedback
first led to a chasing ground endpoint, then clarified that the long beam should
remain and only its angle should track slowly. [The stage record](docs/LASER_TOWER.md)
preserves that final behavior and verification. Missile battery/submarine aiming
also changed to resolve distant requests to a legal full target rectangle.

The author selected learning through playtesting as the breakthrough for
[the Crit 9 reflection](reflections/crit-9.md). Its account distinguishes local
checks from deployed timing and classroom feedback. The requested checkpoint
push includes the accumulated campaign, account, logging and conquest work;
it does not reconstruct separate historical commits for those earlier stages.
Pre-push review caught a missing observability.js copy in the Docker image;
the corrected production image builds and its home, README and account-status
routes return HTTP 200 with disposable data. The existing main-branch workflow
will check and deploy the pushed revision; that result must be verified separately.

Pre-push validation: typecheck and 257 tests passed, plus the Crit 9 evidence
checker. All 11 selected account/campaign, fog, lance/missile, aircraft and
multiplayer browser scenarios passed across the initial run and focused rerun.
Two fixture repairs were needed: wait for actual minimum airspeed before releasing
the throttle key, and isolate the timing objective from newly added hostile
encounters. The final 52 local peer observations peaked at 450 ms; this does not
establish deployed performance. Fly's email secret list was empty, so actual
Brevo delivery remains unconfigured and untested.

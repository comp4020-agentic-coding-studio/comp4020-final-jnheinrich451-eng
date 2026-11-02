# Frontier: process overview

This is how I got from the brief to the game and the harness behind it. I set the
direction, play each stage and decide what changes. Agents wrote nearly all the
code and drafted most documents from what I told them, including this one. Where
an idea came from an agent, I say so.

## From brief to direction

The [brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
asks for shared state, timely updates and durable consequences. I asked what gets
more interesting as people join while still working for one person, and chose a
cooperative planetary war, influenced by Helldivers 2. I filled in
[GAME_IDEAS.md](GAME_IDEAS.md) at the start; it is a brainstorm, not a
specification. I then asked for something playable before more discussion:
[`3bda7a0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/3bda7a0),
built on the supplied
[`60ec68b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/60ec68b).
Earlier stages were not committed separately, and I cannot rebuild that history.
Codex later summarised my decisions into [GAME_DESIGN.md](GAME_DESIGN.md), first
committed in
[`45511ea`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/45511ea).
It keeps agreed behaviour apart from proposals.

## Stack and trade-offs

Fly gives the app one shared CPU and 256 MB of memory, and the server must own
every outcome. So I chose the smallest stack I could measure: Node's HTTP server,
built-in SQLite and Canvas 2D, with no game engine or framework. I did not
benchmark engines, so this was a practical choice, not a proven best one.

Commands travel over HTTP and snapshots over server-sent events, on a 100 ms tick.
That is simple to test, but repeated requests add overhead and synchronous database
writes can stall a tick. Browsers draw every effect, so spectacle costs the server
nothing. Each campaign has its own SQLite world, with a shared account registry.
[ADR-001](docs/decisions/001-owner-present-campaigns.md) keeps a room open only
while its owner is present, which costs friends the chance to play while the host
is away. [ADR-002](docs/decisions/002-identity-and-permissions.md) lets accounts
own campaigns while guests only join.

## Agent workflow

My loop is to describe the feel I want, review the agent's proposal, approve a
bounded stage, let it build and check, play it, then record the correction. I judge
mostly by eye. I give rough intent, and the agent turns it into detail: I named the
Remote commands for ships and helicopters, and it built each entry. I said no
weapon should be far stronger than its type, and it proposed numbers that fit the
map scale, marked [provisional](docs/RAIL_WEAPONS_POLISH.md#L55) until I played them.

I used Codex and Claude Code, often in parallel on separate parts, and Gemini made
the music. Near the end, Codex built Colonization while Claude Code worked on the
war game. That saves time, but both share one working tree and some files, so
commits must name exact paths, as in
[`489da0b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/489da0b).

The commit history is uneven. Stages piled up in fast weeks, so
[`b02997d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/b02997d)
touched 301 files and
[`677d2ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/677d2ec)
touched 191. Those commits hide the order of decisions, so the
[stage records](docs/) carry that detail.

## The harness

[CLAUDE.md](CLAUDE.md) holds the rules, reorganised by topic in
[`4adc245`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/4adc245).
[spec/](spec/) holds domain and HTTP checks, [tests/browser/](tests/browser/) holds
desktop and phone checks, and [check-evidence](scripts/check-evidence.ts) verifies
the citations here. Fixes should land in these files, not stay in conversation. CI
once failed a docking test that used a fixed sleep;
[`140331b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/140331b)
changed the test and added a rule to wait for observed state. A root module missing
from the production image was fixed in
[`d0bdeb4`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/d0bdeb4),
and a rule about the Dockerfile `COPY` line followed.

## Three corrections

**Weapons.** Broad rail curves took too much space, so I asked for one-tile corners.
[Compact rails](docs/COMPACT_RAILS.md) replaced them for new construction, old saves
kept theirs, and [tests](spec/compact-rail.test.ts) hold the rule. Later, the first
anti-air gun followed ballistic physics: a slow two-barrel salvo, with bullets the
frame rate broke up. I proposed one firing line that stops at the first hit, with
short segments lit in turn. In
[`677d2ec`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/677d2ec)
it fires one round every 125 ms, at the same 160 damage per second.

**Enemy AI.** Seeded fronts arrived in
[`e4c7df5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/e4c7df5).
Playing them, I found
[two or three clusters per continent too sparse](docs/LAND_AI_AND_SEEDED_FRONTS.md#L411),
so the targets became 6, 6 and 12. I also asked for
[a slow armoured enemy](docs/LAND_AI_AND_SEEDED_FRONTS.md#L468). Bulwarks take only
explosives and charged magnetic shots, which gives heavy weapons a reason to exist.
That rule sits in CLAUDE.md and [its tests](spec/bulwark.test.ts).

**Visual layout.** The first [UI refinement](docs/UI_REFINEMENT.md) was planned
before any code and shipped in five stages:
[`6c3890c...8da49c6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/compare/6c3890c...8da49c6).
It exposed stale browser tests, which
[`c8e7c63`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/c8e7c63)
began repairing. After playing it, I threw much of the look away. Blue panels and
long sentences became
[one graphite and gold HUD](docs/HUD_AND_POLISH_STAGE.md) readable in one second, in
the spirit of Dead Space, with one word and one key per command, in
[`5bbd038`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/5bbd038).

## Colonization

Colonization is a separate peaceful mode for players who dislike fighting, sharing
accounts and multiplayer. I know this kind of game less well, so Codex proposed its
production chain from my list of machines, and I can check that design less
closely than the war game. It arrived in
[`631b10d`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/631b10d),
is unfinished, and a rule keeps farms out of combat.

## What good means

The early README listed readable weapons, cooperation, easy entry and reasons to
return. For the final version I cut it to one idea that runs through the rules and
tests: a defeat always leaves a way back, and that way back costs something. Juul's
study supports keeping failure, but it is one small game and its main result only
neared significance, so I treat it as a reason, not proof. Sloan's app is for one
family, while Frontier has public accounts, so I borrow the small scale and not the
whole case.

## Limits

Passing checks shows that the rules hold. It does not show capacity or fun.
Sustained four-player combat on Fly is unmeasured; a four-client idle probe used
about 103 MiB, which is not a combat benchmark. CI does not run the full browser
suite. Diagnosing its failures found mostly stale tests but also
[four real bugs](docs/HUD_AND_POLISH_STAGE.md#full-browser-suite), including a map
repaint that froze every client for 1.5 s and broke the latency limit. Its last local
run, on the E-cores with retries off, passed 300 of 301 war-game tests and all 35
Colonization tests; the failure was a slow test read, since fixed. Earlier crashes followed this i9-14900K's P-cores (6 of 14 against
0 of 14), which fits Intel's documented fault without proving it. Latency passes
locally, which says nothing about Fly. I have recorded no independent playtest.

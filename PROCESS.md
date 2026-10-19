# Frontier: process overview

Frontier is a cooperative, server-authoritative 2D war game for one to four
players. This account was assembled with agent assistance from the commits,
stage records and development conversation. The author's decisions are
attributed to them. The full stage-by-stage account is preserved at
[`dedec3f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/blob/dedec3f/PROCESS.md).

## Direction

The [brief](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/assessments/final-project/)
asks for shared state, timely updates and durable consequences. The author asked
what becomes more interesting as more people join while staying playable alone,
and chose cooperative planetary conquest, influenced by Helldivers 2. A playable
baseline came first:
[`3bda7a0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/3bda7a0)
built on the supplied
[`60ec68b`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/60ec68b).
[GAME_DESIGN.md](GAME_DESIGN.md) separates agreed behaviour from the wider
brainstorm in [GAME_IDEAS.md](GAME_IDEAS.md).

## Stack and tradeoffs

Node's HTTP server, built-in SQLite and Canvas 2D fit the single shared CPU and
256 MB Fly machine. The server validates actions and owns outcomes. Browsers draw
effects, so spectacle costs no server simulation. Commands travel over HTTP and
snapshots over server-sent events, with a 100 ms simulation tick: simple, but
with overhead that must be measured. A four-client idle probe used about 103 MiB; that is not a
combat benchmark.

## The harness

The agent is directed through files in this repo:

- [CLAUDE.md](CLAUDE.md) holds durable rules: preserve saves, enforce shared
  rules on the server, never damage friendlies, and keep proposals separate from
  current behaviour. Corrections become rules here rather than staying in
  conversation.
- [docs/](docs/) stage records and [decisions](docs/decisions/) record each agreed
  stage and its alternatives.
- [spec/](spec/) keeps the supplied [invariants](spec/invariants.test.ts) alongside
  domain and HTTP tests. [tests/browser/](tests/browser/) runs desktop and phone
  scenarios against isolated saves.
- The [pre-commit hook](.githooks/pre-commit) blocks API keys,
  [CI](.github/workflows/checks.yml) checks and deploys to Fly, and
  [check-evidence](scripts/check-evidence.ts) verifies these records.

The loop is proposal, author approval, a bounded stage, checks, author play,
then a recorded correction.

## Corrections

Playtests changed the rules, not just the code. Broad rail curves were replaced
by [compact rails](docs/COMPACT_RAILS.md). Fire and gas fields that looked like
craters led to a requirement to inspect aged hazards.

The [UI refinement](docs/UI_REFINEMENT.md) was designed and approved before any
code, then shipped as five reviewed stages:
[`6c3890c...8da49c6`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/compare/6c3890c...8da49c6).
That work exposed browser tests that had silently gone stale since orbital
entry and the economy.
[`c8e7c63`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/c8e7c63)
began repairing their setups without loosening game rules. Gameplay failures
were reported rather than masked. CI later caught an inconsistent submarine
timeout:
[`dedec3f`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/dedec3f).

## Checkpoints

- [`3bda7a0`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/3bda7a0):
  the Crit 8 prototype. Earlier stages were not committed separately, a gap
  that is acknowledged rather than reconstructed.
- [`45511ea`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/45511ea):
  Crit 9 campaigns, accounts, conquest and logging
  ([ADR-001](docs/decisions/001-owner-present-campaigns.md),
  [ADR-002](docs/decisions/002-identity-and-permissions.md)).
- [`849924c`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/849924c):
  Crit 10 planetary map and shared support networks.
- [`e4c7df5`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/e4c7df5):
  seeded enemy fronts and separate vehicle deployment.
- [`6c8e0bb`](https://github.com/comp4020-agentic-coding-studio/comp4020-final-jnheinrich451-eng/commit/6c8e0bb):
  air support, campaign encounters and readable action logs.

Since Crit 9, reviewed stages are committed individually.

## Limits

Passing local tests and CI shows that the recorded rules hold. It does not show
deployed capacity or that the game is fun to others. At the Crit 10 checkpoint,
populated multiplayer load on Fly and independent playtesting were still
outstanding. [Reflections](reflections/) use the author's actual findings.

# Crit 9/10 local preparation checkpoint

10 October 2026. These are local working-tree results, not a new Fly release or
completed classroom exercise. Prior deployed evidence remains in CRIT8_RELEASE.md.

## Implemented

- Shared structured logging across accounts, campaign routing and game actions,
  with actor/pilot/campaign/request IDs, accepted and denied outcomes, room
  lifecycle events and bounded rapid-input/automatic-defense summaries.
- Heavy launches correlated to later objective damage/conquest through saved
  pending-projectile metadata. Public snapshots omit the attribution map.
- Named-room simultaneous placement and boarding tests, including rejected
  ownership and invitation operations, distinct actors and sensitive-field checks.
- A browser timing check observing every peer in two- and four-person rooms.
- ADR-001 for room lifecycle, ADR-002 for permissions, updated README/PROCESS and
  in-game persistence help, plus cutoff-specific reflection checks.

## Checks performed

`pnpm check`: type checking and **197 tests in 36 files passed**. This includes
the original course invariants, account revocation/isolation, campaign return,
reconnect/paused rooms, stale commands, persistence and new logging/race tests.
After the final logging review, relevant account/campaign/audit checks were also
rerun. This does not claim every browser gameplay file was rerun.

Seven selected Playwright checks passed: account registration/private Demo inbox/
login/logout on desktop and phone; campaign create/invite/pause/saved return on
desktop and phone; shared conquest and restart retention on desktop and phone;
and the new two-/four-person timing check. Screenshots of the peer's conquered
HUD and the returned phone campaign were inspected. This is an automated local
rehearsal, not independent human playtesting or the Crit 10 narration exercise.

`pnpm check:evidence` passed for the existing Crit 8 evidence. Explicit
`--crit=9` and `--crit=10` correctly failed because their reflections do not yet
exist. Those expected failures are outstanding submission work, not a claim that
the later crits are ready to ship.

## Local timing observations

Windows, Node 26.5.1, headless Chrome 154.0.8037.97, local loopback. One monotonic
observer clock measures an accepted HTTP action through the peer's **visible**
HUD change and two animation-frame callbacks, giving the canvas a frame and paint
opportunity. The test checks each peer, not an average over the room. Guest peers
land their cores before observation. Cold startup is excluded. The fixture uses
flat terrain, one ready tank and no station reinforcements: this is a small
synchronization workload, not a combat-capacity or 256 MB resource benchmark.

| Room | Action | Peer samples | Median | p95 | Maximum |
| --- | --- | ---: | ---: | ---: | ---: |
| 2 participants | Place foundation | 5 | 26 ms | 32 ms | 32 ms |
| 2 participants | Remove foundation | 5 | 23 ms | 24 ms | 24 ms |
| 2 participants | HE objective hit, including flight | 3 | 387 ms | 389 ms | 389 ms |
| 4 participants | Place foundation | 15 | 30 ms | 34 ms | 34 ms |
| 4 participants | Remove foundation | 15 | 31 ms | 33 ms | 33 ms |
| 4 participants | HE objective hit, including flight | 9 | 417 ms | 437 ms | 437 ms |

All 52 observations were below one second. The small sample counts and loopback
environment limit the inference; they establish this local path works, not that
every internet session or sustained battle meets the target. Nearest-rank p95 is
reported, including the maximum for small groups. The combined two-person median/
p95/max was 25/389/389 ms; four-person was 32/436/437 ms.

[Retained sample data](evidence/crit-9-local-latency-2026-10-10.json) records every
observation. Reproduce with `pnpm exec playwright test tests/browser/multiplayer-latency.spec.js`.
Temporary screenshots, timing JSON and captured redacted events are under
`test-results/`; the checked-in sample data preserves this run when tests clean
that temporary directory.

The timing fixture was corrected after attempting construction while seated and
after firing before observed turret alignment. Review also caught that an orbital
peer's objective HUD is hidden; the final check requires landing and visible
elements. Earlier timing passes without that visibility gate are superseded by
the figures above. Game permission and turret rules were preserved.

## Still required before the respective submissions

1. Review/commit the checkpoint, then use the authorized release workflow to
   deploy. Repeat shared updates, saved return/restart and log visibility on Fly.
2. Measure all participants on the deployed app, record revision/date/network and
   separate cold start, simulation work and update delay. Measure sustained CPU/
   memory before claiming four-player battle capacity or requesting more RAM.
3. For Crit 9, use the README and ADR-001 with the pod; record their actual response
   to the chosen multiplayer behavior and the rejected alternatives.
4. For Crit 10, give two classmates only the URL. They create/join and play while
   the author narrates from `flyctl logs`, then compare narration with actions.
5. Write each week's reflection from actual work and findings; run its explicit
   cutoff check. No calendar cutoff is invented here.

No economy, elevation, new enemy behavior, SMTP receipt, production performance,
new deployment, or new commit history is asserted by this checkpoint.

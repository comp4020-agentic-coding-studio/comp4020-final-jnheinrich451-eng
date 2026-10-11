# ADR-001: keep campaign rooms open only while their owner is present

Recorded 10 October 2026 from the author's earlier accepted campaign decisions.
Status: accepted behavior, implemented locally. Deployed verification belongs to
the next release evidence; this record does not claim a new deployment.

## Context

Frontier's README values a world worth returning to and useful cooperation.
Players share one owner's saved campaign, while Fly owns simulation and storage.
The owner is not the network server. We need predictable control over when their
world advances and a clear response to interruption.

This is the behavioral decision selected for
[Crit 9](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/09-all-at-once/).
It is separate from the technical choice of SSE over another transport.

## Alternatives considered

| Choice | Benefit | Cost |
| --- | --- | --- |
| Members continue while owner is absent | Friends can advance asynchronously | The owner's campaign changes without them; adds unattended-session and progression policy |
| Close immediately whenever the owner's connection drops | Very simple lifecycle | Brief network interruptions eject everyone |
| Owner-present room with a reconnect grace | Owner controls active play; brief interruptions can recover | Friends depend on owner availability and experience a temporary freeze |

## Decision

Use the third option. Explicit owner leave closes/saves immediately and returns
members to the lobby. Unexpected owner disconnect freezes the simulation for up
to 30 seconds; reconnect resumes the visit, while expiry saves/closes the room.
Registered members retain membership and can rejoin a later owner-opened session.
Solo menus pause, while multiplayer menus do not; admission of a teammate resumes
a paused solo room with a warning. Existing saved state persists independently of
whether a room is open.

## Consequences and evidence

This supports deliberate shared sessions and protects the meaning of saved return.
It sacrifices asynchronous play and uninterrupted teammate play during owner loss.
The reconnection grace is a product trade-off, not a constraint imposed by Fly.
The UI must explain frozen/closed rooms and distinguish them from lost progress.

Implementation: `campaigns/service.js` and the campaign runtime in `server.js`.
Checks: `spec/campaigns.test.ts` covers owner exit, freeze/reconnect/timeout,
membership, solo-to-multiplayer resume and stale commands after room replacement;
`tests/browser/campaigns.spec.js` exercises the browser room lifecycle. These are
local evidence pointers, not latency measurements or a claim about the live site.
See [the preparation plan](../CRIT_9_10_PLAN.md) for deployed and peer checks.

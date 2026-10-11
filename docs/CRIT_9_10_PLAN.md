# Crit 9 and Crit 10 preparation

10 October 2026. Implementation checkpoint: structured logs, permission/race
checks, a local browser timing harness and README/PROCESS updates now implement
the preparation below. See [recorded evidence](CRIT_9_10_EVIDENCE.md).
Deployment, live latency measurements and classroom exercises remain pending.

## Published requirements

[Crit 9: All at once (Week 10)](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/09-all-at-once/)
requires the deployed project to propagate changes to other open sessions in
about one second without reload. Record one consequential multiplayer behavior
decision, alternatives and costs, tied to the README's definition of good.
Maintain development commits, PROCESS.md and reflections/crit-9.md, and explain
how the author directed and corrected the work.

[Crit 10: Fly by instruments (Week 11)](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/10-fly-by-instruments/)
requires distinct people sharing state, server-enforced permissions with a written
rationale, and continuing server logs showing who acted. Two classmates use only
the URL in separate Chrome profiles while the author narrates from logs without
operating the app. Keep process evidence and reflections/crit-10.md.

These are crit numbers 9/10, in teaching weeks 10/11. The linked spec sections do
not give calendar cutoff dates; confirm those through the course schedule.

## Current repository evidence and gaps

| Area | Present locally | Still needed for the crit |
| --- | --- | --- |
| Shared updates | Server simulation, HTTP commands, SSE snapshots, room presence; shared construction/combat/conquest | Measure action-to-peer-display delay on Fly, including every open participant; demonstrate on separate devices |
| Conflicts and reconnect | Exclusive equipment control, named-room placement/boarding races, stale-command rejection, 30-second owner reconnect freeze, saved return | Rehearse the same scenarios on Fly |
| Multiplayer decision | Lifecycle rationale in CAMPAIGN_STAGE.md; extracted decision below | Review the ADR against README's argument and discuss its cost with the pod |
| Distinct players | Email/Demo accounts, guest visits, membership, isolated campaigns | Rehearse independent Chrome profiles from the public URL with no narrator setup |
| Permission checks | Admission, cross-campaign access, ownership, occupied vehicles and stale-session validation; ADR-002 records the matrix and exceptions | URL-only classroom exercise and review of its findings |
| Server logging | Structured campaign/identity/action outcomes, denials, automatic-defense summaries and launch-to-objective correlation across saves | Verify live Fly output and narrate actual classmate actions |
| Published account | README/PROCESS updated for accounts, named campaigns, conquest and operational evidence | Review and publish this checkpoint through the release workflow |
| Reflections | reflections/crit-8.md exists | Actual reflections for each later crit, written from its work and findings |

Inspected sources: server.js, campaigns/service.js, accounts/service.js,
spec/campaigns.test.ts, spec/accounts.test.ts, spec/persistence.test.ts,
tests/browser/campaigns.spec.js and tests/browser/conquest.spec.js. Existing browser
checks exercise sharing and saved return, but are not a deployed one-second timing
report or a URL-only classroom rehearsal. The supplied invariants check `/` and
`/readme/`; they do not certify these crit requirements.

## Stage A — instrument the existing multiplayer loop

Implemented in [observability.js](../observability.js), with usage and boundaries
in [OBSERVABILITY.md](OBSERVABILITY.md). The original stage requirements follow.

Implement one structured event logger used by campaign, account and world services.
Log authoritative outcomes after validation/persistence, not client assertions.
Start with a bounded set of events:

- Identity/session established or ended; campaign created, opened, joined, left,
  frozen, resumed and closed; invitations issued/redeemed/revoked without their codes.
- Core/equipment deployed; facility control acquired/released; boarding and exit;
  relevant denied actions with a stable reason.
- Heavy weapon launch and its resulting objective damage/conquest. Keep action or
  projectile identity through delayed impact/checkpoints so a log can connect cause
  and outcome. Automated sentry actions distinguish the facility from a human operator.
- Checkpoint/migration failures and slow simulation summaries when diagnosing stalls.

Proposed fields: UTC timestamp, event, request/action ID, campaign ID, authenticated
actor ID, campaign pilot ID where different, identity kind, safe display name,
target/object ID, outcome and reason. Duplicate names must remain distinguishable.
System actions identify their cause (for example owner timeout), rather than
inventing a human actor. Log no passwords, cookies, verification/reset tokens,
invitation secrets, SMTP credentials or request bodies containing them. Avoid email
addresses when a display name and opaque ID suffice.

Do not emit a line per frame, held-key input, particle or machine-gun bullet.
Aggregate high-rate activity; keep important state transitions individual. This
is normal operational logging that stays in the application after the crit, not
a temporary presenter mode. Historical log retention beyond Fly's available logs
is a separate choice; the brief does not demand a new logging database.

Acceptance: two separate users' create/join/deploy/control/conquer/leave activity
can be reconstructed from captured server output; denied changes identify the
actor and reason; sensitive fixtures do not leak; logs correlate accepted delayed
shots to their outcome. Run the appropriate existing regressions after changes.

## Stage B — close the Crit 9 evidence gap

Use [ADR-001](decisions/001-owner-present-campaigns.md) for the existing owner-present
room decision. No new gameplay feature is needed to manufacture a decision.

Add a browser timing check on a disposable campaign: from initiating an action to
the peer rendering its authoritative result, measured with one observer clock.
Do not compare unsynchronised clocks on different devices or treat an HTTP reply
as proof that a peer displayed the change. Repeat placement, removal and an
objective-state change; retain sample count, environment, median, p95 and maximum.
The spec target remains approximately one second; investigate conspicuous delays
rather than hiding them in an average. Test two participants first, then all four
advertised slots. Report cold startup separately from an already open session.

Add or verify named-campaign races: two deployments on one tile, two users boarding
one vehicle, and a delayed command after room closure/reopen. One authoritative
outcome must reach both clients, with a clear reason for the rejected action.
Disconnect/reconnect must not duplicate equipment or undo accepted progress.

After reviewing a deployable checkpoint, deploy through the established workflow
and repeat the shared interaction on Fly. Record revision, date and outcome.
Local test success and a ten-Hz tick are insufficient deployment/latency evidence.

## Stage C — permissions and the Crit 10 rehearsal

Write a second decision record describing the actual identity/permission model:
registered accounts host, guests join by invitation, members share their campaign,
equipment operation differs from ownership, and the host manages abandoned guest
construction. Include owner-only room operations, exclusive occupancy, remembered
account membership and the guest visit lifetime. Audit each facility endpoint
before claiming a uniform permission rule across all equipment.

Check both rejected mutations and rejected reads/streams from another campaign.
Changing an object/campaign ID in a request must not grant access. UI hiding alone
is not authorization. Continue testing logout/takeover and delayed-body checks.

Rehearse this sequence using a disposable campaign and two clean Chrome profiles:

1. Hand both classmates the deployed URL. One uses the visible Demo account flow
   to create/open a campaign; the other uses the visible guest/join flow. Neither
   needs the narrator's cookies, an off-page secret or developer tools. Classmates
   generate/share the invitation through the game's own interface.
2. Each chooses a landing site and deploys something; both see the changes. They
   identify one another using the on-page names/presence and clear object feedback.
3. Use shared equipment, fire at the station, and observe damage/conquest. This
   sequence can be shortened to construction if time is tight; test logs for both.
4. While they play, the author only watches the terminal logs and explains who
   joined, deployed, took control, attacked and left. They do not drive either UI.
5. Compare the narration with the classmates' actual actions and record any gap.

The existing Demo flow is a deliberate test identity, not proof of real email
ownership. SMTP delivery is not a prerequisite of these two briefs. Keep all entry
instructions visible on the page; improve unclear UI discovered during rehearsal.

Use the course's terminal workflow when rehearsing:
`mise exec -- flyctl logs -a comp4020-final-jnheinrich451-eng`.
Log access is an operator capability, not a public game endpoint.

## Stage checkpoint documentation

README and PROCESS now distinguish local accounts/campaigns/conquest from the
Crit 8 deployment and describe named versus legacy persistence. The four-person
admission cap is separated from measured supported capacity. Before submission,
review those documents and add real deployment evidence while preserving the
broader game argument.

Before each cutoff, write the corresponding reflection from real work, author
decisions, corrections, trade-offs and peer findings. Do not prewrite successful
pod feedback or invented timing results. Keep commits as work is completed; do
not fabricate a development chronology afterward. The default evidence script
still accepts any one crit reflection for compatibility; use its new `--crit=9`
or `--crit=10` option to require the correct week's file.

## Relationship to the gameplay roadmap

Recommended priority: logging/permissions and multiplayer measurements, then a
Crit 9 deployment checkpoint, then Crit 10 URL-only rehearsal. The accepted enemy
and visual direction stays intact. Alarm-response refinement can be a later small
combat change; economy choices and height remain their own design stages. Logging
will later explain supply spending, denied purchases and failed shots without
adding those systems as prerequisites for the crits.

The author authorized this local preparation and documentation checkpoint.
It does not authorize a push/deployment, generate reflections, change the room
contract or settle the unanswered economy choices. README/PROCESS updates remain
stage checkpoints, as requested by the author.

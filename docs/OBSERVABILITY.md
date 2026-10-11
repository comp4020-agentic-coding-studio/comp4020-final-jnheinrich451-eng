# Reading a Frontier session from server logs

Implemented locally for Crit 9/10 on 10 October 2026. Logging stays enabled in
normal application operation; there is no presenter mode or public log endpoint.

## What is recorded

`observability.js` writes JSON lines to stdout, with UTC time and a stable event
name. Each API request gets a server-generated `requestId`. Validated identity
supplies `actorId`, `name`, `kind` and `pilotId`; guest campaign pilots can differ
from their browser identity. `campaignId` separates rooms (`legacy` for the old
field and account-only requests). System events identify a cause/source without
pretending that a player initiated an automatic action.

| Event | How to interpret it |
| --- | --- |
| `action.result` | Action path, actor, status, accepted/denied outcome, duration and relevant object ID. Deployment includes coordinates. Rejections include the server's reason. |
| `campaign.*`, `participant.*` | Open/close, owner connection, reconnect freeze, teammate admission resume, individual connection/leave and migration. Closure success follows saving. |
| `weapon.launched` | Accepted HE cannon shot, artillery/naval shell or missile/bomber barrage, with originating request, actor and source mount or firing pilot. |
| `objective.damaged`, `objective.conquered` | Projectile and request that caused the changed site HP. Named-world events emit after the checkpoint commits. |
| `activity.summary` | Five-second grouping of movement and rapid-fire commands by actor, room, action, status and reason. Count replaces per-input lines; request ID/duration describe the last request in the group. |
| `defense.activity` | Five simulation seconds of automatic sentry/guard shots, identifying the source facility/robot and weapon, with no invented human trigger. |
| `checkpoint.failed`, `server.start_failed`, `simulation.slow_tick` | Storage/start failures or a tick taking over 100 ms. Slow-tick warnings are limited to one per room per 30 seconds; these are diagnostics, not a capacity benchmark. |

A successful account HTTP response does not always establish a login.
`reason=session_established` marks a completed login. `activation_required` and
`takeover_confirmation_required` explain the intermediate states. Invalid logins
can remain anonymous: a submitted email address does not establish identity.

Logs use an allowlist of scalar metadata. Request/response bodies, raw URLs,
headers, account rows, password hashes, cookies, email fields, verification/reset
tokens and invitation codes are never serialized by the audit logger. Strings
are bounded and control characters removed. Display names and opaque identity
IDs are operational personal data; access belongs to the operator.

## Delayed combat and durability

The combat checkpoint keeps a small private `causes` map for pending heavy
projectiles. It carries the original actor/request through closure and restart;
public snapshots omit it. Completed projectile entries are removed. Old saves
without this additive field still load; their existing airborne attacks are
explicitly unattributed rather than assigned to the next person who joins.

Launch/objective logs in named campaigns are drained after the corresponding
SQLite commit. The legacy field labels these events `saved=false`. Logs themselves
are best-effort stdout, not a transactional audit database: a crash between commit
and stdout can omit a line, and external retention depends on the host. There is
no claim of exactly-once delivery or unlimited Fly log history. Cosmetic effects,
every bullet impact and every enemy kill are deliberately outside the event set.

## Rehearsal

Locally, watch `pnpm dev`. After an approved deployment, watch:

```sh
mise exec -- flyctl logs -a comp4020-final-jnheinrich451-eng
```

Two classmates start from the URL in separate profiles. One registers a Demo
account, activates it in the private simulated inbox, selects Caldera, creates
and opens a campaign, then uses **Room → Create invitation code**. They share the
code with the other participant, who joins from the lobby. The author only
watches logs. Narrate identities, core/foundation deployment, exclusive control,
objective damage and departure; compare the narration with their actual actions.
The real classroom exercise has not been performed at this checkpoint.

The browser timing test uses disposable saves and one Node observer clock. It
measures the real command-to-peer-HUD path and waits through a canvas frame and
another paint opportunity. It records every peer in two- and four-person rooms,
including intentional HE flight time for objective samples. Setup uses a ready
tank, flat terrain and disabled reinforcements, so it is a synchronization check,
not sustained combat/resource evidence. Cold starts and internet latency are
excluded. JSON timings, redacted events and screenshots are Playwright artifacts.

Run `pnpm exec playwright test tests/browser/multiplayer-latency.spec.js` for that
local check; see [stage evidence](CRIT_9_10_EVIDENCE.md) for recorded results.

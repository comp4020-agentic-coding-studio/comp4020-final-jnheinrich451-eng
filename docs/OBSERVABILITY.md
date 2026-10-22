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
| `request.received`, `request.received.summary` | Mutating HTTP request arrived, before authentication. Identity is intentionally anonymous at this stage; correlate its request ID with dispatch/result. Frequent controls summarize every five seconds. |
| `action.received`, `action.received.summary` | Authenticated game/campaign dispatch, before rule acceptance. Includes the server-derived actor; game commands also include controlled unit and command. Early authentication/body/origin failures may have only arrival plus a denied result. |
| `action.result` | Action path, actor, status, accepted/denied outcome, duration and relevant object ID. Deployment includes coordinates. Rejections include the server's reason. |
| `state.snapshot` | A per-user initial HTTP world response finished writing, or the initial SSE snapshot was queued. Includes actor/pilot, room, transport and revision. This is not a browser receipt/display acknowledgement. |
| `state.broadcast`, `state.broadcast.summary` | First active broadcast immediately, then five-second room summaries: revision range, broadcast count, queued writes, skipped slow/closed streams and latest connected-player/stream counts. Empty broadcasts are omitted. |
| `server.started`, `server.stopped` | Listening and successful graceful shutdown. Every record includes build, machine and process-instance identity. A crash need not emit a stopped event. |
| `campaign.*`, `participant.*` | Open/close, owner connection, reconnect freeze, teammate admission resume, individual connection/leave and migration. Closure success follows saving. |
| `weapon.launched` | Accepted HE cannon shot, artillery/naval shell or missile/bomber barrage, with originating request, actor and source mount or firing pilot. |
| `objective.damaged`, `objective.conquered` | Projectile and request that caused the changed site HP. Named-world events emit after the checkpoint commits. |
| `activity.summary` | Five-second grouping of movement and rapid-fire commands by actor/pilot, room, unit, semantic command, status and reason. Count replaces per-input lines; request ID/duration describe the last request in the group. |
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

Locally, watch the terminal running `pnpm dev`. For the deployed app, open a
terminal in the repository with access to the Fly account and run:

```sh
mise exec -- flyctl logs -a comp4020-final-jnheinrich451-eng
```

Keep that terminal open while participants use the deployed URL; Ctrl+C stops
watching logs without stopping the game. This reads the deployed server's
stdout, not the local development server. No game code change is needed to
watch the stream.

Browser developer tools (F12) serve a different purpose: **Console** shows
browser-side messages and errors, and **Network** shows that browser's requests
and event stream. They do not expose the server's shared activity log.

Read `name`/`actorId`, `campaignId`, `action`, `outcome` and `reason` together to
explain who did what and why a submitted action was refused. Movement and
rapid-fire summaries arrive in five-second groups, so these updates can appear
in batches. A disabled interface button sends no request and therefore produces
no server rejection event; inspect its displayed reason and browser state too.

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

## Readable control-level logs — 19 October

For the [Crit 10 narration exercise](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/crits/10-fly-by-instruments/), world actions now add a server-derived
unit type/ID, body type, control mode and current state. A readable `command` and
`message` accompany the existing action path, validated identity, room and outcome.
Successful boarding/exit/remote-control changes include the resulting unit. A
denied takeover never claims the player acquired control. Client-supplied unit
names and identities are not trusted as that state.

Examples of commands (illustrations, not classroom evidence):

- Robot/tank/recycler/helicopter: `move north`, `move south-east`, `stop movement`.
- Ship: `forward; turn left` or `reverse; hold heading`.
- Fixed-wing aircraft: `accelerate; turn right` or `decelerate; hold heading`.
- Pointer: `aim east`; cannon: `traverse left; raise barrel`; missile area rotation.
- Weapons: `fire HE cannon`, `charge magnetic cannon`, `fire laser rifle`,
  `launch missiles / gas`, `fire rocket pods`, `drop heavy HE bombs`.
- Air orders identify the commanded aircraft separately from the robot issuing
  them. Automatic defense retains its system/source attribution.

These describe submitted game commands, with accepted/denied outcomes. Accepted
movement does not prove displacement through an obstacle; aim direction does not
prove the slower turret has finished rotating. A shot can come from a mouse,
keyboard or touch control, so logs do not invent a physical button press.
Magnetic charging is distinct from releasing a shot. Existing correlated
`weapon.launched` / objective events provide evidence for delayed heavy attacks.

High-rate requests still summarize every five seconds, grouped by actor/pilot,
room, unit, command, outcome and reason. Different directions, weapons and units
cannot overwrite one another. Groups can overlap in time: firstAt/lastAt bound
the group; requestId, target coordinates and durationMs describe its last request.
Count means requests, not seconds moving or projectiles fired. This is not a
complete chronological keystroke replay. Credentials and raw bodies stay excluded.

For a concise terminal view, from the repository run:

```powershell
mise exec -- flyctl logs -a comp4020-final-jnheinrich451-eng | node scripts/read-logs.mjs
```

If flyctl is already on PATH, omit `mise exec --`. The formatter accepts plain
JSON and Fly-prefixed lines. It retains name plus an identity prefix, room, unit,
command, outcome, counts and refusal reasons. Full IDs, timing and coordinates
remain in the original JSON stream; omit the pipe to see it. Unknown/non-audit
lines are ignored, so use the unfiltered stream for startup/runtime diagnostics.

These changes need deployment before they appear in Fly logs. The real two-person
classroom rehearsal and its findings remain pending; local tests do not replace it.

## Whiteboard instrumentation - 22 October

The arrival, dispatch, snapshot, broadcast and startup records above are now
implemented locally. `participant.joined` identifies room admission; lifecycle
events distinguish admitted participants from connected players and open streams.
Two tabs can mean one player and two streams. Named-room and legacy disconnects
are logged; closing one of several streams does not falsely report a departure.

`machineId` comes from Fly's server environment (`local` outside Fly), `instanceId`
is newly generated for each application instance, and `buildId` is the current
server/client fingerprint. Together they distinguish a restart from a reconnect.
`runtimeId` changes each time a world runtime opens. Interpret revisions within
that runtime: reopening the same campaign can restart its revision counter even
without restarting the process. Broadcast summaries never merge those runtimes.
Snapshots contain only metadata in the logs, not world data, credentials or
private account state. Successful ordinary GETs remain quiet except `/world`.

For a broadcast summary, `count` counts broadcasts and `queuedWrites` counts
stream writes across the window. `connections` and `connectedPlayers` describe
the last broadcast, not totals across the window. `droppedStreams` counts skipped
write attempts to closed or excessively buffered streams. A `write()` returning
false still accepted the data into Node's buffer: it is counted as queued, not
delivered to the browser. The existing buffer cutoff disconnects slow consumers.

Frequent receipts, dispatches and results are separate bounded summaries. Their
last request IDs identify the last request in each group; `firstAt` and `lastAt`
are time bounds. They do not form a complete keystroke replay, and a crash can
lose an unflushed five-second summary. Receipt does not mean permission or
success. Account endpoint arrivals are recorded before authentication; their
existing result records establish identity only where authentication succeeds.

Use the existing raw Fly log command for evidence; the optional readable formatter
now preserves event names, revisions, counts and machine/instance/build IDs.
The implementation still has one authoritative process. These logs help expose
separate-machine failures; they do not provide replication or room routing.

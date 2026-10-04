# First world: implementation and review record

Date: 2026-10-01. Scope: the first playable world preview requested after selecting
pure overhead 2D projection and square tiles. This is an implementation record,
not the author's personal PROCESS.md or crit reflection.

This file records the original baseline. The subsequent fullscreen layout and
first combat drill are documented in [FIRST_COMBAT.md](FIRST_COMBAT.md).
The preview images now show that newer stage; resource numbers below apply only
to the original exploration stage.

## What is implemented

- One fixed 48 by 36 map with a mainland, offshore island, sand, grass, water,
  rocks, and a reserved landing pad. The original terrain is stored in SQLite.
- A browser-bound guest scout, keyboard/touch movement, click-to-move routing,
  camera panning, zoom, tile inspection, minimap, and a building placement mode.
- One foundation type, free placement, a 60-foundation world limit, and removal
  restricted to the placing guest. Movement and placement are server-validated.
- Shared updates using server-sent events; actions use HTTP POST. All visitors
  currently share one test world. Host-owned/private rooms are not implemented.
- Building commits occur before acknowledgement. Movement checkpoints every
  500 ms and on disconnect; a crash can lose movement since the last checkpoint.
- The robot is represented by a temporary rover sprite. No combat or economy.

## Initial technical decision

Use a small Node HTTP server, built-in SQLite, and browser Canvas 2D. There are no
runtime npm dependencies. This keeps the first server measurable under the
course limit and avoids choosing a larger engine before there is playable work.
The existing TypeScript/Vitest harness remains, with Playwright added for browser
checks. Docker uses the course's Node 24.21.0; the installed Windows Node is 26.5.1.

The server owns movement and construction. Browsers interpolate visual positions
and render the world locally. SSE is enough for this first stage; input requests
and snapshots will need reevaluation before high-frequency combat. This is not a
promise that this transport or architecture will be retained for every later stage.

Local user saves: `.local/data/world.sqlite`. Docker/Fly saves: `/data/world.sqlite`.
Tests use separate temporary directories. Nothing in the verification resets the
regular local world. Selected Kenney files are tracked under public/assets/kenney;
their license and hashes are included. The ignored source library is not needed
to start or build the app.

## Verification

- `pnpm check`: TypeScript check and five tests in three files passed. Includes
  the untouched course invariants, terrain/routing rules, competing placements,
  ownership enforcement, cross-origin write rejection, and a database reopen.
- `pnpm test:browser`: two tests passed using installed Chrome. Exercised separate
  browser identities, shared foundation updates, keyboard movement, reload,
  invalid water placement, desktop-to-phone resizing, and touch placement/removal.
- Screenshots inspected: [desktop](previews/desktop.png) at 1920x1080 and
  [phone](previews/mobile.png) at 390x844. These are actual test-world screenshots;
  their placed foundation is test data, not a prefilled user world.
- Docker image built from the selected runtime files. A short exploration check
  ran with 256 MiB RAM, no additional swap allowance, and a 5000/80000 CPU quota.
  Four simulated guests made 400 movement requests in 20 seconds; the observed
  local response median was 15 ms and p95 was 26 ms, with 822 received stream
  chunks. Container memory sampled after the run was 22.54 MiB; this is not peak
  memory. It reported no OOM kill. Run `node scripts/check-runtime.mjs` against a
  separate test container to repeat; APP_URL defaults to http://localhost:8083.

These local results are not a Fly latency measurement or sustained combat-capacity
proof. They include no enemies, projectiles, hazards, or multiple rooms. The
Docker quota approximates a sustained CPU allowance but does not reproduce Fly's
burst balance, neighbours, network, or machine OS memory overhead.

## Outstanding course evidence

`pnpm check:evidence` currently fails because PROCESS.md is still the supplied
template (including its example commit links) and there is no crit reflection.
The author must supply their own account before submission. No reflection, commit,
public deployment, or successful full submission is claimed here.

## Next review

Play the island and assess map scale, coastline shape, controls, building workflow,
and art consistency. Record that feedback before adding the first enemy and weapon.

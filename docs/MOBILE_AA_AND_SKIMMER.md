# Mobile AA and skimmer — 31 October 2026

The author approved an XM246-inspired tracked AA vehicle and the first flying
enemy together. This replaces the earlier proposal to anchor the AA before
engaging aircraft. Both weapons work while driving. Implemented locally; balance
still needs the author's playtest and this stage does not claim a Fly deployment.

## Driving and firing

Deploy **AA vehicle** from **B → Ground**, for **120 ORB** or **30 GND** with local
construction support. It shares the tank's five-tile pod, 200 HP, heading-relative
driving, boarding, helicopter sling, transport and paid-wreck recovery rules.
Existing tanks retain their weapons and saved records.

- **W/S:** forward and reverse. **A/D:** steer the tracked hull.
- **Hold LMB:** twin 35 mm guns alternate one 20-damage round every 125 ms,
  up to 26 tiles. Space and the phone's fire button support the same held fire.
- **RMB:** the tank's existing ground APCR machine gun. This also keeps the turret
  on the raw ground aim point while held.
- **E:** board or exit. The fixed AA loadout does not use the tank's 1/2 switching.

The cursor always remains where the player places it. A separate solution selects
a living flyer within 2.4 tiles of the cursor (3 tiles to retain the current
contact), predicts its movement, and turns the turret toward that point. Moving
the cursor away returns to ground aim. The AIR / LEAD marker shows the solution;
the small bearing marker exposes actual turret lag. The server validates targets,
traverses the turret and fires along its real bearing. It does not bend bullets
or grant a hit merely because a target was selected.

Rounds travel at 70 tiles/second. Driving adds a small spread; stopping tightens
it. Ground rounds collide with ordinary terrain and ground enemies. Air rounds
ignore low ground objects and bodies, but mountain ridges still block them.
The twin barrels, radar, recoil, muzzle flashes and brief tracers are cosmetic.
Shots use the existing shared 64-projectile capacity; cosmetic effects cannot
apply extra damage.

An operational, stationary, unoccupied AA defends itself automatically, preferring
visible air targets, then suitable ground targets. It does not fire while being
carried or constructed. Boarding takes over without resetting the hull's reload.
Ordinary tanks and ground sentries do not waste fire on air targets. The robot's
RMB laser is a fallback against flyers, including while its robot is guarding.
AA35 is not a heavy armor counter: Bulwarks retain their HE/MAGNETIC/MAC rule.

The AA's bottom controls form one centered stack: the Exit stripe and loadout
panel share the action bar's width. On desktop, the action buttons determine that
width and the longer hint/description wraps inside it. Deploy's B/chevron sits
at the right inner edge; phones retain their viewport-fitting width.

## First flying enemy: skimmer

The skimmer now follows the author's manta sketch: two broad membranous wings,
a sharp nose, thin tentacle tails, three round bloodshot eyes and three veined
yellow bile sacs under a red-purple body. Slow wing flex gives it a gliding pose;
the slender tails keep their shape. Reduced motion freezes the pose. A separate
ground shadow and AIR label identify its height.
Its authoritative position remains a 2D coordinate with an explicit air
domain. Its visible body matches that hit position; height offsets only the
shadow, so both AA and robot laser aim meet the silhouette. It flies over low
obstacles and inland water, stays on its home island, and cannot cross ocean or
mountain chains. Movement uses a bounded local steering search.

It detects robots and ground vehicles, including the recycler and bridge builder,
then approaches, marks a predicted ground impact, fires, and circles during its
cooldown. The marked point stays fixed so the player can evade it. Starting values
are 180 HP, 3.5 tiles/second, 18-tile detection, 8-tile firing reach, a 1.2-second
warning, 0.25-second shot flight, and a 4-second cooldown. The attack deals 20
damage within 1.2 tiles. Occupants are not hit again as separate exposed robots.

The three sacs charge together and release three cosmetic droplets into the same
marked impact. This is one attack and one damage application, not three damaging
projectiles. Red ground warnings remain visible; yellow bile streaks and a brief
splash distinguish the strike from gunfire. The splash leaves no lingering poison
field. The released shot records its launch angle for consistent outlet positions
after a reconnect; older shots without that field render from their saved center.

Actual facilities, ships, submarines and friendly aircraft are excluded from its
damage targets. Ground explosions, MAC/magnetic shots, ordinary bullets and
fire/gas fields cannot damage it or be intercepted by it. AA35 and the robot
laser, including attached laser burn, can. A kill over land leaves the existing
8-unit remains salvage; water kills do not create land salvage.

## Subsequent defense stage: stationary AA sentry

The author approved the fixed sentry with an explicit air-only restriction.
It is now implemented locally as **G-05 / AA sentry**: 80 ORB or 20 GND, 140 HP,
26-tile coverage, alternating twin 35 mm barrels. It automatically protects nearby
robots and ground vehicles, never targets ground enemies, and has no weapon-mode
switch. Existing APCR/fuel sentries and parked mobile AAs retain their own roles.

The [sentry and co-op stage](AA_SENTRY_AND_COOP.md) records its deployment,
persistence, local validation and rehearsal evidence. Skimmers remain
air-to-ground attackers; no air-to-air combat or aerial facility damage is added.

## Production, persistence and limits

Near an active ground player, every third ordinary city replenishment group can
substitute one skimmer into its roster. This uses existing hostile compounds,
the existing island scaling and replenishment credit, and the shared 24 active
plus reserved enemy budget. It creates no extra free wave. Four skimmers at most
are counted across live bodies, sleepers and pending warnings; at most eight
skimmer attacks can be in flight. Cleared-land roaming stays ground-only.

Existing campaigns keep their terrain, buildings, vehicles and conquest. Surviving
hostile compounds can produce the new enemy without resetting a world. Final
planetary conquest cancels new arrivals and keeps survivors to clear. Released
shots still resolve. Killing a skimmer interrupts its attack before release.

Enemy phases, fixed warning points, cooldowns, released attacks and AA projectile
trajectories use the existing combat checkpoint. Accepted projectiles survive
restart and cannot hit twice. Disconnect clears transient human aim/held input;
it does not duplicate a shot. Target-domain filters keep overhead enemies out of
ground placement, exit and navigation occupancy checks.

## Alternating fire and tracer refinement

The author requested alternating barrels, continuous held fire and short blinking
tracer samples. The former simultaneous pair (40 damage every 250 ms) becomes
one 20-damage round every 125 ms: nominal output remains eight rounds / 160 damage
per second before misses and armor. Manual and automatic AA share the hull's
cooldown and saved next-barrel index. Releasing the trigger does not queue a later
burst. Ordinary tank firing and the AA's RMB weapon retain their behavior.

An initial click fires once. Fresh input heartbeats sustain firing on the server,
with a 400 ms lease and an increasing sequence to reject old packets arriving
after a release. Pause, disconnect, body changes and restart do not preserve held
intent. The 100 ms simulation tick preserves the 125 ms firing schedule instead
of rounding every shot to 200 ms; catch-up is bounded to two shots per tick, with
no backlog across a long stall or interruption. Accepted rounds still fly and
resolve normally. Logs distinguish holding/releasing the AA trigger and summarize
accepted rounds.

Each existing, server-clipped flight segment produces at most three short .22-tile
dashes, lighting sequentially and fading. Their coordinates stay inside the
segment, with the original shot bearing, so they cannot bend with the turret or
continue beyond the hit point. Reduced motion uses one stationary fade. A 100 ms
AA-only visual buffer preserves alternating muzzle timestamps delivered in a
single snapshot. Muzzle flashes alone trigger barrel recoil. The existing effect
cap remains 24, and dashes add no network messages, projectiles or collision work.

## Verification

New checks are in `spec/target-domain.test.ts`, `spec/aerial-enemy.test.ts`,
`spec/aa-combat.test.ts`, `spec/aa-deployment.test.ts` and
`tests/browser/aa-vehicle.spec.js`. They cover actual combat integration, moving
fire, aim release, collision layers, immunity, guard takeover, deployment costs,
persistence, salvage, city production, caps, conquest and desktop/phone controls.

- Initial AA stage `pnpm check`: typecheck and **1,018 tests / 128 files passed**, exit code 0.
  Local evidence: `.local/aa-verified-check.log`.
- `pnpm exec playwright test tests/browser/aa-vehicle.spec.js --config=.local/aa-playwright.config.mjs`:
  **2 passed**, desktop and phone. The local configuration disables the unrelated
  shared web server; these tests each start and close their own isolated app.
- Typecheck and both browser cases passed again after aligning the visible flyer
  with its hit position. Desktop/phone firing screenshots were visually inspected.

The existing catalogue assertion was extended with the new G-04 AA card while
preserving the prior asset codes. Automated checks are not evidence of final
combat balance or sustained Fly capacity. No player save was reset.

Alternating-fire follow-up: `pnpm check` passed typecheck and **1,031 tests across
129 files**, exit 0 (`.local/aa-cadence-check.log`). This includes exact 125 ms
cadence through 100 ms ticks, shared reload and alternating barrels, clipped
tracer bounds, unchanged nominal damage, stale input rejection, lease expiry,
disconnect/restart and bounded stall recovery. Desktop and phone browser checks
passed **2/2**, including actual held mouse/touch input, one initial fire request,
release, Space and focus loss. Isolated screenshots and log are under
`.local/aa-cadence-browser/` and `.local/aa-cadence-browser.log`; both sizes were
visually reviewed. Browser validation used `--output=.local/aa-cadence-browser`
to preserve evidence alongside another ongoing visual task.

Manta art follow-up: typecheck and the **34 focused aerial/AA/target-domain tests**
passed. The existing restart check also verifies that one released shot preserves
its launch orientation and still applies damage only once. Desktop **1920×1080**
and phone **390×844** browser cases passed; screenshots were visually reviewed.
The production canvas renderer was also inspected enlarged, at ordinary zoom,
rotated and with reduced motion, including warning, flight and aged impact states.
The preview exercises legacy shots without a launch angle as well. Evidence:
`.local/manta-art-preview.png`, `.local/manta-art-preview.log`,
`.local/manta-typecheck.log`, `.local/manta-tests.log`, `.local/manta-browser.log`
and `.local/manta-desktop.log`; game screenshots are under
`.local/manta-aa-browser/` and `.local/manta-aa-desktop/`.
These are local checks, not a new multiplayer load benchmark or deployment.

AA control alignment follow-up: the existing desktop/phone browser checks passed
**2/2** (`.local/aa-bar-alignment-browser.log`), and both screenshots were reviewed.
A production HTML/CSS geometry inspection confirmed matching left/right edges
for all three bars, horizontal centering and visible weapon text through desktop,
phone and intermediate resize states (`.local/aa-bar-geometry-review.json`).

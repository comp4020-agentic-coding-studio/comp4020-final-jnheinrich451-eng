# Siege centipede — first playable version

## Agreed direction

On 31 October 2026 the author approved building a first version, then refining
the wider system through play. The giant is a slow surface-dwelling centipede
that prefers friendly facilities and produces ordinary land enemies. Only a
living Blight Root can produce it. Burrowing and a universal armor/penetration
redesign are outside this stage.

## Current local behavior

| Property | Initial value |
| --- | --- |
| Health | 2,400 shared HP |
| Body | Eight parts, 0.75 tiles apart; 5.25 tiles from head to tail center |
| Movement | 0.5 tiles/second; body follows the head's actual ground route |
| Attack | 120 damage, penetration 3, 1.8-tile reach |
| Strike warning | 2.2 seconds at a fixed ground point; then 3.5-second cooldown |
| Facility sensing | Visible targets within 24 tiles; retained within 32 |
| Protection | Existing Bulwark rule: HE, magnetic cannon and MAC can damage it |
| Corpse salvage | 80 raw salvage |

This is provisional tuning for author playtesting. It is not a new numeric
armor formula. Fire/gas, small bullets and the robot laser do not bypass its
heavy protection; the art and label identify its heavy-weapon role. Existing
weapon profiles retain their damage. There are no separate segment health pools.

The centipede prefers visible damageable infrastructure, keeps that target when
a robot passes nearby, and routes to the facility edge. A blocked route backs
off. It can attack robots or ground vehicles when no facility is available.
The protected starting core remains excluded. Ordinary enemies keep their own
player preference and limited siege quota. Water, mountains, buildings and
vehicle clearance still constrain movement; no burrowing or teleporting occurs.

## Root and brood lifecycle

A hostile Blight Root within 36 tiles of an eligible same-island player becomes
eligible after 60 seconds of nearby active play. A legal full-body corridor,
shared capacity and island credit are required. It then shows a **10-second
emergence warning** at fixed coordinates. Occupancy, terrain, source and capacity
are rechecked before birth. A blocked warning cancels rather than moving the
spawn somewhere the player was not shown.

There is at most **one Root-born giant per source island and two across the planet**,
counting living, sleeping and pending giants. Death starts a 180-second active
replacement cooldown shared by Roots on that island. Another Root cannot bypass
the delay. Empty regions and closed rooms do not accumulate spawn backlogs.
Walking across a bridge does not free its original island's producer slot.

Every 20 seconds, an active giant may announce a two-second brood warning for
one or two offspring. Hunters are common; Breakers, Bulwarks, Twin Lenses and
Heavy Lenses rotate through the second slot. Capacity can reduce the batch.
At most four of its offspring may be living, sleeping or pending at once. It
never produces skimmers, aquatic units or another centipede.

The giant and its children share the existing **24 active-plus-reserved enemy
budget**, geographic quotas and island production credit. Co-op scaling is still
applied once by the island director. Brood admission also checks mobile-lens
limits. A full population defers production without deleting survivors or
banking a burst for later.

Surviving giants and brood also reduce further ordinary reinforcements from
their source compound. Six remains the ordinary producer's admission ceiling,
not a separate combined limit on a Root's ordinary defenders plus its brood.

Destroying the linked Root cancels unborn offspring and permanently disables
that giant's brood production. The giant and already-born children survive for
cleanup. Destroyed Roots never regenerate. Planetary conquest cancels all unborn
giants/broods, stops production and preserves living survivors and committed
attacks, matching the existing definite ending.

## Body, hits and saved state

One authoritative enemy ID owns eight body hit shapes. Direct rays and shells
can strike the tail; blast falloff uses the nearest part. Each blast damages
the creature once, and MAC penetration counts the entire body as one target.
An already-hit MAC round can finish crossing the body after restart without
dealing its damage again. Body occupancy also participates in deployment checks.

The head uses the shared bounded navigator with 0.42-tile clearance. A bounded
trail retains real travelled corners; body parts cannot shortcut walls. The
renderer uses these same saved parts, with cosmetic paired legs and armor
plates. Legacy/incomplete body records extend from their actual position rather
than inventing an unseen tail through obstacles.

Checkpoint state includes body/trail, shared HP, root identity, locked attacks,
brood deadlines/roster position, pending warning coordinates and replacement
cooldowns. Timers use simulation time. No terrain, existing facility, account or
campaign is reset. Existing hostile Roots can become eligible; conquered Roots
remain cleared. All new runtime modules are under `public/`, already included
by the Docker copy rule.

Death preserves the body as one recyclable corpse where pile capacity allows.
The existing 64-pile bound still applies: if full, its salvage transfers to an
existing pile instead of being lost. No payment is invented for an enemy.

## Verification

Focused combat, body and lifecycle checks cover tail hits, one-blast/one-creature
damage, MAC penetration across restart, facility priority, protected starting
cores, blocked paths, source loss, full populations, warning revalidation,
replacement cooldowns and salvage. The final `pnpm check` passed TypeScript and
**1,090 tests in 137 files**. The ordinary six-defender replenishment test now
uses a mortar source so it isolates that producer; a living Blight Root also
has the new giant/brood behavior, covered by the dedicated centipede checks.

`tests/browser/centipede.spec.js` passed twice with separate authenticated desktop
and emulated phone contexts in a disposable named campaign. Source readiness,
flat terrain and a friendly sentry are staged; the actual ten-second warning,
birth, body movement and siege damage run through production code. The final
run compared **78 matching body/HP/facility-health snapshots**, observed eight
body parts, preserved exact body/HP/root state in a paused checkpoint, and
re-entered after a local server restart with the same creature identity.
There were no browser errors. Screenshots were inspected at both viewport sizes.

The generated-layout probe checked six Caldera/Vesper layouts without flattening
terrain. All 253 sampled Roots had a legal full-body corridor. Two ordinary
director/guard runs, using a non-targetable synthetic presence contact, produced
natural warnings/births at 67.1/77.1 seconds on Caldera and 60.1/70.1 seconds on
Vesper without removing enemies. These demonstrate geometry and availability in
the sampled worlds, not encounter balance or sustained server capacity.

Evidence: [co-op observations](testing/evidence/2026-10-31/centipede-coop.json),
[generated-layout probe](testing/evidence/2026-10-31/centipede-layout.json),
[Root warning](testing/evidence/2026-10-31/centipede-root-warning-desktop.png),
[desktop siege](testing/evidence/2026-10-31/centipede-siege-desktop.png), and
[phone siege](testing/evidence/2026-10-31/centipede-siege-phone.png).
Reproduce layout checks with `node scripts/centipede-layout-probe.mjs`.
These are local automated results. Human balance feedback and deployed Fly
validation remain later work; no release is performed by this stage.

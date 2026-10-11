# Hostile territory and defensive response

11 October 2026. Implemented locally following the author's approval. These are
playtest values, not evidence of Fly capacity or deployment.

## Reading the battlefield

Red shading means hostile territory. It appears on the minimap, before orbital
deployment, and when zoomed out to 40% or below. It is not a weapon-range or
automatic detection boundary. Current territories are circles around individual
objectives: 11 tiles for the alert station and 10 for the mortar. Conquest removes
that site's shading permanently; another intact site's overlapping area remains.
Larger regions containing multiple required objectives are future work.

At closer zoom, locating a hostile structure shows thin, labelled range rings:
the mortar's 4–22 tile firing band or the scanner's 12-tile search range. The
scanner's moving pulse/tracking beam and bright incoming acid-impact circles
remain visible during combat. A mortar can shoot beyond its territory boundary.

## An attack raises the alarm

Damage to an enemy inside hostile territory, or an impact against its structure,
reports the attacked position. Empty misses do not alert a sector. The final hit
on a structure can still warn surviving neighbors; later attacks on conquered
ground cannot reactivate it. Fire/burning damage can sustain an existing alarm.

Reports reach intact facilities within 48 tiles of the originating site and
ground defenders within 12 tiles of the impact. This is a single hop, coalesced
to at most one report per originating site per second. Reports expire after
eight simulation seconds. They carry an impact location, never the distant
shooter's coordinates or a live target lock. There is no general movement-noise
network or recursive relay yet.

Defenders investigate subject to their existing home leash, fire avoidance and
gas attraction. For a blocked impact, they approach nearby walkable ground.
They acquire attackers through the existing sensing rules. An idle mortar may
turn toward a report within its reach, but still needs its own eligible target
before firing; it cannot shoot an arbitrary distant attacker through the relay.

Only intact alert stations call reinforcements. Eligible calls use safe ground
around the reported attack, with visible
burrowing warnings for 2.2 seconds. Existing constraints remain: two arrivals per
call, 12-second cadence, eight living defenders per station, 24 total, and pending
calls reserving population slots. Arrival positions are rechecked before spawning.
If the station has not activated yet, its three initial guards respond there
first, consuming that initial allocation rather than adding a bonus wave. Without
an attack report, initial guards emerge around their own structure as before.
The mortar has two initial guards and cannot summon replacement waves itself.

Reports, last-known investigations and pending arrival origins use the existing
combat checkpoint and simulation clock. Closing/pausing a campaign does not run
an offline catch-up battle. Existing terrain, equipment and completed objectives
are preserved. Structured `sector.alerted` events record the impact and originating
site; existing observability rules govern checkpoint-backed logging.

## Tank aiming in this stage

A valid battlefield aim beyond tank weapon range is accepted. HE travels up to
14 tiles and bursts there; shorter HE aim distances still work. APCR, magnetic
rounds and heavy fuel retain their own maximum travel distances. Actual turret
bearing, obstacles, charging, reload and projectile caps still apply. The desired
aim marker stays gold; the actual endpoint shows where the weapon can reach.
Naval/artillery-specific firing envelopes are unchanged.

## Verification

Domain checks cover impact-only reports, one-hop/coalescing limits, capped warned
reinforcements, permanent conquest, checkpoint restoration and finite memory,
walkable investigation points, all four tank weapons and obstacle interception.
Validation on 11 October: `pnpm check` passed all 228 tests in 39 files. Eight
selected desktop/phone browser scenarios passed across the mortar, scanner,
ground-weapons and tank-range suites. Older weapon fixtures were updated to
deploy cores and board tanks; phone range checks pan through the minimap using
the actual world dimensions. A transient native browser-worker crash passed on
rerun. These are local checks, not Fly performance measurements.

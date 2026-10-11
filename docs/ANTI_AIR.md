# Spore flak and bomber survival

11 October 2026. The first enemy anti-air stage follows the author's approved
order. The attack jet remains a subsequent playable stage.

## Combat purpose

The bomber can still cross terrain and drop HE, but repeatedly flying straight
through defended airspace has a consequence. Players can turn or change speed,
attack during the reload, or destroy the outpost with ground/naval artillery
before sending aircraft through it. This is a small playable encounter; numerical
balance and larger formations need author playtesting.

One 3-by-3 organic **Spore flak** outpost has 600 HP and two initial guards. It
uses the existing HE conquest rules. Destruction is permanent, cancels unlaunched
rounds and leaves surviving defenders and already launched rounds in the world.
It is not another scanner or reinforcement caller. **A** in the map controls
locates it; this is a button, not a new keyboard binding.

## Attack and counterplay

- Detect airborne bombers within 24 tiles, including takeoff and landing.
  Parked aircraft, robots, tanks and ships cannot receive flak damage. Aircraft
  above the ground are sensed through ground obstacles; terrain height and
  altitude layers are not implemented.
- Capture three predicted positions from the target's current heading/speed.
  Show the fixed burst circles immediately, wait 0.9 seconds, then launch three
  rounds 0.3 seconds apart. Each flies for 1.4 seconds. Prediction does not follow
  subsequent steering. The first impact gives 2.3 seconds from acquisition.
- Each airburst deals 40 damage once to each airborne plane within 1.8 tiles.
  A six-second cooldown follows the last launch. Prediction clamps to the map.
  At most 12 rounds are reserved globally across pending and airborne bursts,
  including short-lived visible impacts. No new per-projectile pathfinding.
- The pilot sees an incoming-flak HUD warning and hull health. Impact circles,
  tracers and fragments render below contamination fog, with reduced-effects
  support. The HUD warns about the incoming attack without revealing hidden
  outpost coordinates. Cosmetic particles remain client-side.

## Aircraft states and persistence

Old bombers default to 180 HP. Damage persists through return/restart. Ordinary
landing repairs the aircraft when its existing eight-second rearm completes.
At zero HP, flight and further bomb release stop. Previously released bombs
continue. The pilot leaves the seat and becomes disabled, then uses the existing
friendly-core robot recovery flow. This works for a temporarily disconnected
pilot as well as an active one; reconnect cannot restore the lost aircraft.

The original airbase prepares a replacement for 20 simulation seconds, then
provides an empty, fully repaired/rearmed bomber at its parking point. The timer
pauses with the campaign and resumes from saved state. Recovery and replacement
are free in this stage, consistent with the deferred economy. Replacement is not
instant boarding: the recovered robot must reach the airbase normally.

`airbases` retains health/state/timers; site state retains pending burst points
and cooldown. Combat checkpoints retain launched flak and consumed impacts.
Aircraft damage, consumed impacts and pilot loss are checkpointed together before
broadcast to prevent damage replay or a surviving pilot in a destroyed seat.

Named campaigns receive one additive `anti-air-v1` migration, with a SQLite
backup first. Placement avoids occupied terrain, previous sites, contamination
and existing runways. If no safe location exists, the marker records no placement;
it never replaces construction or resets conquest. Legacy worlds gain aircraft
HP but no automatic hostile outpost.

## Verification boundary

Domain checks cover fixed prediction and evasion, airborne-only damage, reserved
round caps, permanent HE conquest, accepted attacks after destruction, saved
timers, legacy checkpoints, repairs and replacement. Campaign migration checks
cover backups, existing terrain/construction, permanent conquest and restart.
The desktop/phone browser scenario uses a temporary campaign and real steering,
then a 40-HP fixture plane to test loss quickly, peer-visible destruction, saved
pilot recovery and replacement. It never edits the author's campaign.

Validation on 11 October: typecheck passed; 266 tests passed across the full
regression run and the focused campaign rerun after correcting a test's SQLite
column name. The final four browser checks passed: existing bomber loop and
anti-air/recovery, each at desktop and phone sizes. Screenshots were inspected:
[desktop flak](previews/anti-air-desktop.png),
[phone evasion](previews/anti-air-mobile.png), and
[phone recovery](previews/bomber-loss-mobile.png).
Screenshot review caught a mobile panel alignment issue with the longer warning;
an explicit parent width fixes it. Both anti-air browser checks passed again with
assertions that the panel fits the viewport and the hull readout remains visible.

This is local validation, not a sustained Fly air-combat capacity measurement.
Sound, aircraft wreck artwork, armor, fuel, airbase damage, extra aircraft types
and final balance are later work.

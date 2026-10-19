# Parked tank defence — 19 October 2026

Implemented locally. Sentries handle lighter enemies; a parked tank adds the HE
or magnetic damage needed against Bulwarks. This reuses deployed tanks, their
turret, weapons, projectiles, damage and reloads. It does not automate railway
cannons, missile batteries, ships or occupied vehicles.

## Player use

Drive a tank to a defensive position with clear firing lanes, select HE or Magnetic,
then disembark. The empty tank stays there, turns its turret and fires its selected
main weapon at nearby visible enemies. Its label reads **GUARD** or **ENGAGING**.
Boarding immediately takes priority and cancels any unfinished automatic magnetic
charge. Already fired projectiles continue normally. The secondary weapon remains
manual in this stage.

## Rules

- Prefer a visible Bulwark over an ordinary enemy; otherwise choose the nearest
  visible target and retain it until lost. Search at most twice per second per
  tank, with fresh validity checks while tracking.
- Use normal HE range (14 tiles), damage and 650 ms reload, or Magnetic range
  (24 tiles), one-second charge and 2.5-second post-charge reload. The turret keeps
  its existing 180 degrees/s rotation limit. No pursuit or hull movement.
- Rocks and solid structures block target acquisition and firing. Friendly
  structures remain immune to damage, but can obstruct the line of fire. Tanks
  do not independently select hostile facilities as targets.
- No automatic fire while occupied, including offline drivers; arriving, under
  construction, moving, carried or destroyed tanks are excluded. Loaded transport
  cargo is also absent from the active tank list.
- Automatic magnetic charges cancel on lost/obstructed targets or manual takeover.
  Reload belongs to the tank hull, so boarding, exiting or changing pilots cannot
  bypass it. Cancellation does not refund the charge/reload interval.
- Named campaign saves retain automatic charge progress, normal projectile state,
  weapon cooldowns and tank turret/guard state. Manual held charges continue to use
  the existing discard-on-restart rule. Empty rooms still pause.
- Existing tank, enemy, projectile and magnetic-charge caps apply. No extra worker
  or pathfinder and no additional ammo or supply cost beyond the current tank rules.

The values are unchanged weapon tuning, not a guarantee that one tank can defeat
every attack. Clear approaches, sentries and more than one defensive position
remain useful; parked tanks can themselves be destroyed.

## Verification

Focused tests cover actual Bulwark kills, turret timing, line of sight, priority,
charge restoration, reload handoff, interrupted charges and inactive vehicles.
Browser tests cover both weapons attacking autonomously, yielding on boarding,
resuming after exit and retaining the parked position on refresh.

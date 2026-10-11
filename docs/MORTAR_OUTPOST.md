# Corrosive-mortar outpost

11 October 2026. **Implemented locally.** Next playable enemy structure, following the author's request
to proceed after testing the alert station. Cleanup is recorded separately in
[ORBITAL_CLEANUP.md](ORBITAL_CLEANUP.md) and remains future work.

The subsequent [defensive-sector stage](DEFENSIVE_SECTORS.md) gives red shading a
territory meaning on the overview. Attacking this territory can alert a nearby
intact alert station, which may send reinforcements. The mortar itself still
has only its initial guards. Inspecting it at closer zoom shows its actual
firing-range rings; incoming impact warnings remain separate.

## Encounter

Approach a rooted biological launcher, see it turn and inflate a projectile sac,
then move out of the marked impact circle before its arcing acid shell lands.
Use HE to destroy the outpost permanently. Teammates can draw its attention while
another operates artillery. This extends the existing conquest loop without
waiting for the unresolved armor formula or facility destruction rules.

First tuning: a 3×3 solid core, 600 HP, two initial guards, no replacement waves.
Only alert stations call reinforcements. Its independent radial ground sensing
reaches 22 tiles, with a four-tile minimum firing range and 60°/second traverse.
It retains an eligible target, then locks a fixed ground point for a 0.8-second
windup and 2.2-second flight. The full danger circle is visible from windup onward.
Six-second reload followed by the next windup; at most eight airborne acid shells globally.

First targets/damage: active unprotected robots and operational tanks, including
parked tanks. Existing robot recovery and vehicle loss apply. No ship/aircraft or
friendly-facility damage is added in this pass. The single blast falls from 40
damage near its center to 12 at its 2.4-tile edge; a direct hit does not also apply
a second splash hit. No persistent acid damage pool or armor formula yet. Splash
is radial and the indirect attack crosses rocks; cover that stops the scanner
does not stop a mortar. Moving, closing inside minimum range and long-range HE
are the intended counters. Enemy attacks do not damage their own guards/sites.

## State and persistence

`idle -> turning -> windup -> fired/reloading`; destruction cancels an unfired
windup. Already airborne shells still land, even after conquest or save/reopen.
Shared simulation time owns warnings, damage, cooldowns and projectiles. Camera,
audio, player count and offline duration do not advance or duplicate attacks.

One additive outpost on existing Caldera terrain. Back up each named campaign
before attempting placement, avoid players, existing equipment and other sites,
and store a migration marker even if there is no safe space. Never overwrite a
base or regenerate a conquered outpost. Legacy field tests stay separate.

Use the existing rust chitin/purple tissue family, with an arched rotating tube,
swollen acid reservoir, segmented roots and a collapsed barrel ruin. Different
silhouette and labelled danger circles distinguish it from the sensory crown.
Temporary procedural artwork; audio and final texture polish remain later work.

In a named campaign, the map toolbar's **M / Locate mortar outpost** button centers
the camera and selects its objective readout. The original flag still locates the
alert station. An incoming-acid HUD warning supplements the labelled ground
circle on desktop and phone; essential warnings remain in reduced-motion mode.
Returning campaigns add the outpost on their next open. Crowded saves that cannot
fit one remain intact; the migration records that outcome without automatic retries.

## Acceptance

Check single damage application, dodgeable fixed targets, range/turn/cadence,
protected/invalid targets, one-time guards and global caps; retain old saves and
accepted airborne attacks across restart. Verify shared warnings and permanent
conquest in desktop/phone browsers. Treat balance and Fly capacity as unvalidated
until representative playtesting and measurement.

Local verification: `pnpm check` passed typechecking and 215 tests across 38
files. Six selected browser scenarios passed across the mortar, conquest and
scanner suites (desktop and phone). The mortar checks exercise shared warnings,
dodging, taking one 40-point hit, HE destruction and saved return; the phone run
also uses reduced motion. Browser fixtures suppress melee guards to isolate the
artillery loop; guard counts/caps are covered by simulation tests. The restart
test waits for room-close navigation before stopping its temporary server.
Screenshots were inspected at gameplay scale. No Fly deployment or load claim.

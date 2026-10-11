# Small alien settlement

11 October 2026. Second playable stage in the approved modifier → settlement →
anti-air → attack-jet sequence. Implemented locally; Fly validation is separate.

## Player loop

Use **S / Locate alien settlement** in the map controls to survey Ashfold colony.
Its checklist has Crown, Mortar and Root buttons that locate each structure.
Bring HE weapons, choose an approach and destroy all three in any order.
The crown calls warned defenders; the mortar pressures stationary positions;
the root paints the surrounding ground. Disabling the crown first reduces
reinforcements, while disabling the mortar first removes its bombardment.

The shared count progresses from 0/3 to 3/3. Only all three named structures
complete the settlement. Its overview/minimap marker then turns blue and stays
conquered. Surviving mobile enemies remain; completion does not grant immunity.
Adjacent independent hostile sites retain their own territory and behaviour.
Construction permissions remain global, subject to terrain and occupied footprints.

## State, boundaries and persistence

- One compound of three 3×3 structures, in a triangular layout with clear space
  between them. Existing HP and weapon rules apply: crown 420, mortar 600, root
  480; HE damages structures, other current weapons do not.
- Eight initial guards across the compound (3 + 2 + 3). Only the crown calls
  repeated reinforcements. Existing limits of eight defenders per site and 24
  living enemies globally still apply. Existing warning/cooldown/attack-report
  rules are reused; there is no second spawning simulation.
- Explicit membership and required IDs live in the existing combat checkpoint.
  Completion derives from those saved structures, so partial damage and conquest
  persist without a competing completion flag. A missing member cannot count as
  conquered. No recapture, regeneration, economy, loot or planetary-victory rule.
- One-time `alien-settlement-v1` migration backs up the campaign SQLite database,
  finds space for all three members, then commits their checkpoint and marker
  together. Existing objects, terrain and conquered sites are retained. Each
  footprint plus a one-tile margin must be clear; player deployments/occupants
  have a 26-tile buffer. If no safe compound fits, add none and record that result.
  Do not delete the marker or reset a campaign merely to force placement.
- The colony ring is an objective boundary, not a weapon/detection range. Actual
  sensor and mortar ranges remain individual. Close inspection shows those
  ranges; the red colony contribution appears only in overview/orbital views.
  Root connections are cosmetic and create no collision or server entities.
- New colony structures reuse existing outcome logs and projectile attribution.
  Persisted objective outcomes remain the evidence; artwork is client-side.

## Review and checks

Domain checks cover safe all-or-nothing placement on actual Caldera terrain,
full-HP HE conquest, missing-member handling, checkpoint restoration, capped
defence sharing and surviving defenders. Campaign checks cover backed-up additive
migration, partial completion and restart idempotence. Desktop/phone browser
checks use one-hit structures to isolate checklist transitions, a second client's
shared state, saved outcomes and completed progress after a server restart.

Local validation: `pnpm check` passed 237 tests across 41 files. Both settlement
browser checks passed (1920×1080 and 390×844), including desktop keyboard access,
resize and phone touch access. Four existing modifier/mortar browser checks also
passed. Screenshot review found the new locator overlapping the phone machine-gun
control; the phone map toolbar now uses two columns, with the corrected layout
verified in the settlement checks. These are local correctness checks, not a Fly
load or capacity result.

Review approach routes and the difficulty of combining these existing defences.
The next component is an anti-air facility, then the attack jet. Aircraft damage,
loss/recovery and counterplay need a bounded stage before enabling anti-air.

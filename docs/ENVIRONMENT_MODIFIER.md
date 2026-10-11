# Environment modifier: Blight root

11 October 2026. First playable stage in the author's approved order:
environment modifier → small alien settlement → anti-air facility → attack jet.
Review each playable addition before expanding the next encounter. The modifier
is implemented locally; the following stages have not yet been built.

## Encounter and result

Use **Locate environment modifier** (the B button in the map controls) to inspect
a rooted rosette surrounded by rust-purple ground, pale veins and small pores.
This button is separate from the B keyboard shortcut for player deployment.
Approach, fight its guards, bring an HE platform and destroy the central root.
The objective's red territory disappears permanently. Its alien ground fades
over six simulation seconds, revealing the original terrain; reduced-effects mode
removes the coating immediately. The shriveled central ruin remains visible and
becomes walkable/buildable. Orbital ruin cleanup is still a separate future unit.

The modifier's role in this first pass is a visible environmental conquest
objective. It does not damage players, slow them, buff defenders, spread across
the planet, or grant resources. Such mechanics need a later playable decision.

## Initial tuning and reusable rules

- One 3×3 solid modifier, 480 HP, three initial guards, no replacement waves.
- Fixed, irregular converted patch within nine tiles; hostile overview radius
  twelve tiles. Converted appearance and hostile territory are distinct overlays.
- HE delivery platforms share the existing structure damage resolver. Robot
  weapons, APCR, magnetic rounds, fuel, gas and incendiary effects do not gain
  structure damage in this stage.
- Initial guards use the shared warning, safe-arrival and population limits.
  The modifier has no scanner or offensive weapon. Only alert stations summon
  reinforcements; an attack in the modifier's territory can notify one nearby.
- Partial HP, guards, pending arrivals, alerts and permanent conquest use the
  existing authoritative campaign checkpoint. Accepted combat and outcomes are
  shared between players. There is no second player-dependent spawn allocation.

## Terrain and runtime boundaries

Original terrain cells remain unchanged. The coating is a deterministic client
layer on grass/sand, drawn below facilities, rails, pods, units and combat marks.
Water, rock and metal-floor cells are excluded. The actual core alone occupies
the existing 3×3 hostile footprint. Pathfinding, height and deployment rules use
their previous terrain/collision data. Buildings can still be deployed globally.

A cached 672×672 canvas holds the patch, approximately 1.8 MB of raw pixel data
per modifier cache on the client. No server-side texture or per-cell
growth simulation is added. The cache is released after recovery; the server
stores the site record and conquest timestamp. Paused/offline time does not
advance the recovery animation. These bounds are not a Fly capacity measurement.

## Existing campaigns

The `environment-modifier-v1` migration backs up the SQLite campaign before
adding the site. It selects clear ground away from existing sites, saved players
and equipment, preserves terrain and completed objectives, and commits the
checkpoint and migration marker together. If no safe site fits, it records that
outcome rather than overwriting construction or retrying every room entry.
Legacy rehearsal worlds are unchanged. No world reset or Fly deployment occurs.

## Checks

`pnpm check` passed 233 tests in 40 files. Coverage includes deterministic bounded
terrain appearance data, unchanged movement/terrain, safe placement, initial-only
guards, population caps, HE-only damage, partial-save restoration, conquest,
recovery and one-time backed-up migration. Four selected desktop/phone browser
scenarios passed across the modifier and mortar suites, covering shared completion,
screenshots before/after recovery, restart persistence and existing mortar behavior.
The modifier artwork received a subsequent visual-review pass and browser recheck.

## Next stage

Build a small settlement from an alert station, mortar and modifier. Proposed
completion: permanently destroy its named required structures; surviving mobile
enemies remain. Review the modifier's appearance and encounter first, then set
the compound layout and required objective list. Anti-air follows that combined
encounter, then an attack jet reusing the airbase and flight framework.

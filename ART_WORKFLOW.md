# Art workflow and initial asset shortlist

Status: pure overhead 2D projection and square tiles selected by the user on
2026-10-01. Individual assets and the remaining workflow are proposals.
GAME_IDEAS.md remains the design brainstorm. The source library stays ignored
under assets/.

## Accepted camera and grid

- Use pure overhead 2D projection, not isometric artwork or an angled camera.
- Use square terrain tiles. Grid-based terrain does not require grid-stepped
  vehicle movement: units may move continuously over the map.
- Produce units stage by stage, with headings represented by rotation in the
  overhead plane. Keep hulls, turrets, and shadows separate where needed.
- Topdown Tanks Remastered is the proposed initial style reference. Check other
  packs in a representative scene before adopting them.
- Sketch Desert and the isometric packs below remain inspected references; their
  angled sprites are not candidates for direct use in the overhead battlefield.

## Shortlist from inspected local previews

All paths below are relative to assets/2D assets/. Preview inspection establishes
candidate suitability only; it does not establish in-game compatibility.

| Pack | Potential role | Observed fit or gap |
| --- | --- | --- |
| Topdown Tanks Remastered | Tanks, turrets, projectiles, terrain, effects | Strong overhead baseline; separate vehicle parts and editable vector source. |
| Topdown Shooter | Ground characters and environmental pieces | Overhead candidate; robot identity and scale still need work. |
| Pirate Pack | Water, coast, wakes, naval placeholder | Overhead perspective is useful, but sailing ships are not final modern warships. Contains vector sources. |
| RTS Sci-fi | Facilities, vehicles, terrain reference | Useful industrial shapes; visibly angled objects need checking against the chosen camera. |
| Simple Space | Aircraft silhouette experiments, effects | Overhead spacecraft-like shapes; not an existing bomber, attack aircraft, or gunship set. Contains vector sources. |
| Sketch Desert | Raised terrain, ramps, water and scenery | Strong fixed-isometric candidate; incompatible with overhead units without adaptation. |
| Isometric Watercraft | Naval units for an isometric route | Angled vessels include a turreted craft; not a complete carrier/battleship set. |
| Isometric Tower Defense | Defensive structures for an isometric route | Angled towers and terrain; needs palette and proportion checks beside Sketch Desert. |
| Isometric Tiles Vehicles | Directional-sprite reference | Preview explicitly shows eight directions; primarily civilian vehicles. |

License files checked for Pirate Pack, Topdown Tanks Remastered, RTS Sci-fi,
Simple Space, Isometric Watercraft, Isometric Tower Defense, and Sketch Desert
identify CC0. Verify the actual source file and license for every exported asset;
do not infer a library-wide license from these examples.

The 3D Space Kit and Watercraft Pack also contain Models directories. Their model
contents, formats, suitability, and licenses have not been audited here. They are
possible inputs to an offline overhead rendering workflow if later needed, not
approved game dependencies. This would not change the game's 2D projection.

## Build, inspect, accept or reject

1. Write a brief art contract: camera, palette, outline weight, shading/light
   direction, world scale, team markings, and transparent padding/anchor rules.
   Choose a visual size hierarchy; ships must read as ships without making robots
   invisible. Do not require literal real-world scale.
2. Make one visual comparison scene containing land, coast, robot, tank, aircraft,
   ship, tower, and an explosion. Missing assets can be labelled silhouettes.
   Check at desktop and phone sizes. Keep this separate from production gameplay.
3. Give each candidate a disposition: reuse, adapt, create, or defer. Perspective
   and silhouette mismatches come before palette adjustments. Do not recolour the
   entire library or edit source packs in place.
4. Prepare only stage-one assets: minimal terrain, player, enemy, one weapon,
   one turret, projectile, and impact effect. Keep later forces represented in
   the comparison scene so the chosen style can accommodate them.
5. Create the smallest missing set. Editable SVG parts
   are a candidate for robot, aircraft, ship hull, deck, and turret artwork.
   Retain those sources and export PNGs or an atlas for the game.
6. Put candidates into actual gameplay. Test rotation, selection, overlap,
   recognisable silhouettes, team identification without colour alone, and effect
   readability. Reject art that looks good in isolation but obscures play.
7. Promote accepted files into tracked source/runtime folders. Preserve source
   path, author, license, modifications, export settings, logical size, and anchor
   in an asset manifest. Copy relevant license files alongside the selected set.
8. Repeat for the next playable force. A completed visual scene is not a reason
   to produce every planned unit before the first multiplayer baseline works.

## Practical boundaries

- Production must build from tracked files; ignored assets/ is a local library,
  not a runtime dependency. Choose final export paths with the application stack.
- Do not ship every source PNG, alternate format, and unused colour variant.
- Raster art generation may help concept exploration, but a generated sheet is
  not automatically a consistent animation/direction set or a game-ready atlas.
- Model rendering, if selected, happens during asset production. The Fly server
  would still operate on gameplay data rather than rendering the sprites.
- Keep simulation footprint/collision dimensions separate from transparent image
  bounds and decorative shadows.
- Keep a small export script or documented export recipe so adaptations can be
  reproduced. Record changes rather than relying on an undocumented manual edit.

## Next concrete art deliverable

A small overhead world using square terrain tiles, plus representative unit
placeholders for scale and readability checks. Confirm palette and proportions,
then prepare the stage-one subset for the two-browser movement/combat/persistence
baseline. Whether the first terrain layout is authored or generated remains a
separate implementation decision.

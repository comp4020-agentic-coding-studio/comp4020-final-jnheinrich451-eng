# Elevation and physical behavior — design proposal

10 October 2026. **Requested direction, not implemented:** retain overhead 2D
presentation and existing movement, add terrain height to appearance and shooting,
and pursue convincing physical behavior within the game's scope and budget.
The author identifies combat, access to powerful equipment, and consequences for
poor operation as central; visual detail should support that experience.

## A bounded first height model

Propose one saved ground-height value per terrain tile, interpolated over broad
slopes. Keep horizontal coordinates, movement controls, path connectivity and
speed unchanged. Heights are additional world data, not a replacement terrain map
or a conversion to a 3D engine. Use contours, shading and changes in ground texture
to show broad hills; do not draw impassable-looking cliffs that every unit can
walk straight through. Ramp movement should look plausible even without slope
speed penalties. Numeric height scale and unit muzzle heights remain undecided.

A laser has an elevated straight ray; a shell has an elevated ballistic trajectory.
Find the first intersection with terrain or an eligible obstacle using consistent
world-space rules. A ridge between shooter and target can matter even if their
endpoint heights match. Checking only their height difference is insufficient.
Both the server and aiming preview must use the same solution and obstruction.

| Weapon | Proposed elevation interaction |
| --- | --- |
| Tank HE | Use muzzle height, target ground height, finite projectile speed and barrel pitch limits. Firing down a slope can extend reach; firing uphill may reduce it. Existing traverse and reload remain meaningful. |
| Rail/naval artillery | Extend the existing ballistic arc to terrain height, including intervening ridges. Retain independent traverse/pitch limits and platform range caps. |
| Laser | Straight line from muzzle to aim height. Terrain can block the beam; high ground does not increase the weapon's intrinsic maximum beam length. |
| Machine gun / magnetic round | Direct-fire terrain obstruction first; detailed gravity/drag can wait. High ground offers a clear firing line rather than a universal percentage bonus. |
| Fuel jet | Intersect the fuel trajectory with terrain. Height should not grant unlimited jet reach. A gravity-curved liquid stream can be a separate refinement. |
| Missiles / bomber bombs | Later adapt existing flight paths to terrain impact. Do not silently rewrite all weapons in the first tank/laser experiment. |

The initial tank HE implementation is a fixed-range ground-plane projectile,
whereas heavy artillery already has an arc. Extending tank behavior needs a clear
barrel-elevation policy and prediction, not just a hidden range multiplier. Start
with automatic elevation from the aiming point so the established controls remain.

## First experiment and checks

Use an isolated flat-ground / hill / intervening-ridge test map before modifying
saved Caldera campaigns. Demonstrate tank HE and the robot laser first, then apply
the shared height/obstruction rules to other platforms in separate steps.

Check flat-ground compatibility, uphill/downhill shots, a hidden target beyond a
ridge, crest visibility from both directions, unchanged movement, maximum travel
time/range, two players seeing the same impact, and saved return. Aim feedback
should show where the terrain stops a shot before the player spends resources.
No production save should gain arbitrary regenerated terrain or height data during
this proposal stage; a later versioned migration needs its own plan.

There is no full-world rigid-body or fluid simulation proposal. A shared height
array and bounded projectile intersection work may fit the existing architecture,
but actual cost needs measurement with simultaneous combat before capacity claims.

## Guard reaction observed during this discussion

Current individual aggro is six tiles, retained pursuit target range is eight
tiles, and station defenders also have a twenty-tile home bound. The station's
twelve-tile alarm radius does not send its attacker's location to defenders.
A local simulation probe reproduced an alarm with a guard 12.5 tiles away and no
target; moving the robot within three tiles caused pursuit. That explains one
passive bombardment case, but does not establish the cause of every user encounter.

Recommend a separate behavior refinement: an alarm reports a last-known threat
position, nearby defenders investigate it, and direct detection changes that into
pursuit. Keep a home bound and a search timeout; do not grant perfect global player
tracking or endless pursuit. This is a proposal, not a changed detection rule.

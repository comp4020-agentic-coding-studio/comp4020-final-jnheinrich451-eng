# Air contaminator

11 October 2026. The author approved this as the next separate playable facility,
ahead of the proposed laser tower. Blight hatching, laser damage, anti-air and the
attack jet are not implemented by this stage.

## Combat purpose

The contaminator conceals a large area so players can choose dangerous close HE
attacks or bombard surveyed coordinates with artillery, ships, missiles or the
existing HE bomber. There is no special platform restriction: all existing HE
structure damage still works. Fire, gas and robot weapons do not destroy it.
Orbital strikes remain a future platform; no new orbit weapon is implied.

Click **F / Locate air contaminator** in the map controls (not a keyboard binding).
The objective panel gives the surveyed center in world coordinates. Aim there
with a long-range platform and wait for its real barrel/trajectory to align.
The panel does not reveal the hidden emitter's live HP or alarm state.

The first emitter occupies 3×3 tiles, has 600 HP and three initial guards. Its
opaque inner cloud has a 16-tile radius, with a soft outer fringe. It has no
scanner, reinforcement waves or direct damage. Nearby intact crowns can still
respond to attacks through the existing bounded defence-report system.

## Concealment contract

The cloud covers terrain, units (including the controlled body), facilities,
labels, paths, ground aiming indicators, enemy attack circles, incoming acid,
impacts and traces within it. The minimap masks the same core area. Zooming out,
orbital viewing or selecting reduced effects does not reveal the interior.
Reduced effects stops cloud rotation; it does not reduce opacity or clear early.

Only controlled rail/missile artillery, naval aiming and bomber impact predictions
are drawn above the cloud. They show the intended/physical aiming solution, not
the enemy underneath. Aircraft recovery markers remain concealed inside fog.
Surveyed coordinates and saved objective completion remain available to the room.

Health, ammunition and controls stay usable. A body inside the cloud gets
**VISIBILITY LOST**; its coordinate readout and contextual incoming-acid warning
are hidden. Hits inside the cloud do not produce the floating HIT/KILL readout.
Objective destruction is still announced as shared campaign progress.

Fog does not change collision, projectile travel, damage, movement, construction
permissions or alien sensing. It is an optical gameplay obstacle for players;
automatic enemy/friendly targeting retains its current rules. This cooperative
prototype conceals the rendering, not the underlying network snapshot; it is not
a competitive anti-cheat or server-side information-filtering system.

## Destruction and save rules

Destroying the emitter permanently stops it. The cloud contracts over eight
simulation seconds, revealing ground from its edges. Existing enemies, airborne
attacks and structures remain. Original terrain is unchanged and the emitter's
ruin becomes walkable/buildable. Cloud overlap remains concealed until every
covering cloud clears.

HP, guards and conquest time use the existing combat checkpoint. Offline/paused
time does not clear fog. Combat broadcasts and checkpoints continue through the
final clearing tick even if this was the last hostile site. Reloading cannot
respawn the emitter or reset its clearing progress.

Named campaigns receive one backed-up, additive `air-contaminator-v1` migration.
It searches clear ground, keeps a 32-tile buffer from saved players/equipment,
and preserves prior construction and objectives. If no safe site fits, it records
that result and adds none. Legacy rehearsal worlds remain unchanged.

## Rendering budget and review

A shared 768×768 cached texture (about 2.25 MiB raw pixels) supplies all clouds on
the browser. Each emitter draws one slowly rotating image. No particle swarm,
fluid model or per-tile growth simulation runs on the server. These bounds do not
establish sustained Fly performance.

Checks cover safe placement, initial-only defenders, HE damage, unchanged terrain,
overlapping clouds, persisted clearing, the final idle clearing tick and additive
migration. Browser checks exercise opaque pixels in both effects modes at multiple
scales, hidden ground aim, visible artillery aim, two-client conquest, cloud
clearance and restart retention. Review the 16-tile radius and eight-second clearing
time in play before combining this facility with other new threats.

`pnpm check` passed typechecking and 243 tests across 42 files.
Desktop (1920×1080) and phone (390×844) contaminator browser checks passed,
including minimap pixels and reduced-effects concealment. Their one-heavy-hit
fixture isolates shared visibility/conquest transitions; domain checks exercise
the full 600 HP. Four aircraft/cannon regression checks also passed. The older
cannon fixture now deploys a core before building and uses mobile targets clear
of the current HUD. Screenshots were inspected on both screen sizes. This stage
has not been deployed or load-tested on Fly.

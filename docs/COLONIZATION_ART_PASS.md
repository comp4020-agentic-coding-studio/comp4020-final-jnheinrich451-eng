# Colony art pass: agricultural worker and white machinery

1 November 2026. The author supplied the agricultural robot design sheet and
asked to see a first visual implementation: futuristic metallic facilities,
clean white as the main manufactured color, illustrated environment/machinery,
and the combat interface's concise structure adapted to the peaceful mode.

This records the first playable visual pass. Its follow-up
[HUD and planets stage](COLONIZATION_HUD_AND_PLANETS.md) implements the separate
opening branch, three new destinations and a more compact interface. Full carrier
arrival remains in [the visual direction](COLONIZATION_VISUAL_DIRECTION.md).

## References and simplification

- `output/video-frames/agricultural-robot-design-sheet-v1.png`: broad low torso,
  angular cyan visor, four arms and four legs, guarded elbow rotors, rear utility
  pack. Small fasteners, exact finger anatomy and traction mechanisms are
  simplified for playing scale. The supplied PNG is unchanged.
- `output/video-frames/mycorrhizal-carrier-open-bottom-v5.png`: white/grey metal,
  glass ribs, graphite seams, gold identifiers, warm lights and a cargo shuttle.
- `docs/HUD_AND_POLISH_STAGE.md`: folded guidance, compact tools, contextual
  actions and necessary instructions instead of persistent descriptions.

The worker combines muted violet from its sheet with white panels and dark
mechanical joints. Facilities use white metal and glass. The environment retains
the garden's gentle colors, with stable ink-like contours and organic texture.
All new game art is drawn in code; the reference images are not sliced into
rotating stickers or edited by this pass.

## Camera and directional art

The fixed view looks down from 55 degrees above the ground, with no camera yaw.
Ground depth is compressed to approximately 82%; apparent size stays constant
across the screen. Roof/front surfaces and object height have a consistent
projection. Saved tile coordinates, placement rules, movement speeds and
collision stay in the existing ground plane.

`public/colony-view.js` owns the forward/inverse projection, screen deltas and
visible bounds. The scene, hit selection, dragging and placement previews use
the same transformation. Phone focus offsets account for the compressed depth.

`public/colony-robot.js` builds a simplified worker from local 3D shapes and
projects them into the canvas. Heading changes reveal front, side and rear
surfaces: the visor faces forward, the radiator stays on the backpack, and limb
overlap follows direction. Four arms attach in two shoulder and two backpack
positions; four legs share the pelvis. Walking animates alternate diagonal legs.
Elbow rotor illustrations add no flight or other gameplay capability.

## Interface

Retain the colony's existing actions while reducing their presentation:

- Compact expedition/material/crew controls and a folded current-step guide.
- White contextual garden panels and a compact bottom tool strip.
- Controlled irregular borders, original line icons and handwritten heading
  accents; ordinary text and numbers remain legible. Installed Segoe Print,
  Bradley Hand or Chalkboard SE supply the accent, falling back to cursive;
  the existing IBM Plex font supplies body text. No new font asset is bundled.
- Essential costs, growth times, water state, harvest state and rejection
  reasons stay visible. Repeated encouragement and lore leave the action panels.
- Controls and relaxed-care guidance are available through **Help / F1**.
- Existing keyboard, touch, invitation, pause and saved-return behavior remains.

## Facility refinement after the first review

The author approved the worker and requested the same mechanical art treatment
for facilities. Only their fixed camera-facing sides are needed: the camera
keeps its 55-degree view, so buildings do not need directional turnaround art.

The drawings now use the worker's construction language at facility scale:
beveled white shells over graphite structural parts, visible joints, restrained
violet/gold accents, cyan glass and simple upper-surface highlights. Functional
parts stay large enough to recognize at normal playing zoom.

The cultivation hub retains its glass growing chamber with a more substantial
front entrance and utility fittings. Growing beds receive structural corners
and a front irrigation/service edge; the sprinkler uses a compact pump, mast
and mechanical nozzles. The orbital post receives a reinforced deck with visible
front service details. These are drawing changes within the existing footprints.
Gameplay, saved construction, placement and the shipment cycle stay unchanged.

The [facility detail sheet](testing/evidence/2026-11-01/colonization-facilities-detail.png)
uses the actual renderer with an isolated in-memory garden, including the
occupied deck and the deck during an orbital delivery. The
[normal playing view](testing/evidence/2026-11-01/colonization-facilities-scene.png)
comes from the browser placement scenario. Both were visually reviewed for
consistent materials, fixed perspective and readable front-facing details.

This facility-only refinement passed JavaScript syntax checking and **three
existing Chrome browser scenarios**: zoom/pan/placement and directional movement,
the full desktop growing/harvest/shipment/save flow, and phone controls. The
[phone view](testing/evidence/2026-11-01/colonization-facilities-phone.png) was
also visually inspected. No browser page errors were reported. No new gameplay
tests were added for these drawing changes; the broader first-pass results below
refer to the earlier camera/robot/interface implementation.

## Validation

Local tests use disposable saves. The projection's cardinal directions, height,
tile picking across viewports/zoom levels, drag anchoring and visible bounds are
covered by `spec/colony-view.test.ts`. TypeScript and **27 focused projection,
domain, runtime and registry tests passed**.

**Four Chrome browser scenarios passed** using isolated temporary databases:

- Two gardeners sharing work, focus-loss stopping and host reconnect.
- Real pointer placement and bed selection after zoom and drag, plus movement
  in all four cardinal directions with the corresponding saved headings.
- Desktop planting, watering, a genuine 45-second growing cycle, harvesting,
  orbital shipment, pause/resume, help/F1/Escape and restored saved state.
- Phone planting, touch movement/release, irrigation and contextual controls.

The desktop and phone screenshots were visually inspected. The compact panels
remain legible without covering the selected bed; the worker's actual runtime
render was also reviewed from front, side and rear. No browser page errors were
reported in these scenarios. This pass was validated locally, not deployed.

Review images (actual game renders):

- [Scene](testing/evidence/2026-11-01/colonization-white-metal-scene.png)
- [Robot directions](testing/evidence/2026-11-01/agricultural-worker-directions.png)
- [Desktop tools](testing/evidence/2026-11-01/colonization-white-metal-desktop.png)
- [Phone tools](testing/evidence/2026-11-01/colonization-white-metal-phone.png)
- [Delivery](testing/evidence/2026-11-01/colonization-white-metal-delivery.png)

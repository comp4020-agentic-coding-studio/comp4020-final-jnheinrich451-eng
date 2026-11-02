# Colonization: a civilian branch of Frontier

1 November 2026. Design revision following the author's first visual review of
the playable garden. The environment's warmth is welcome, but the robot and
facilities should belong to the same human civilization as Frontier's combat
machines. The [first art pass](COLONIZATION_ART_PASS.md) now implements the camera
and machinery sample following the author's agricultural robot sheet. The
[HUD and planets stage](COLONIZATION_HUD_AND_PLANETS.md) now implements the
separate menu and three destinations. The [carrier arrival stage](COLONY_CARRIER_ARRIVAL.md)
now adds MYCORRHIZAL in orbit and its controlled shuttle approach.
The later [white-and-gold revision](COLONY_WHITE_GOLD_VOYAGE.md) replaces its
angled view with the selected overhead ship, paired bow shuttles and a warmer
civilian system. It adds steered planet travel and a main-menu entry lens effect.

## Confirmed direction from the author

- Keep the peaceful environment and develop its visual quality.
- Give Colonization its own main-menu entry **between Continue and Join** and
  its own save browsing. Do not mix its saves into the main combat Continue.
- Explore a hand-drawn heading style and apply a coherent visual system through
  the colony menus and game interface.
- Introduce three different colonization planets in its opening scene, rather
  than only repainting the military destinations.
- Use the selected **MYCORRHIZAL** carrier and its cargo shuttle for arrival.
  The shuttle enters the atmosphere instead of a military drop pod.
- Define the viewing angle and art direction before replacing the whole scene.
- Keep the robot and manufactured structures recognizably part of the same
  human empire. Warm lighting or color treatment can change their mood.

Reference actually present in the workspace:
`output/video-frames/mycorrhizal-carrier-open-bottom-v5.png`.
Its accompanying prompt records the intentional open-bottom bay and suspended
shuttle; those shapes are part of this reference, not defects to close over.

## Starting point and current implementation

Before this art pass, the garden used a flat overhead ground projection: X and Y
had the same scale. Drawn fronts, roofs and shadows created a sense of depth, but
the player body always faced the viewer. The first art pass now uses the 55-degree
projection below and a directional worker based on the author's agricultural
robot sheet. This remains a canvas renderer over the existing 2D simulation.

Colonization now has its own main-menu branch and save browsing. New Game and
Continue refer to combat; New expedition and Continue expedition refer to the
peaceful mode. Saves have separate identities/runtimes/economies; a shared
account registry supplies ownership, invitations and room admission. The three
owned-save slots remain shared across both modes.

## First-pass camera: fixed orthographic, 55 degrees above the ground

Use a gently raised three-quarter view. At 55 degrees above the ground, both
roofs and fronts remain visible without hiding most of the growing beds behind
buildings. Keep the ground axes aligned with the screen: left/right remains
east/west and up/down remains north/south. Use no camera yaw in this first pass.
Objects keep the same apparent size at the far and near edges of the screen.

The author accepted trying this camera in a playable art sample. The first pass
shows the worker, greenhouse, growing beds and landed shuttle at the normal
playing zoom. The angle can still be tuned after reviewing the result.

Implementation retains a 2D simulation with a consistent projected drawing:

- Ground depth is scaled by `sin(55 degrees)`, approximately 0.82.
- Object height projects upward by `cos(55 degrees)`, approximately 0.57.
- One projection/inverse handles world drawing, mouse selection, placement
  footprints, dragging, camera bounds and visibility calculations.
- Sort tall scenery and machines by ground contact; fade foreground roofs or
  foliage when they obscure the player or selected crop.
- Keep simulation coordinates, saved construction and collision footprints.
  Draw a directional civilian robot rather than rotating one front-facing body
  as if it were a flat sticker. The worker uses projected shapes with continuous
  heading changes and distinct front, side and rear surfaces.

The opening space scene and arrival may use a more cinematic perspective. Land
into the fixed gameplay view so camera changes have a clear beginning and end.

## Proposed art direction: warm illustrated industrial science fiction

Use clean, simplified machinery with readable materials inside a soft landscape.
Warmth comes from lighting, vegetation, motion and color, while the manufactured
objects keep Frontier's construction language.

| Element | Shared universe identity | Colonization treatment |
| --- | --- | --- |
| Player robot | Angular sensor visor, articulated limbs, shoulder panels, exposed joints | Author's four-arm/four-leg agricultural sheet; white and muted violet panels, graphite mechanics, cyan visor and rear utility pack |
| Cultivation hub | Panel seams, supports, vents, doors, service access and gold identification | A modular greenhouse/workshop with glass ribs, planted trays and warm interior light |
| Sprinkler and equipment | Small actuators, hoses, fittings and replaceable parts | Gentle motion and clear operation; restrained colors that remain visible in grass |
| Cargo shuttle | MYCORRHIZAL's practical cargo-carrying craft | Same silhouette in arrival, parked state and orbital deliveries; landing gear and cargo handling |
| Environment | A coherent alien world with visible terrain and vegetation | Retain soft grass, flowers, muted water, rounded canopies and diffuse shadows |
| Interface | Frontier organization and readable controls | Quiet paper/cream surfaces, small botanical details, consistent lightly drawn borders and headings |

Use the carrier's **frosted steel, graphite seams, greenhouse glass, amber lamps
and gold emblem** as the material reference. Preserve the civilization's design
language while using the author's specialized agricultural worker anatomy. The
first pass replaces smiling building façades and the mascot-like player body
with functional construction. Gentle movement, vegetation and warm lighting
carry the relaxed mood; the HUD keeps advice concise and available on demand.

Hand-drawn typography is an accent system: the Colonization menu entry, branch
title and major headings may use it. Keep counts, controls, account forms and
long instructions in a clean legible companion face. Maintain the same heading
style, line weight, colors and hover behavior throughout the colony branch.
The sample uses an installed handwritten font stack (Segoe Print, Bradley Hand,
Chalkboard SE, then cursive), alongside the existing IBM Plex body text. It adds
no font download or redistributed font asset. A bundled handwritten face remains
a possible later refinement for cross-platform consistency. The existing
Frontier logo remains the parent identity, with a quieter botanical colony accent.

## Navigation and saved expeditions

Implemented main menu order:

1. New Game — new combat campaign.
2. Continue — combat saves.
3. **Colonization** — dedicated peaceful expedition branch.
4. Join — an invitation continues to identify the correct room and mode.

Inside Colonization: **New expedition / Continue expedition / Join expedition**,
with Back returning to the main menu. Its three destination worlds, headings
and colors form one visual branch. The account remains shared. The carrier's
separated art layers and arrival animation are implemented in the
[carrier stage](COLONY_CARRIER_ARRIVAL.md).

Separate the lists by saved `mode` as well as planet. Preserve the branch through
refresh, Back/Forward, sign-in and invitation entry. Always keep Return to room
and Save and leave accessible: a person cannot occupy both modes at once.
Mode selection must not override the mode encoded by an accepted invitation.

List separation does not automatically change save capacity. Keep the current
quota until a quota change is chosen; **three slots per mode** is a possible
follow-up, not an implemented or confirmed rule. Existing colony saves on
Caldera/Vesper/Sirocco must still appear under Continue expedition. Never rename
their template IDs, regenerate their terrain or hide them when new planets arrive.

## Three implemented colony worlds

These destinations now have stable IDs, distinct opening globes and separate
saved districts. All retain viable water, growing areas and practical starting
sites. Their growing rules are shared; visual and geographic differences create
atmosphere without adding care requirements.

| Working name | Orbital identity | Surface direction |
| --- | --- | --- |
| Morrow | Soft green continents, deep blue water, broad ivory cloud bands | Meadow valleys, flowering woodland and freshwater ponds |
| Nacre | Turquoise seas, pale coasts and muted lavender land | Tidal gardens, tall fungal canopies and sheltered wetland plots |
| Aurelia | Amber vegetation, blue lakes and light mineral ridges | Golden uplands, broad alien tree canopies and irrigated terraces |

The globes use shared lighting and softer procedural surface textures. The
mode-aware catalog supplies their facts and palettes to both opening and game.
Each playable survey is a 72-by-56 local district, not an entire globe. New IDs
receive distinct saved geography; older expeditions retain their original maps.

## MYCORRHIZAL arrival

The current reference is the middle TOP view of
`output/video-frames/mycorrhizal-white-gold-design-sheet-v1.png`, with two bow
shuttles and a 15-degree-right-of-up resting heading. The white-and-gold stage
supersedes the first angled carrier below while retaining admission-gated,
wind-only shuttle entry.

The selected image shows a glass cultivation deck, a scythe-like bow, an
open-bottom bay and one shuttle held from above. Use these features as anchors.
The implemented first sequence is:

1. MYCORRHIZAL passes above the chosen planet, its greenhouse glowing softly.
2. The upper docking arms release the cargo shuttle into the open space below.
3. The shuttle clears the hull and descends under control through cloud layers.
4. The camera follows its shallow banking approach with pale wind ribbons, then
   fades into the admitted expedition. A close-up touchdown, opening ramp and
   robot disembarkation remain possible later refinements.

The supplied PNG is a composite: the shuttle is already painted into the carrier.
The carrier stage prepares an empty-bay carrier layer and a separate shuttle
layer, so release leaves no duplicate shuttle in the bay. Both retain the
open-bottom notch, upper supports and ship identity.
A single raster viewpoint supports modest layered motion, not unrestricted
rotation around the ship. The parked and delivery shuttle should be redrawn
from the same design for the gameplay camera.

Reuse the entry controller's actual room admission, skip/cancel handling and
reduced-motion route. Select presentation by mode; leave combat arrival intact.
Do not show a successful landing or create a duplicate save if admission fails.

## Work order and status

1. Complete: art/camera sample with worker, greenhouse, bed and shuttle.
2. Complete: separate menu branch and filtered save lists, preserving old saves.
3. Complete: projected machinery and compact header/contextual dock, with
   placement, movement and phone checks.
4. Complete: three colony destinations in the opening scene and saved districts.
5. Complete: carrier/shuttle layers, civilian orbit and controlled atmospheric entry.
6. Later: automation and settlement features using this visual system.

The initial revision recorded design and inspection only. Its follow-up
[art pass](COLONIZATION_ART_PASS.md) implements the camera and machinery for
review. The [HUD and planets stage](COLONIZATION_HUD_AND_PLANETS.md) adds the new
menu, compact interface and destinations. The carrier stage completes the first
civilian entry animation; quota changes remain separate proposals.

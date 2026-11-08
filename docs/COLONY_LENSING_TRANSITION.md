# Colony destination consistency and lensing transition

## Author review — 2 November 2026

The author found that Continue briefly showed MYCORRHIZAL over Morrow, then
switched to Sirocco. Continue was selecting the first save automatically, and
legacy colony saves added combat planets to the civilian catalogue. The approved
selection is exactly **Morrow, Nacre and Aurelia**.

New expedition and Continue expedition open on Morrow when selected from the
colony menu. Arrows let the player choose another world. Legacy peaceful saves
remain accessible: Caldera appears under Morrow, Vesper under Nacre, and Sirocco
under Aurelia, with a legacy label on the save. This is a browser grouping only:
the original template, saved terrain, crops, structures and membership remain
unchanged. Combat retains Caldera, Vesper and Sirocco.

## Approved visual revision

This supersedes the shrinking scene in
[the white-and-gold voyage stage](COLONY_WHITE_GOLD_VOYAGE.md).

- The source planet keeps its screen size while an inward-moving distortion
  ring covers it. Surface details stretch tangentially along the narrow rim.
- Sparse colored arcs, ellipses and short streaks suggest chromatic separation
  and a slit-scan smear. They stay near the moving edge.
- The celestial layer converges to a bright point with a small ring, then opens
  onto the destination system. The sun and background planets disappear during
  convergence; the underlying stars remain visible and continue their motion.
- Entering Colonization uses gold light. The colony menu's **War Zone** action
  returns to the combat menu with blue light and the same transition. Its subtitle
  reads “Ready to expand humanity's frontier?” and uses the combat menu's font.
- Planet arrows retain their separate steered ship travel. Direct URLs, reload,
  Back and reduced-motion preferences must remain usable.

This is a cinematic interpretation, not a gravitational simulation. Its bent
arcs and rings take their visual cue from
[NASA's gravitational-lensing examples](https://science.nasa.gov/mission/hubble/science/universe-uncovered/hubbles-gravitational-lenses/).
Chromatic accents, timed convergence and surface smears are art direction.

## Implementation and validation

The transition lasts 1.8 seconds: 850 ms closing, 200 ms at the convergence point,
and 750 ms opening. Transparent celestial layers separate the planets and sun
from the live stars. The layers match the display canvas's bounded backing
resolution, and each frame uses at most sixteen small source crops around the
rim. There are
no per-frame pixel reads or generated particle collections. Planet-arrow travel
and the admission-gated shuttle departure retain their previous behavior.

Both directions use the same interruptible transition. Pause, reduced motion,
resize, route changes and page lifecycle events settle it cleanly. If the canvas
renderer fails, transition markers clear so the usable fallback menu regains
full opacity. Unrelated ship art, account rules and save quotas are unchanged.

Local validation completed:

- **5 lens helper tests** and TypeScript passed. Checks cover fixed source scale,
  continuous aperture timing, star-background preservation, bounded rendering
  work and matching gold/blue paths.
- **12 colony browser checks** passed in 1.5 minutes on desktop and phone. These
  cover first-frame Continue stability, the three-destination cycle, original
  legacy save terrain after entry, direct URLs/reload, both transition colors,
  visible star pixels at convergence, navigation interruption, reduced motion,
  caught renderer failure and the existing admission-gated shuttle arrivals.
- **6 existing combat-entry browser checks** passed in 51.8 seconds, including
  planet travel, admission/refusal, reduced motion and saved-once creation.
- Final desktop and phone captures were visually reviewed. The first rim trial
  looked segmented; thinner sampled streaks and distinct spectral arcs removed
  that artifact. Refraction stays concentrated at the moving edge.

All browser fixtures used disposable accounts and worlds. Developer saves were
not reset, and this stage has not been deployed.

The [browser validation record](testing/evidence/2026-11-02/colony-lensing-validation.json)
contains source hashes and 72 captures. Selected final previews:

- [Continue on Morrow — desktop](testing/evidence/2026-11-02/system-return-desktop-continue-morrow.png)
- [Continue on Morrow — phone](testing/evidence/2026-11-02/system-return-phone-continue-morrow.png)
- [Blue return lens](testing/evidence/2026-11-02/system-return-desktop-blue-collapse-early.png)
- [Colony menu with War Zone](testing/evidence/2026-11-02/system-return-desktop-civilian-system.png)

## Rotation continuity follow-up — 2 November 2026

The author noticed that the destination planet changed orientation when the
wormhole finished opening. The incoming image was captured once, then shown
unchanged while the live scene clock advanced for 1.8 seconds. Returning to the
live renderer changed both the surface angle and illumination at once. The
earlier 1,100-pixel capture cap also changed image sharpness at the handoff.

The incoming transparent layer is now reused and repainted during expansion
with the same clock, surface sample, lighting and position as the live scene.
Its backing resolution matches the main canvas. Sphere shading retains the
normal 100 ms cache; no scene-clock offset or rotation reset is introduced.
The outgoing image remains cached, and stars retain their continuous motion.

Four browser regressions compare actual sphere raster samples before and after
the handoff, in both directions on desktop and phone. The saved old renderer
fails: one frozen raster sample, 1,683 ms old at the last reveal frame, with a
pixel change about ten times its ordinary update. The corrected renderer shows
8–9 distinct samples during expansion, samples aged 15–64 ms at the final
reveal, matching backing resolution, and zero sampled RGB difference at the
handoff in these four runs. These are local fixture measurements, not a claim
that every display frame is identical across all devices.

The [rotation validation record](testing/evidence/2026-11-02/colony-rotation-continuity-validation.json)
preserves the expected baseline failure, four passing cases and source hashes.
Three existing transition checks also passed, covering both visual directions,
visible stars, cancellation, reload, reduced motion and renderer-failure
recovery. TypeScript passed. No existing saves were changed or reset.

## Gravitational-lens revision — 9 November 2026

The author asked for a more scientific wormhole: distorted edges, the universe
distorted and compressed into the hole, then an expansion into the new system.
This revision replaces the circular iris with a per-pixel lens. It is built
and checked locally; the author has not yet playtested it, and it is not
deployed.

### What the player sees

Both directions keep the 1.8-second timing (850 ms collapse, 200 ms
convergence, 750 ms expansion) and the same phase markers.

1. **The lens forms** at the centre of the menu planet. The planet is bent
   around a dark mouth. Its centre is pushed out into an Einstein ring, and its
   lit limb reappears inverted on the far side of the hole. Stars near the
   mouth stretch along it. Through the mouth the destination is visible as a
   small world.
2. **The universe is drawn in.** The camera accelerates toward the mouth: the
   nebula, sun, planets and stars stream toward the hole. As the lens grows, the
   whole planet becomes a ring hugging the throat, while stars from the edges and
   from behind the camera pour inward.
3. **The throat** is a small knot with a thin photon ring and a gold (entering
   Colonization) or blue (returning to War Zone) glow. The throat grows over the
   compressed origin and swallows it. Sparse stars remain across the screen.
4. **The expansion** carries the photon ring outward past the screen corners.
   The destination grows from a small whole planet to the ordinary view, which
   it reaches exactly over the last 15% of the expansion.

### Physics and art direction

Two real optical effects are used in closed form:

- **Point-mass lens**: an image at radius θ shows the source at
  β = θ − θE²/θ. That gives the Einstein ring, tangential stretching, and the
  inverted secondary image inside the ring.
- **Relativistic aberration**: treating the sky picture as a stereographic
  projection, a boost toward the mouth is an exact zoom about it by
  k = √((1 − b)/(1 + b)). At the throat k = 0.06 (about 0.993c). The Doppler
  factor 1/(γ(1 − b cos ψ)) brightens and blue-tints the forward sky and dims
  and reddens the edge of view.

Inside the throat the destination uses ρ = θ / (1 − θ²/T²). Its whole sky fits
in the disc and relaxes to the ordinary view as T grows.

The following are art direction, not simulation:

- The timing.
- The throat and Einstein-radius growth curves (approaching a lens does enlarge
  its Einstein angle, but these numbers are chosen).
- The tempered Doppler brightness (D^0.5, capped).
- The photon-ring tint and glow.
- The sparse rear-sky stars at the throat. At 0.993c, real aberration and
  redshift would leave the edge of view almost empty. Instead, a sphere-uniform
  rear sky continues the forward star disc at matching density, so the screen
  never goes blank. The earlier approved rule, that stars stay visible at
  convergence, is kept this way.

Gravitational lensing is achromatic, so the earlier rainbow fringes and glints
were removed.

### Implementation

`public/wormhole-lens.js` holds the state curve, the lens, throat and Doppler
formulas, and the WebGL2 shader. Each frame, every display pixel finds the sky
point whose light reaches it. The main lookups stay outside branches, so
mipmaps average compressed regions instead of shimmering.

Each universe is painted as one picture with a margin of 22% of the larger
screen side: its own sky, nebula, stars, sun and planets. That keeps whole
planets and nebulae available when the view is compressed. Margins are whole
backing pixels, so the screen part sits exactly on the display grid.

- The origin picture is painted once, at the click, before the menu changes
  mode.
- The destination picture is repainted and uploaded each frame. It shares the
  live clock, surface sample and backing resolution, so the
  rotation-continuity rule from 2 November still holds.

Stars beyond the painted pictures are mapped one by one through the same lens,
throat and aberration. These include the forward star field's disc and a
seeded, sphere-uniform rear sky of about 2,100 stars. The empty-sky colour
matches each universe: combat black, civilian `#080c0d`.

### Fallback and failure

When WebGL2 is unavailable, the shader fails, or the context is lost, the
earlier 2D iris (`paintColonyWormhole`) runs instead. It stays in use for the
rest of the page session. `data-entry-wormhole-lens` reads `gl` or `2d`.

A failure drawing to the screen canvas still reaches the scene's own catch.
That catch removes the canvas and restores the full-opacity menu, as before.
Pause, reduced motion, resize, navigation and page lifecycle settle the effect
exactly as before. Textures are released when it ends; the context is reused.

The painted pictures and textures use about 100 MB of GPU memory for 1.8 seconds
on a 1920 × 1200 backing canvas. A phone backing canvas needs far less. This is
an estimate from texture sizes, not a measurement on low-end devices.

### Validation

Validation is local, on the author's workstation (Chrome 155, NVIDIA GPU).

- **Unit tests:** 9 new lens tests and the 5 existing iris tests passed, and
  TypeScript passed. The new tests cover:
  - exact identity at both ends and continuity at the phase boundaries;
  - the lens equation, Einstein ring, throat inverse and Doppler factor;
  - full coverage of every screen pixel at rest, and a hidden layer edge when
    compressed;
  - deterministic rear-sky density;
  - star mapping, and matching gold and blue paths.
- **Browser checks: 10 colony voyage and rotation checks passed** on the first
  run. They cover:
  - the GL lens in both directions on desktop and phone;
  - visible outer stars at convergence;
  - interruption, reload, reduced motion and screen-renderer failure;
  - a new check that a WebGL2-less browser and a mid-transition GL failure both
    finish on the 2D iris.

  The rotation check now records WebGL uploads. In all four cases it shows 108
  live uploads during the expansion and zero sampled sphere difference at the
  handoff.
- **Shared entry scene:** 30 further browser checks passed on the first run.
  They cover the combat entry, alignment, colony transitions, lobby, arrival
  and destination checks.
- **Whole-screen continuity:** the first lens frame matches the last menu frame
  to rounding. At the end, the residual mean difference lies in the sun's
  gradient, at under 8 levels. On desktop, the number of pixels changing by
  more than 8 levels matches an ordinary frame step. On the phone, a few
  hundred pixels change, by up to 40 levels.

The [validation record](testing/evidence/2026-11-09/wormhole-lens-validation.json)
holds source hashes and the measurements. Contact sheets:

- [desktop, gold](testing/evidence/2026-11-09/wormhole-lens-desktop-gold.jpg)
- [desktop, blue](testing/evidence/2026-11-09/wormhole-lens-desktop-blue.jpg)
- [phone, gold](testing/evidence/2026-11-09/wormhole-lens-phone-gold.jpg)
- [phone, blue](testing/evidence/2026-11-09/wormhole-lens-phone-blue.jpg)

Fixtures used disposable accounts and worlds. No developer save was opened,
changed or reset.

Open for the author's playtest:

- whether 1.8 seconds is long enough for the richer sequence;
- the lens strength on the dark-centred Caldera globe, where the Einstein ring
  is subtler than on the lit Morrow globe;
- the brightness of the knot at the throat.

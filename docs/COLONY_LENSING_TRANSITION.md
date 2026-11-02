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

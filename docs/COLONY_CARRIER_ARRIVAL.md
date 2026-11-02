# MYCORRHIZAL colony arrival

The [white-and-gold voyage stage](COLONY_WHITE_GOLD_VOYAGE.md) supersedes this
stage's angled steel ship art with the selected overhead view and two bow
shuttles. This record preserves the first implementation and its evidence.

The author requested the civilian carrier in orbit around the selected world on
both **New expedition** and **Continue expedition**, followed by its cargo shuttle
releasing from the underside bay and flying into the atmosphere. The shuttle
uses a controlled approach with wind around its hull, not the military pod's
freefall and fiery entry. This is a presentation stage; it changes no world,
campaign admission, economy or farming rules.

## Art assets

The source is the author's selected
`output/video-frames/mycorrhizal-carrier-open-bottom-v5.png`. Its greenhouse,
crescent bow, frosted metal, amber lights and open underside remain the design
anchors. The original file is untouched.

Two transparent layers were prepared with the built-in `image_gen` tool:

| Runtime asset | Native dimensions | Purpose |
| --- | --- | --- |
| `public/assets/entry/mycorrhizal-carrier-empty-v1.png` | 1671 × 941 | Carrier with an empty, genuinely transparent bay and upper clamps |
| `public/assets/entry/mycorrhizal-shuttle-v1.png` | 1670 × 941 | Separate white cargo shuttle; nose points right, matching the source perspective |

The docked shuttle is drawn behind the carrier's clamps. Its release leaves an
empty bay, avoiding a duplicate shuttle painted into the hull. These are layered
illustrations from one viewpoint; the animation does not claim unrestricted 3D
rotation of the ship.

Full prompts and native source copies are versioned siblings under
`output/video-frames/`, named `mycorrhizal-carrier-empty-v1-prompt.txt` and
`mycorrhizal-shuttle-v1-prompt.txt`. Runtime files are copied byte for byte into
the deployable `public` directory. They are not upscaled. Hashes, dimensions and
representative alpha checks are recorded in
`public/assets/entry/mycorrhizal-manifest.json`.

## Entry contract

- The selected planet controls the orbit pose in both civilian browsing views,
  including legacy peaceful saves.
- The two image layers load once when Colonization is opened. Combat-only menu
  browsing does not download their 3.2 MB of PNG data. A missing image falls back
  to the short admitted-entry fade rather than trapping the player.
- A 1.3-second approach frames the carrier, a 1.6-second release clears the bay,
  and a 4.8-second shallow flight banks through cloud and wind layers. The carrier
  recedes while the camera follows the shuttle. The scene then fades into the
  garden. Close-up touchdown/gear/ramp choreography is not in this stage.
- Room admission controls departure. An outstanding request keeps the shuttle
  attached; a refusal restores the usable menu.
- A successful create followed by refused entry keeps its one saved expedition
  and offers Continue. Animation never retries creation.
- Skip, reduced motion, absent canvas and hidden-tab timeouts must still allow
  the admitted player to enter. Returning from browser history clears the entry
  overlay.
- Combat retains CUCULIDAE and its drop-pod presentation.

## Local verification

- TypeScript and 14 unit checks passed: 7 civilian phase/geometry/layering checks
  and 7 existing military ship checks. The civilian checks cover indefinite
  admission hold, shallow banking, phone sizing, bay alignment and camera handover.
- 5 new browser cases passed in disposable local apps: all three colony planets
  in New/Continue on desktop and phone, admission waiting, successful New and
  Continue flights, refused admission without duplicate saves, skip and reduced
  motion. Both actual image layers are observed being drawn.
- After making asset loading conditional, the 2 orbit cases passed again. The
  desktop case verifies no civilian image request in combat menus and exactly
  two image requests when opening Colonization, with no repeat on planet changes.
- 6 existing combat entry browser cases passed: planet switching, desktop/phone
  pod flight, failed entry/skip, reduced motion and same-save retry after refusal.
- Source syntax/whitespace checks passed. Representative desktop and phone orbit,
  release and atmosphere screenshots were visually inspected. Native PNG alpha
  was checked both outside the carrier and inside its empty bay.

Commands and baseline/incremental source hashes for the civilian browser runs are
in [the validation record](testing/evidence/2026-11-01/colony-arrival-validation.json).
These checks use isolated accounts and temporary data; no developer saves were
reset. No deployment is implied by this stage.

Review images:

- [New expedition / Morrow](testing/evidence/2026-11-01/colony-carrier-new-morrow-v1-desktop.png)
- [Continue expedition / phone](testing/evidence/2026-11-01/colony-carrier-continue-morrow-v1-phone.png)
- [Shuttle release](testing/evidence/2026-11-01/colony-shuttle-desktop-release.png)
- [Atmospheric approach / phone](testing/evidence/2026-11-01/colony-shuttle-phone-atmosphere.png)

Implementation: `public/colony-entry-ship.js` owns presentation geometry, sprites
and wind; `public/entry-scene.js` composes the selected planet and flight;
`public/campaigns.js` gates and cancels the animation around real admission.

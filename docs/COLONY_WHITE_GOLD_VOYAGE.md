# White-and-gold colony system

The [2 November lensing revision](COLONY_LENSING_TRANSITION.md) supersedes this
stage's whole-scene shrink and one-way branch transition. Ship art, arrow travel
and controlled shuttle entry remain as recorded here.

## 2 November: arrival copy and engine exhaust

The destination heading, designation, description, facts, Select label and
Continue save group now stay with the departing world until the carrier finishes
its 2.8-second journey. Select, Create, Enter and Delete wait for arrival too;
arrows and Back remain available. A later arrow cancels the earlier request, so
only the latest destination can commit its text. Paused animation, reduced
motion, resizing or a failed canvas settle the selection without leaving the
menu locked. Combat selection keeps its existing behavior.

The carrier is now 80% of its previous display size. Both bow shuttles and their
attachment points scale with the hull. Three short blue/cyan exhaust ribbons
follow the actual aft engine nozzles, flicker on the existing scene clock and
grow stronger during departure. They use six small canvas paths, with no
particle simulation or additional image asset. Pausing freezes the flame shape.
The atmospheric shuttle still uses airflow alone.

Local verification: 20 focused ship checks and TypeScript passed. All 14 colony
browser cases passed, including delayed words/save groups, blocked actions,
rapid reversals, correct-world creation, fallback, reduced motion and shuttle
admission. After adding the same-view route cancellation guard, the two affected
desktop/phone cases passed again with browser Back coverage. Six existing combat
entry cases also passed. Rendered carrier lengths measured exactly 0.8 of the
prior scale on desktop and phone; blue exhaust varied across all 16 sampled
frames. Both viewport previews were visually reviewed. These checks used
isolated fixtures; this change is local, not deployed.

See the [arrival polish validation record](testing/evidence/2026-11-02/colony-destination-arrival-validation.json)
for source hashes, measurements and screenshots. Earlier stage evidence below
is retained separately.

The author replaces the first angled MYCORRHIZAL presentation with the middle
overhead view from `output/video-frames/mycorrhizal-white-gold-design-sheet-v1.png`.
The silhouette remains MYCORRHIZAL, now in white and gold. This supersedes the
side-view carrier in [the first arrival stage](COLONY_CARRIER_ARRIVAL.md).

## Approved presentation

- Show the overhead carrier above the selected colony planet in New and Continue,
  with two separate cargo shuttles at the bow. At rest, its nose points upward
  and 15 degrees to the right.
- Planet arrows use a visibly steered journey: turn toward the distant world,
  accelerate away, exchange the planets, approach from the previous world's
  direction, decelerate, and rotate back to the resting heading. This is a
  compressed cinematic journey, not the combat ship's jump flash.
- Colonization has a golden sun, golden light shafts, warmer planet illumination
  and thin ivory/gold haze catching that sunlight. The author's visual review
  rejects a dense pale wash: dark space and clear stars must remain visible
  through sparse illuminated wisps. Floating text stays luminous ivory, without
  panels. Combat keeps its existing blue space lighting.
- **Entering Colonization from the main menu** uses the wormhole-like effect:
  shrink the outgoing system, bend its surrounding light, then expand into one
  large colony planet. The author explicitly confirmed this placement; planet
  arrows do not repeat the wormhole effect.
- Successful garden entry still releases one shuttle after actual admission.
  The other stays aboard the carrier. The departing shuttle uses controlled
  flight and airflow, with no military pod flames.

These are cosmetic changes. They do not change accounts, campaign membership,
saved terrain, farming rules, quotas or resource balances. Reduced motion,
interrupted navigation and failed admission must remain usable.

## Asset preparation

The built-in `image_gen` tool extracted the selected middle overhead ship and
prepared a matching overhead shuttle. Source sheets and the earlier assets are
preserved. No other direction from the four-view sheet is used at runtime.

| Runtime asset | Native dimensions | Rendering crop |
| --- | --- | --- |
| `public/assets/entry/mycorrhizal-white-gold-top-v1.png` | 2172 x 724 | x36 y162, 2100 x 402 |
| `public/assets/entry/mycorrhizal-shuttle-top-v1.png` | 2079 x 756 | x48 y84, 1980 x 588 |

These are native generated PNGs, not upscales. Cropping is a source rectangle
when drawing; runtime PNGs are byte-for-byte copies of the source assets. Both
have genuine alpha. Full prompts are saved alongside the source PNGs:

- `output/video-frames/mycorrhizal-white-gold-top-v1-prompt.txt`
- `output/video-frames/mycorrhizal-shuttle-top-v1-prompt.txt`

The runtime manifest records hashes, sizes and provenance. Ship orientation and
bow attachment coordinates remain presentation data, separate from any game state.

## Implementation and local checks

Implemented on 1 November 2026. Planet travel lasts 2.8 seconds: turn, accelerate,
exchange worlds, decelerate and settle. Main-menu entry uses a separate
1.8-second circular lens transition. Its twelve image layers reuse cached
frames; the sky and light textures are cached too. Colony sprites load only
when the colony scene needs them.

The final presentation retains a dark universe, sparse sunlit haze and clear
stars. The early cream-sky trial was rejected and its review captures replaced.

Local validation:

- 20 unit checks passed across colony ship motion, the system transition and
  the existing combat entry ship; TypeScript passed.
- All 8 colony browser cases passed on the final dark-space revision, covering
  desktop and phone, all three planets in New/Continue, two docked shuttles,
  one-shuttle departure, admission/refusal, skip, reduced motion, both arrow
  directions, rapid reversal, Back and reload.
- 6 existing combat entry browser cases passed, covering planet selection,
  admission-gated pod entry, failure/retry, reduced motion and save creation.
- Fixtures were isolated from developer saves. This stage was not deployed.

The [validation record](testing/evidence/2026-11-01/colony-white-gold-validation.json)
contains final source hashes and 46 review captures. Selected final previews:

- [Desktop orbit](testing/evidence/2026-11-01/colony-white-gold-desktop-overhead-orbit.png)
- [Phone orbit after travel](testing/evidence/2026-11-01/colony-white-gold-phone-travel-right-settled.png)
- [Wormhole collapse](testing/evidence/2026-11-01/colony-white-gold-desktop-wormhole-collapse.png)
- [Shuttle release](testing/evidence/2026-11-01/colony-white-gold-shuttle-desktop-release.png)

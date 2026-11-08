# Enemy art stage

9 November 2026. The author supplied seven concept renders
(`output/enemy-review/`: Hunter, Breaker, Berserker, Twin laser, Heavy laser,
Siege centipede, Swimmer) and asked for them to be simplified into the game's
overhead style, keeping their core features. Claude drew sketch v1
(`output/enemy-review/sketch-sheet-v1.png`, `sketch-battlefield-v1.png`); the
author approved it ("Well done! And yes place apply them into the game, maybe
with animation to fit their logics!"). Built locally; awaiting the author's
playtest.

## Implemented behaviour

Presentation only. No enemy kind, profile, hit circle, label, price or save
format changed. `public/enemy-art.js` draws every creature in flat shapes, front
toward -y, 48 px a tile; the old entry points (`drawCrawler`, `drawLensCrawler`,
`drawCentipede`, `drawSwimmer`) delegate to it, so corpse sprites and salvage
remains use the new art too.

| Kind | Look kept from the concept |
| --- | --- |
| `hunter` | Rust heart carapace with seam, two open mouth-heads (no eyes), two open serrated clamps, four legs, four back vents |
| `breaker` | Long gold body, forward chevron plates, two necked mouth-heads, oversized open clamps, four long legs |
| `bulwark` (Berserker art) | Broad slate wedge, prow spike and two pikes, plate tips serrate the outline, legs hidden but for four claw tips |
| `twin-lens` | Two banded lens barrels with teal apertures, two separate four-fin radiators, six slim legs |
| `heavy-lens` | One stepped barrel across the front, radiator ribs joined across the back, six thick legs |
| `centipede` | Flower maw of five toothed petals, gold chevron plates, a brood port on each flank with a leg either side, soft tail tentacles and two antennae |
| `swimmer` | Swept fins and forked tail, long toothed mouth, amber core feeding two vessels to two tail propellers |

The bile spitter and skimmer drawings are unchanged.

## Animation follows saved state

- Legs step with the enemy's rendered travel (`position.stride` in `app.js`),
  so they settle when it stops; nothing is inferred from animation time.
- Melee windups follow the saved `attack.at`/`windup`: Hunter clamps rise and
  gape; Breaker clamps pull back and open; the Berserker rears back as its pikes
  close; the centipede's petals spread; the Swimmer's mouth widens. The saved
  `strike` (250 ms) snaps clamps, petals and jaws shut and lunges the Berserker.
- A blocked hit (`armorHitAt`, 600 ms) lights the Berserker's plate edges gold.
- Lasers follow `airLaser`: barrels turn to the saved bearing (eased, snapped
  while firing) and face forward while watching; legs spread when braced; the
  aperture ring focuses through the charge; radiators heat through charging,
  run hot while firing and cool over the saved cooldown. The visible beam now
  starts at the drawn aperture; the server ray still decides hits.
- Idle breathing (vents, jaws, ports, petals, tentacles, heat shimmer) stops
  under reduced motion; travel-driven legs remain.
- Remains darken and curl their legs; burning (fleeing) keeps its flames.

## Author decisions

The author accepted both choices on 9 November 2026 ("it is Bulwark, your
choice is acceptable"):

- Heavy laser art stays near its previous footprint
  (`ENEMY_ART_SCALE['heavy-lens']`), close to the shared 0.38-tile hit circle,
  rather than the earlier 2.5x request.
- The armored melee enemy keeps the name Bulwark and its labels
  (`BULWARK / HE + MAG`); it wears the Berserker concept art.

## Hostile facilities

The author then asked whether the enemy facilities could be improved, with no
concept references ("if you think you can improve? Here no reference"). Claude
drew facility sketches v1 (`output/enemy-review/facility-sheet-v1.png`,
`facility-battlefield-v1.png`) in the creatures' language; the author approved
them ("Wow, those fit! Haha, please load them!"). Built locally the same day.

`public/facility-art.js` draws a shared rooted bed (a lobed tissue pad and eight
roots gripping the ground with bone hooks) and one body per site kind;
`drawConquest` calls it in place of the old tendrils and body renderers, which
were removed. Labels, health bars, territory, compound connections, footprints,
collision, salvage and every warning (scan ring and sensor beam, alarm ring,
lance charging ring, flak, acid and vent warnings, INCOMING markers) are unchanged.

| Kind | Look | Follows |
| --- | --- | --- |
| `alert` (Sensory crown) | Bone sensory fronds round a teal receptor | `sensor.angle` (receptor looks along the beam), scan pulse, tracking (amber, fronds lean), `alarm` (red tips) |
| `mortar` (Bile mortar) | Gold shell rim round a green acid sac, thick siphon | `mortar.angle`, `charge` over `MORTAR.windup` (sac swells, mouth glows), `firedAt` (kick and spurt) |
| `modifier` (Blight root) | Five spiral roots with brood nodules round a closed flower bud | The root's own giant warning (`combat.encounters.centipedes`, matched by `rootId`): the bud opens and the maw glows over the 10 s warning |
| `laser` (Lance tower) | Long stepped lance with a teal aperture over six radiator fins | `laser.angle`, charge over `LASER.charge` (aperture focuses), firing (hot), cooling over `LASER.cooldown`; the visible beam starts at the lance tip (`LANCE_REACH`), the server ray still decides hits |
| `anti-air` (Spore flak) | Gilled puffball cap with three stubby spore cannons | `aa.angle`, charging (mouths glow), firing (spore rings) |
| `contaminator` | Ribbed gas bladder with five exhaling chimneys | Breathing only; it sits inside its own opaque fog while hostile |
| `aquatic-hive` | Green reef mound, egg pods round a spawning pool, three vents | Regenerating (pods glow), `hitAt` within `AQUATIC.healDelay` (pods dim) |

Conquered sites darken and collapse. Idle motion stops under reduced motion.
Bodies off screen are skipped, and beyond zoom 0.3 the bed's roots are skipped.

## Evidence

- `output/enemy-review/ingame-facilities-v1.png`: every facility in each state,
  drawn by `drawConquest` with labels, bars, warnings and the lance beam
  (`node output/enemy-review/render-ingame-facilities.mjs`).
- Local live facility check in an isolated save (`.local/facility-art-live.mjs`):
  six land facilities round a deployed robot at 1920×1080 and 390×844; the crown
  tracked and alerted, flak fired and cooled, acid landed, no page errors, no
  phone page scroll. `tests/browser/centipede.spec.js` (shared Root emergence)
  and `tests/browser/contaminator.spec.js` (desktop and phone) passed.
- After the facility change, `pnpm typecheck` passed and `vitest run` passed
  1381 of 1382, the one failure again `spec/campaign-mode.test.ts`. A first run,
  made while the browser specs were running, also reported one unhandled error
  whose details were not kept; it did not recur in two later runs, and its cause
  was not identified.
- `output/enemy-review/ingame-states-v1.png`: every creature in each state,
  drawn by the game's renderers (`node output/enemy-review/render-ingame.mjs`).
- Local live check in an isolated temporary save (`.local/enemy-art-live.mjs`):
  all kinds near a deployed robot at 1920×1080 and 390×844; lasers charged,
  fired and cooled, melee hits landed, no page errors, no phone page scroll.
- `pnpm typecheck` passed. `pnpm test`: 1369 of 1370 passed; the one failure,
  `spec/campaign-mode.test.ts` (a fourth peaceful expedition is accepted where
  the slot limit expects 409), fails the same way alone and sits in the
  uncommitted `campaigns/service.js` colony work; no server module imports the
  art files.
- `tests/browser/mobile-laser.spec.js` passed at desktop and phone (run with a
  config without the shared 8082 server, which another local process held).

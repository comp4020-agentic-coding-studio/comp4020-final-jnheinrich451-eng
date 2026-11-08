# Colony companion and fishing: the spider, the lake and the creel

8 November 2026. The author's brief, in their words: "add a fishing, maybe a
pool, function, and a pet system, which can close the expansion of this
task", approved as "the fishing? And the pet please! And then the
refinements!". This record holds the stage as built. It follows
`docs/COLONY_WAREHOUSE_STAGE.md` and draws on the recorded companion design
in `docs/COLONY_MECHANICAL_SPIDER_PET.md`: a curious companion, never upkeep.
With it the colony's function set is closed; what follows is refinement of
maps, UI and art.

## Fishing (an activity, `public/colony-rest.js`)

| Rule | Value |
| --- | --- |
| Where | Within 1.6 tiles of a lake tile or a ready pond furnishing, in the home district. The cast point is the nearest such cell centre; the worker faces it |
| Cast | `fish` starts the activity where the worker stands. A bite comes after 4 to 9 seconds of active room time, chosen by a hash of the angler and the expedition's cast count, so a restart or a test replays the same wait; no wall clock, no randomness |
| Bite | Lasts 3 seconds. `reel` during it records a catch; after it the line recasts by itself. A bite that would have expired during a frozen gap counts as missed |
| Catch | Species by weighted hash (Silverfin 10, Pebble carp 6, Moonscale 3, Lantern eel 1) with a length in its range. It goes into `state.fishing`: the last 60 catches, the best length per species, and `treats`, the fish not yet given away. Nothing is sold |
| Stopping | Any movement, or E while waiting, stands the worker up where it was |

## The companion (`public/colony-pet.js`)

| Rule | Value |
| --- | --- |
| Adoption | The Companion dock button (Camp until 9 November), 8 materials, once per expedition. The spider appears two tiles south of the pad, already happy. Shared colony state, saved with the garden, absent from remote district views |
| Following | Each server tick it keeps company with its friend (the last worker who petted it) if present at home, otherwise the nearest connected worker. It walks at 3.2 tiles/s with the worker's collision rules, starts when 1.7 tiles away and stops at 1.4; it never teleports |
| Resting | When its companion rests or fishes it walks to a clear spot beside them and sits |
| Noticing | When its companion has stood still for 3 seconds and a planted bed or a furnishing is within 3 tiles, it turns to it for 4 seconds, then may notice something else |
| Petting | E within 2 tiles: it purrs, remembers the friend and counts the pet. With a fish in the creel the fish is given, the spider spins with joy, and the creel and its fed count change. Nothing else changes: no mood meter, no hunger |
| Alone | With nobody home it sits and waits |

## Presentation (browser-only; reduced motion settles)

- One prompt above the field for everything E does nearby, in order: a crate,
  the current activity (Stand up, Stop fishing, Reel in), a seat, water
  (Fish), the companion (Pet). Phones tap it.
- Fishing pose (`public/colony-robot.js`): rod, line and a float at the cast
  point; the float bobs with a slow ripple, and on a bite dips and pops with
  chasing rings while the rod bends.
- The spider (`public/colony-pet-art.js`): a furry round body over a white
  shell with a violet panel, a small head with two cyan sensor eyes that blink,
  eight stepping legs, a tucked sitting pose with breathing, a tilted noticing
  pose with a raised antenna, and hearts (with a hop when happy). Its picture
  eases toward each packet so server movement never jitters.
- The companion panel (part of Camp until 9 November, below) shows the companion
  line (pets and fish given) or the adopt button, and the creel with the best
  length of each species.

## Validation (8 November 2026, disposable saves and servers)

- `pnpm typecheck` passes.
- Vitest, ten colony files against a disposable server: 115 passed.
  `spec/colony-pet-fishing.test.ts`: casting needs water or a pond, the bite
  timer is deterministic and a copy of the state replays the same catch, a
  missed bite recasts, moving ends the session; adoption costs and refuses
  twice, the spider closes distance at its own speed without teleporting,
  notices a planted bed, purrs, takes a treat, forgets a reaction, sits beside
  a resting worker, waits alone, and stays out of remote views. The runtime
  test adopts through the API, watches the spider walk over, places a pond,
  walks to it, fishes until the server's bite, reels, feeds the catch and
  finds everything after a restart.
- Playwright `tests/browser/colony-companion.spec.js`, pinned to the
  E-cores: desktop and phone fish a seeded pond through the prompt, reel on
  the bite, adopt from Camp, are followed west, and feed the catch: 2 passed,
  together with rest 2 and warehouse 2. The first run found the spider parked
  2.2 tiles away on the phone, out of petting reach: it now starts walking at
  1.7 tiles and petting reaches 2.

Evidence: [fishing, desktop](testing/evidence/2026-11-08/colony-fishing-desktop.png),
[fishing, phone](testing/evidence/2026-11-08/colony-fishing-phone.png),
[companion, desktop](testing/evidence/2026-11-08/colony-companion-desktop.png),
[companion, phone](testing/evidence/2026-11-08/colony-companion-phone.png).

Known limits: the spider has no name of its own yet and no petting animation
on the worker; it notices beds and furnishings only, not machines or water;
there is no sound. The author asked for refinement next, so poses, timings,
species and prices are provisional.

## Its own place in the dock (9 November 2026)

The author found the pet hard to notice inside Camp and asked whether it should
have its own button in the dock, and whether Bed and Sprinkler could move inside
Garden if the dock grew too long. A ninth button would have crowded the phone
dock, so both were done: the dock goes from eight buttons to seven (five on
older worlds without Furnish and Explore).

- Garden places beds and sprinklers. Its panel keeps the ground readout and the
  bed list, and adds "Place bed" (free for the first bed, and the main button
  until one exists) and "Place sprinkler · 12", with a count line. B still
  places a bed, and Garden stays lit while either is being placed.
- Companion has a spider icon in muted violet. Its small line reads "Adopt a
  spider" until adoption, then the spider's name. Its panel shows the garden's
  own spider drawing, seated and turned three-quarters so both eyes and the
  violet panel show, even before adoption. Then it shows the adopt button, or
  the pets and fish given, the name field, and "Find" followed by the name,
  which moves the camera to it. The fishing line and the last catches moved
  here from Camp, since the fish are its treats. Clicking the spider in the
  garden opens the panel too.
- Camp keeps fire, film and sky.
- Presentation only: adoption, renaming, petting, costs and saves are unchanged.

Checks, in disposable saves, pinned to the E-cores:
- `pnpm typecheck` passes.
- The colony browser specs that used the old buttons were updated: they place
  beds and sprinklers through Garden, adopt through Companion, check that the
  panel title and dock label follow the name, and count seven dock buttons.
- The companion, ambience, industry, Morrow exploration, nearby inspection,
  tilted view, gardening and world expansion specs, desktop and phone: 17
  passed. After the portrait was turned three-quarters, the companion spec
  passed again, 2 of 2.
- A local screenshot script (not part of the suite) captured the Garden panel
  and the companion panel before adoption.

Evidence: [companion panel, desktop](testing/evidence/2026-11-09/colony-companion-panel-desktop.png),
[phone](testing/evidence/2026-11-09/colony-companion-panel-phone.png),
[before adoption, phone](testing/evidence/2026-11-09/colony-companion-adopt-phone.png),
[Garden panel, desktop](testing/evidence/2026-11-09/colony-garden-panel-desktop.png),
[phone](testing/evidence/2026-11-09/colony-garden-panel-phone.png).

The author has not played it yet.

# Colony ground: make the ground the game

4 November 2026. Design review and the first implemented stage of a spine for
the peaceful expedition. The author asked for an assessment of why the mode
felt odd and for a more reasonable design, then approved recording it and
implementing its smallest version first. The rest of the design below is a
roadmap, not authorization.

## Why the mode felt odd

Every colony stage is carefully built; the problem is that there was no single
idea beneath them. The combat game has one: a defeat always leaves a way back,
and the way back costs something. The colony had a stack of cozy-game
conventions, one per toolbar tab, under a planetary-colonization fiction the
play never cashed.

- The fiction is planetary; the play was a backyard. A carrier crewed by
  preserved human heads arrives to adapt the planet. The player then waters
  three small beds and sends two berries to orbit. Nothing changed the planet.
- Nothing consumed anything. Materials were the only currency and decoration
  its only sink. The industry chain turned two crops into provisions that sold
  for 24 instead of 16; power ran the machines that made the fuel for power.
- The economy had no decisions: free seeds, free water, a free first bed, a
  shipment every 45 seconds, and a decorated-home screenshot showing 352 unspent
  materials.
- The clock was a demonstration clock. Growth took 45 to 150 seconds, deliveries
  eight; nothing happened while away, everything happened while watching.
- The robot was a cursor with legs at home (every command works remotely) and a
  body only in the exploration regions.
- Three destinations, one game: furnishing, projects, regions and discoveries
  exist only on Morrow. Nacre and Aurelia are the same crops on another palette.
- Eight toolbar tabs, three entry-ceremony records and a licensed feature film,
  for a mode the README calls unfinished.

## The spine

**Turn alien ground into human ground, and watch the map change.** Every
home-district tile carries a conditioning level. Crops condition the ground
beside their bed. Construction needs conditioned ground. Ground that nothing
tends slowly returns to wild. The map itself becomes the progress bar, and the
existing systems gain a purpose rather than a new feature:

| Existing system | Purpose under the spine |
| --- | --- |
| Beds and crops | Advance the frontier: a bed on the edge conditions the next ring, so the next bed can hop outward. A ripe crop left standing keeps conditioning, so harvesting now trades against terraforming. |
| Sprinklers | Dry crops pause and stop conditioning, so irrigation protects the frontier. |
| Furnishing, camp, industry | Only on ground the expedition made; the settlement is literally the thing you grew. |
| Starting clearing | Never reverts: the way back is always there. |

This stage implements exactly that: the overlay, crop conditioning, the
construction rule and gentle reversion. It changes nothing else.

## Implemented rules (provisional balance)

Ground lives in `public/colony-ground.js`, shared by server and client, with no
combat import. Values are provisional until the author playtests.

| Rule | Value |
| --- | --- |
| Levels per tile | 0 (wild) to 8 (conditioned); stored as a run-length string, home district only, never on water or rock |
| Starting clearing | Land within 10 tiles of the hub's reference tile starts conditioned and never reverts (the shuttle pad and the free first-bed sites sit inside it) |
| Conditioning source | A live crop: planted and watered, or ripe and waiting; dry (paused) and empty beds do nothing |
| Reach | From the bed centre, tiles up to 2 away (the footprint and one ring) gain a level every 5 active seconds; tiles 3 and 4 away gain on every second step |
| Time to condition | 40 seconds for the first ring, 80 for the outer two, with at most one level per step however many crops reach a tile |
| Why reach 4 | Beds cannot overlap, so the next bed sits 3 tiles out and needs ground 4 tiles out; the frontier advances one bed hop at a time |
| Construction | Beds, sprinklers, camp items, machines, belts and furnishings need every footprint tile at full level, after the usual terrain, occupancy and route checks and before the cost check |
| Boundary | Conditioned ground replaces the 14-tile survey radius for beds and sprinklers, so the frontier can cross the whole district; camp items and industry keep the 14-tile radius and furnishing its 18 in this stage, and those kinds still show the dashed ring while placing |
| Held ground | Any tile within 1 of the hub, pad, a bed footprint, sprinkler, machine, belt, camp item or furnishing, or inside the starting clearing |
| Reversion | Unheld conditioned ground that no live crop reaches loses a level every 30 active seconds (four minutes from full to wild); nothing built is ever removed |
| Clock | Active room time only, in whole 5-second steps: pause, host loss and closed rooms freeze it, like growth. Ground steps are the same whether time arrives in one tick or many; each step reads the crop state the runtime's quarter-second ticks have already advanced |

The outer two rings are held only while a crop lives there. Harvesting a frontier
bed therefore starts the clock on the ground beyond it; leaving the crop standing
keeps conditioning. That is the one new decision the spine adds, and the only
pressure: lose ground, never construction or saves.

Old saves are migrated additively when the expedition opens: a pre-ground save
first gets `colony-before-ground-v1.sqlite` beside it (the same validated
VACUUM INTO snapshot as the industry and expansion backups), then the starting
clearing and every tile under or beside existing construction is marked
conditioned, so nothing already built becomes invalid. This is the one
initialization that runs on open rather than on a player's first order, because
the reversion clock has to exist before the first tick. Because a refusal here
would close the expedition rather than one order, an unreadable or foreign
backup file is renamed aside with an `-invalid-` suffix and a fresh snapshot is
taken from the live garden, which is still the exact pre-ground state. Moving a
furnishing and undoing it works even if its old site lost a level meanwhile: an
undo restores, it never builds new. Existing terrain, beds
and equipment are untouched; exploration regions have no overlay and remote
viewers never receive the home one.

The player sees four things, all browser-only and all read from the ground
levels the snapshot already carries (the author's first new world showed the
earlier faint tint and they could not see the difference):

- Wild land is drawn rough and cool, with sparse dark tufts; made ground is a
  clear pale loam with faint furrows, so the clearing reads as worked ground.
- The frontier is a stepped two-tone edge: a pale lip on the made side and a
  darker seam on the lower side. Growing tiles warm and strengthen level by
  level toward it, with one small warm dot per level gained.
- The Garden tab reads the conditioned tile count beside the bed count, the
  garden panel reads conditioned and growing tiles, and the header's next step
  says "Plant a seed to widen your ground" until the frontier has moved once.
- Placement mode shades every tile that cannot take construction, whatever is
  being placed, so the buildable area is visible before the click. A refused
  tile still explains itself: "Grow a crop nearby to condition this ground first."

The field guide states the rule in three short sentences.

## Roadmap after the spine (proposals)

- Let conditioned ground bound industry and furnishing too, retiring the
  remaining fixed radii once outlets and shuttle deliveries far from the hub
  have been playtested.
- Planet soils: each wild kind (meadow, mineral shore, wetland) conditioned by a
  different crop, giving Nacre and Aurelia mechanical identity rather than a
  palette.
- The body at the frontier: remote commands inside conditioned ground; wild
  ground needs the robot present with a conditioner, giving exploration a reason.
- Industry consumers: biomass becomes soil conditioner, power runs conditioning
  towers, provisions feed authored requisitions at the orbital post.
- Rejected, 4 November 2026: a finish line (a conditioned corridor to a
  landing field commissioning a freight link). The author's design is a game
  to hang around in and nurture, a warm little space built from what the player
  likes; it has no ending. Rewards must be gifts for tending, never a win state.
- Growth in minutes rather than seconds; one Build shelf instead of five tabs;
  the colony's own save slots. The last two change working-agreement rules and
  need the author's decision.

## Validation

Local checks on 4 November 2026 with disposable accounts, servers and data
directories; no author save was opened. This is not a deployment claim.

- `pnpm typecheck` passes.
- Vitest, 18 colony and campaign files against a disposable server:
  145 passed, 0 failed, first attempt. `spec/colony-ground.test.ts` holds the
  19 rule tests (encoding, the start disc on four planets, placement refusals
  for every construction kind and their precedence before cost, the 40 s and
  80 s conditioning times, one level per step under overlapping crops, water
  and rock never conditioning, dry and empty beds, the 30 s-per-level
  reversion with held tiles and the clearing at full and nothing built
  removed, ground-step equivalence across tick sizes, JSON round trip,
  migration around every construction kind, undo after a site lost a level,
  healed hand-edited counters, remote-region blanking).
  `spec/colonization-runtime.test.ts` gains two open-time migration tests:
  the pre-ground backup is written once, passes an integrity check and a
  second restart leaves it untouched; an unreadable backup file is moved
  aside and replaced rather than refusing to open the expedition.
- Three existing unit tests moved fixtures or expectations: the survey-radius
  bed now expects the ground message while a campfire beyond 14 tiles still
  gets the survey message; one sprinkler-range bed and one starter-kit
  generator moved inside the clearing with their assertions unchanged.
- Playwright, 14 colony specs in one run pinned to the E-cores: 28 passed,
  0 failed, no retries. `tests/browser/colony-ground.spec.js` checks the
  readout, a refused wild placement with its toast and the placement shade,
  and a watered crop raising the frontier count on desktop and on the 390 px
  phone; on desktop it also plants a second bed on the clearing's west edge
  and waits for a near-ring tile outside the clearing to reach level 6, so the
  evidence shows the growing gradient. The two industry specs moved their
  conveyor chain inside the clearing; the chain still delivers provisions and
  biomass. The second visual pass (same day) reran this spec: 2 passed.
- The renderer probe measured desktop-full 3.35 ms mean / 4.5 ms p95 and
  phone-full 2.90 / 4.10 ms with the overlay, against 6.46 / 8.60 and
  5.51 / 7.40 ms for the same scene on 2 November. Machine load and the Chrome
  build differ between runs; the point is that the cached overlay added no
  measurable drawing cost, not a capacity figure.

Evidence: [desktop](testing/evidence/2026-11-04/colony-ground-desktop.png),
[phone](testing/evidence/2026-11-04/colony-ground-phone.png),
[placing, desktop](testing/evidence/2026-11-04/colony-ground-placing-desktop.png),
[placing, phone](testing/evidence/2026-11-04/colony-ground-placing-phone.png),
[renderer probe](testing/evidence/2026-11-04/colony-render-ground-stage.json).

Two independent reviews of the diff (one hunting correctness bugs with
reproduction scripts, one checking the working agreement and test honesty)
found no hard defect. They led to the backup replacement above, the undo
exception, a private copy from the public levels accessor so no caller can
corrupt the shared decode cache, the camp ring staying visible while placing,
and the browser spec keeping the world JSON in Node.

Known limits: the frontier edge is drawn only against lower land, never along
shorelines, so a clearing that meets water has no lip there; a crop that dries inside one long tick conditions nothing for
that tick, which the quarter-second runtime tick keeps below one step; editing
any public file changes the shared client build, so open combat tabs reload
once after this stage is deployed.

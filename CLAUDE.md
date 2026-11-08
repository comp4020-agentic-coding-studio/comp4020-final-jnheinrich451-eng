# Frontier working agreement

This file holds the rules in force now, grouped by topic. It is not a history:
dated decisions, evidence and stage narratives live in `PROCESS.md`, `docs/` and
git. When a rule here and an older stage doc disagree, this file and the newest
stage doc win; see "Superseded behaviour" at the end.

## What good means here

`README.md` argues one idea: a defeat always leaves a way back, and the way back
costs something. The rules below follow from it. A change must never remove the
last route back (robot recovery, the emergency core and HE tank) or make a loss
free (ruins, spent budgets and permanent conquest stay). Frontier stays small on
purpose, at one to four players. New README claims need a rule here and a check
in `spec/`, or must be labelled as judged, with how they were judged.

## 1. Sources of truth and precedence

- Follow the final-project contract and keep the two supplied spec invariants
  (`spec/invariants.test.ts`).
- `GAME_DESIGN.md` is the central design guide. Read it before proposing a stage;
  keep its agreed boundaries and separate current behaviour, proposals and open
  questions. It does not authorize the whole roadmap.
- `GAME_DESIGN_WORKSHEET.md` is the author's fill-in companion. Accept informal
  answers and unknown numbers; its examples are proposals. Turn answers into a
  bounded stage brief, not an instruction to build every card.
- `GAME_IDEAS.md` is the larger vision; brainstormed features are not required.
- `README.md` argues for a solo-playable cooperative campaign (defend, build,
  expand, operate facilities and vehicles, secure the planet). Keep current
  behaviour separate from that roadmap; update it only at agreed checkpoints.
- Each mechanic's detailed numbers and edge cases live in its `docs/` stage
  record. A later stage record supersedes an earlier one; always check for one.
  Keep incremental implementation detail in those docs and their tests, and
  summarise only lasting rules here.
- A design record (for example `docs/BOMBER_AND_SUPPORT_NETWORK.md`) is not
  authorization to implement everything it describes.
- Agriculture belongs to the separate peaceful colonization expedition in
  `docs/COLONIZATION_MODE_DESIGN.md`: a later human-head-operated, AI-assisted
  ship develops a secured planet for human society. Do not merge farms into
  active combat or its economy. The approved standalone first stage is recorded
  in `docs/COLONIZATION_STAGE.md`: a separate mode/runtime/save, relaxed growing,
  shared harvests and orbital sample deliveries. The approved industry stage
  adds automation and power below. A post-conquest handoff remains a proposal;
  never convert existing combat saves.
- Colony art shares Frontier's human machinery identity. The author's first
  review retains the warm environment but calls for unified robot/facility
  construction, a dedicated menu/save branch and MYCORRHIZAL shuttle arrival.
  `docs/COLONIZATION_VISUAL_DIRECTION.md` separates that direction from the
  proposed camera angle, planet briefs and unimplemented changes.
- The first colony art pass (`docs/COLONIZATION_ART_PASS.md`) uses the author's
  agricultural robot sheet: four arms and a cyan visor, simplified for play.
  The author's later choice replaces its feet with four compact track pods,
  rolling belts and light suspension; retain the upper body and white/violet
  machinery. White metallic facilities and illustrated scenery share a fixed
  55-degree projection. Keep picking, placement and dragging on the same
  projection; compact guidance retains instructions and failure reasons.
- Colony facilities share the worker's illustrated mechanical construction:
  white panels, graphite frames, glass and restrained colored accents. Detail
  their fixed camera-facing surfaces and roofs; facility turnaround views are
  unnecessary for the current camera.
- Colony Esc closes the foremost help/menu/inspector or cancels placement, then
  opens the Crew menu from clear play. Movement smoothing stays enabled when
  cosmetic animation is reduced; follow the rendered worker with the camera.
  Track phase comes from actual rendered travel and settles when stopped. Static
  machinery may be cached without changing depth order or dynamic crop/flight
  effects. See `docs/COLONY_MOVEMENT_AND_PERFORMANCE.md`.
- Colony daylight/weather belongs to the host expedition's one saved
  server timeline. Host and guests receive the same authoritative state; joining
  or reconnecting replaces stale guest visuals with the current room snapshot.
  Device clocks and local weather rolls cannot decide shared effects. Freeze
  time with the existing host/room lifecycle and resume the saved phase. The
  24-minute day and seeded six-minute weather slots are visual-only in this
  stage; host-only presets cannot advance crop, shipment or movie timers.
  Rain does not yet water crops. See `docs/COLONY_ANIMATION_AND_MEDIA.md`.
- Colony Camp offers up to four free campfires and one free cinema for the
  initial visual stage. Placement protects workers, existing equipment and
  essential routes. Movie playback uses the shared active clock; audio is
  personal, media loads on demand and offscreen/hidden decoding pauses.
  Retain Big Buck Bunny's full credits and bundled attribution/license.
  Reduced effects simplify particles while preserving smooth movement.
- Colony controls use one compact header and a contextual bottom dock, with a
  smaller phone inspector. The separate Colonization menu browses peaceful saves;
  Combat Continue browses combat saves. Morrow, Nacre and Aurelia use stable
  civilian IDs and shared globe/surface palettes. Preserve legacy colony worlds
  and their saved terrain; never admit civilian IDs into combat. See
  `docs/COLONIZATION_HUD_AND_PLANETS.md`. Each account owns three war-zone
  campaigns and three peaceful expeditions; a deletion frees only its own mode's
  slot and joined saves use none (author, 8 November 2026; evidence in
  `docs/CAMPAIGN_STAGE.md`).
- Furnish and Explore open on Morrow, Nacre and Aurelia alike (author, 9 November
  2026). Each world has its own two regions of three discoveries, each gifting an
  item from the shared catalogue; Morrow's regions generate exactly as before.
  Legacy expeditions on older templates keep neither. Planet-specific furnishings
  remain a proposal. See `docs/COLONY_MORROW_EXPANSION_STAGE.md`.
- Colony bed information follows the local worker on approach. Automatic
  inspection never pans the camera or tends crops. Keep neighboring selections
  stable, respect explicit tools and manual inspection, and honor dismissal until
  leaving/re-entering. Phone movement stays available above an automatic panel.
  See `docs/COLONY_NEARBY_INSPECTION.md`.
- Colony ground is the mode's spine: every home tile carries a conditioning
  level, live crops condition the ground around their bed, all construction
  needs fully conditioned ground, and untended ground slowly reverts. The
  starting clearing never reverts and nothing built is ever removed. Conditioned
  ground, not the survey radius, bounds beds and sprinklers. Ground uses active
  room time in whole steps; a pre-ground save is backed up and initialized
  additively on open. The colony has no ending: the author's design is a
  building-and-nurturing game players hang around in and shape into a warm
  home, so no finish line, win state or freight-link ending (rejected 4
  November 2026). See `docs/COLONY_GROUND_STAGE.md`; later layers (planet
  soils, the body at the frontier, industry consumers) are proposals there.
- Colony life: a returning shuttle unloads its reward as material crates beside
  the pad (four materials each; what cannot land is credited at once, never
  lost). A worker collects by walking up and pressing E, or a crate collector
  gathers crates within seven tiles for one power each. Crates block
  construction until collected and never block walking. Working machines,
  belts and sprinklers must read differently from idle ones; decoration motion
  and shuttle dust are browser-only and settle under reduced motion. See
  `docs/COLONY_LIFE_STAGE.md`.
- Colony living: the settlement reads as production (Garden, which places beds
  and sprinklers, and Industry) and living (Camp, Companion, Furnish) by dock
  and catalogue habit, never by a zoning rule. A worker may sit on a bench or
  rest pad, charge at a charging post or brew at a kettle: E within 1.6 tiles, a
  clear tile in front of a post or kettle, any movement or E stands it up where
  it entered or on the nearest clear tile. Resting is per-person runtime state
  carried in the player record (never the colony save), grants nothing and
  changes nothing in the garden. Poses, cables, steam and lamp pulses are
  browser-only and settle under reduced motion. Approved 8 November 2026 with
  fine-tuning deferred. See `docs/COLONY_LIVING_STAGE.md`.
- Colony warehouse: one 3 x 3 warehouse per expedition shows the shared
  reserve as stacked boxes (materials one side, products the other) without
  changing the numbers underneath, and its drone fetches every shuttle crate
  in the district for free on a saved, pausable flight. Hand collection keeps
  precedence until a crate hangs from the drone. Conveyors and crate
  collectors are hidden from the catalogue, not removed: saved ones keep
  working and the server still accepts them. Agreed order after this stage:
  pet and fishing, then refinement of maps, UI and art (8 November 2026). See
  `docs/COLONY_WAREHOUSE_STAGE.md`.
- Colony companion and fishing: fishing is an activity cast within 1.6 tiles
  of lake water or a ready pond, with a deterministic 4 to 9 s bite from a hash
  of angler and cast count, a 3 s bite window and auto-recast; catches go to the
  warehouse and are the only treats. One furry mechanical spider per
  expedition, adopted for 8 materials from its own Companion dock button (author,
  9 November 2026; Camp keeps fire, film and sky): shared saved state that follows
  its friend or the nearest worker at the worker's collision rules, sits beside
  a resting one, notices nearby beds and furnishings, and is petted or fed with
  E; no meters, no upkeep, no yield. The colony's function set is closed here;
  what follows is refinement (8 November 2026). See `docs/COLONY_COMPANION_STAGE.md`.
- Colony polish (author's brief, 8 November 2026): the shuttle departs still,
  on belly thrusters, lifts, pitches nose up, lights its main engine and flies
  out of view, then returns by a nose-up flare and hover landing, all from the
  saved shipment fraction; a trip is 14 s. The orbital post sends everything by
  default with one number per cargo (8 materials a crop, 12 a provision). Every
  build prints: one white-and-gold pod and frame for all objects, on the saved
  clock (`builtAt`, or a furnishing's delivery); printing never delays use.
  E on a bite hooks a fish into a hold-to-lift ring fight that the server
  replays from the recorded holds (`simulateStruggle`, arithmetic only) to
  decide the catch. Fish are seeded feature combinations in each world's
  colours; a catch shows the gold card and goes to the warehouse (the
  companion's treats; a full warehouse releases it). A bench seats its worker
  on the seat, facing out from the turned backrest. Reduced effects fade the
  parked shuttle away and back instead of flying it. The processor, bio plant,
  harvest outlet and sprinkler loop their moving parts when working, calmly
  when idle, and hold still when disabled or reduced. Any crew member may
  rename the companion (1 to 18 characters, cleaned). Full animation is the
  colony default whatever the system setting; only the header reduce switch
  (saved per browser, gold when on, says what it changed) reduces it,
  interface transitions included (author, 8 November 2026). Colony
  transitions pass through black: the garden fades in from it, Save and return
  fades out with the camera rising and no reason, and a room that ends fades
  away, names its reason on black and returns to the Continue menu, which keeps
  it. The menu's descent is graded by the garden's own light from the admission
  reply (night blue, dusk gold, rain); the war-zone dive stays daylit. See
  `docs/COLONY_POLISH_STAGE.md`.
- Colony industry uses real bounded local inventories and directional belts.
  Authoritative active room time drives production, fuel and transport; pausing
  freezes all of them. Keep manual gardening and raw-crop fuel/export as recovery
  routes. Dismantling preserves cargo and construction cost, refusing atomically
  if shared storage cannot hold recovery. First industry initialization must be
  additive and backed up; never reset established terrain or gardens. Industry
  tools take priority over nearby-bed inspection. Machines may cover the
  arrival tile: the runtime seats an arriving worker on the nearest open tile,
  and the walking-route check starts there too. An outlet or processor hands
  cargo straight into a machine standing on its output cell whose IN port sits
  on it, so a processor fits against an outlet without a belt (author
  correction, 4 November 2026). Shared power starts at 48 once per save
  (flag `starter`; an older industry save is granted once on its next tick),
  the processor cooks whichever crop it holds most of with no recipe setting,
  and a machine card is three lines and at most three plain buttons: Load picks
  the best cargo itself, with no dropdowns or inventory tables (author
  correction, 8 November 2026). A free OUT cell hands cargo to the shared
  reserve; a belt or machine on it keeps priority. Rotate skips directions
  that point an outlet into its bed. Power stays one shared reserve: cables
  and power areas were rejected on 8 November 2026. Robot batteries and the
  mechanical spider pet remain future designs. See `docs/COLONY_INDUSTRY_STAGE.md`.
- Colony entry uses the middle overhead view of the white-and-gold MYCORRHIZAL
  sheet with two bow shuttles. The resting heading is 15 degrees right of up;
  planet arrows turn, accelerate, exchange worlds, decelerate and settle.
  Destination copy and save lists switch only on arrival; Select/Create/Enter/
  Delete wait for that arrival. Rapid arrow presses commit only the latest trip;
  paused or unavailable animation commits immediately. The carrier is 80% of
  its original display size with three blue, flickering aft exhausts; shuttles
  retain wind-only atmospheric flight.
  The colony system keeps dark space and visible stars, with thin haze lit by
  golden sunlight; the author rejected a dense pale fog wash. Branch changes pass
  through a gravitational lens (author request, 9 November 2026; awaiting
  playtest): the planet bends into an Einstein ring around a wormhole mouth,
  aberration draws the whole sky into it, and the destination expands from the
  throat while stars stay visible. The ring and glow are gold entering
  Colonization and blue returning through War Zone; lensing stays achromatic.
  WebGL2 renders it; without WebGL2 the earlier 2D iris runs. Only branch changes
  use this effect. The revealed planet shares the live scene's rotation/lighting
  clock and backing resolution so the final handoff cannot jump from a stale image.
  New and Continue start on Morrow from the colony menu; legacy peaceful
  saves group under the three civilian worlds without terrain migration. See
  `docs/COLONY_LENSING_TRANSITION.md`. Admission gates one shuttle's controlled
  wind-only departure, with skip/reduced motion/failure recovery intact. See
  `docs/COLONY_WHITE_GOLD_VOYAGE.md`; this supersedes the angled steel carrier.

## 2. How we work

- Build and review playable stages: bounded brief → author approval →
  implementation → checks → author playtest → recorded correction. Start briefs
  from the player combat loop, success/failure, affected states and saved results.
- When the author corrects behaviour, record the lasting rule here (by topic) and
  the detail in the stage doc, not only in conversation.
- Record evidence honestly. Never invent the author's reflections, playtest
  conclusions, commit history or deployment success. Write reflections from real
  author/classroom findings. Use `pnpm check:evidence --crit=N` for a cutoff.
- Local checks never establish deployed behaviour or Fly capacity; say which
  evidence a claim rests on.

## 3. Invariants that apply everywhere

**Saves and migrations**
- Save accepted construction before reporting success; checkpoint movement and
  explain its durability window. Existing worlds never regenerate on reload.
- A confirmed save deletion is owner-only and requires a fully closed room.
  Atomically remove its registry, membership and invitation access, freeing the
  owner's slot. Private world files remain recovery archives; this is not disk
  purging. Retain account data, other saves and the legacy world.
- Never remap, move or regenerate existing records or player construction.
  Migrations back up populated saves first, then apply additive changes
  atomically. Never reset a campaign or the user's world for testing.
- Never retroactively charge for owned equipment or silently erase legacy guests.
- Four recommended landing clearings and denser cities are generated only for
  new named campaigns. Persist their layout and objective membership once;
  reopening an old campaign must not introduce these clearings or new cities.
  Landing choices are shared recommendations, not exclusive seats or safe zones.

**Server authority**
- The server enforces placement, ownership, costs and outcomes; browser drawings
  never decide shared results. Previews and server admission must agree.
- Keep terrain, territory, objects and rendering separate. Collision comes from
  world data, not sprite size or what is on camera.
- Particles, drones, wrecks' animation and cosmetic craters are browser-only.
  Never infer readiness from animation time; use saved countdowns.
- Client prediction reads `snapshotAge`, floored at zero: the frame clock can be
  older than a snapshot, and a negative age makes idle timers look live.
- HTML and snapshots share a build fingerprint computed at server start. Reload
  an outdated client before it consumes a new state format.

**Combat safety**
- Friendly entities never receive weapon damage.
- Conquest is permanent: no site-regeneration timers, recapture or refill of
  conquered sites. Facility loss never reverses conquest. Completion requires all
  saved member IDs; missing records never count as wins.
- Confirmed planetary conquest stops all new enemy arrivals, including natural
  raids, aquatic production and manual test contacts. Existing living/sleeping
  survivors and committed attacks remain for cleanup. The saved objective roster
  prevents empty or missing records from declaring victory.
- Ordinary ground defenders patrol locally, acquire visible targets and
  investigate last contact. Prefer players/occupied vehicles; only a bounded
  heavy subgroup prioritizes nearby infrastructure. Preserve bounded sensing
  and shared navigation work; raid dispatch is not live sight through cover.
- Accepted attacks (shells, strikes, weapon warnings) are never dropped,
  duplicated or rolled back across restart, pause or closure. Enemy-arrival
  warnings revalidate their source, occupancy and terrain and may cancel when
  invalid or when planetary conquest stops production.

**Runtime budget and capacity**
- Siege centipede: `docs/BROOD_CENTIPEDE.md`. Eight saved body parts share one
  enemy identity/HP pool; blasts and penetrating MAC rounds damage it once per
  projectile. Only living Blight Roots produce giants; root loss stops brood and
  replacements while survivors remain. One per island/two globally includes
  sleeping and pending giants. Brood shares existing island credit and the 24
  active-plus-reserved cap. Preserve protected starting cores, warned attacks,
  saved body geometry and the final-conquest spawn gate. Armor uses the existing
  heavy-enemy rule until the separate armor redesign is agreed.
- Mobile AA/skimmer: `docs/MOBILE_AA_AND_SKIMMER.md`. The AA uses tank movement
  and fires while moving; no anchored mode. LMB AA35 soft-targeting changes the
  turret solution, never the raw cursor; RMB remains ground APCR. Parked,
  unoccupied AA prioritizes air and shares hull reload with manual control.
  Held AA fire alternates barrels every 125 ms. Fresh sequenced input leases the
  trigger; release, focus loss, expiry and disconnect stop it without a backlog.
  Tracer dashes are bounded client effects of clipped, immutable shot paths.
  The fixed twin-barrel AA sentry is air-only: no ground fallback or weapon-mode
  conversion. It shares AA projectile capacity and waits for assembly before
  firing. Deployment, reload, barrel order and paid-wreck recovery are saved.
  Skimmers target robots and ground vehicles, never structures, ships or friendly
  aircraft. Explicit air eligibility applies before collision/damage and ground
  placement checks. Keep four skimmers maximum across live, sleeping and pending
  arrivals, within the shared 24-unit budget. Preserve released shots on restart.
- Ordinary city/roaming pressure uses geographic island budgets and the approved
  `1 + 0.7 × (eligible connected players − 1)` rate, once per island. Ocean
  separates budgets; bridges, inland water and mountains do not alter geography.
  Empty islands accrue no backlog. Roaming requires a living same-island source
  and a warned, revalidated approach; its fixed investigation is not live sight.
  Admission shares the 24 active-plus-reserved cap across guards, pressure,
  roaming, raids and aquatic enemies. Preserve survivors rather than deleting
  them to force quota fairness. Numbers/evidence: `docs/ISLAND_PRESSURE_STAGE.md`.
- New enemies and facilities need a tactical role and bounded runtime cost.
  Keep spawn cadence separate from living-population caps (shared 24 living
  enemies; at most four living mobile lenses). Evaluate simultaneous fronts
  before claiming the planet fits the budget.
- Fly baseline: one shared CPU, 256 MB RAM, the existing volume. A justified RAM
  increase may be discussed with the teaching team; document evidence and the
  agreed size before changing it.
- One to four players; named rooms admit four distinct participants. This is not
  validated sustained-combat capacity. Measure representative battles on the
  course machine before claiming capacity; if the cap must shrink, keep at least
  two simultaneous players. Unlimited gameplay counts never claim unbounded Fly
  performance.

**Input and layout**
- Stop held fire on release, focus loss, menus and disconnection; reconnection
  never restarts it. Keep explicit phone and keyboard alternatives.
- Keep the battlefield visible on phones; page scrolling must never be required.
- Middle-drag pans. Weapon readouts are passive and only highlight accepted shots.
- Typing fields and real pause/lifecycle gates own input; otherwise WASD keeps
  working through ordinary (non-modal) panels.
- Dock/airbase workshops and the deployment catalogue capture the mouse only
  within their panels. Exposed battlefield space still permits aiming and fire;
  entering a panel cancels held fire. Active placement retains map-click priority.
- Chat: Enter opens, then submits and closes even when empty (no blank broadcast).
  Escape preserves the unsent draft. IME composition must not send. Enter keeps
  placement-confirm precedence; Q holds the emote wheel and B remains Deploy.
  Chat/emote delivery is room-local and ephemeral; never replay old bubbles or
  log chat contents. Chat is one bar with a gold left edge: closed it reads
  "Press Enter to chat" ("Tap to chat" on touch) with the Enter mark; open it
  holds only the field and that mark, which sends. No heading, Send/Esc buttons
  or Esc hint (the author's chosen exception to the no-instruction rule); a click
  or tap outside closes it and keeps the draft (author, 9 November 2026). See
  `docs/CHAT_EMOTES_AND_SOUND_PLAN.md` and `docs/HUD_AND_POLISH_STAGE.md`.

**Presentation and assets**
- Entry art is browser-only. Keep its sky phase and camera continuous through
  Email/Demo mode changes and reloads; store cosmetic state only. Menu actions
  use centered luminous text, transparent information panels and unboxed arrow
  hover, while keyboard focus and input boundaries stay visible. Follow
  `docs/ENTRY_VISUAL_DESIGN.md` for the shared sun-light direction and layouts.
  On New Game and Continue the Cuculidae hovers over the destination globe
  (`public/entry-ship.js`). Planet arrows play its warp jump: globes hold, swap
  in one frame beneath the flash, and the world left stays behind the ship.
  Entering a campaign plays the drop-pod dive, then the game fades in from black.
  The pod releases only after the server admits the player, and a refusal pulls
  the camera back. Any input skips it; Return and refresh do not play it; a
  hidden tab or stopped animation never holds up entry. Pause/reduced motion
  settles directly. The dive shows daylit ground whatever the sun is doing. See
  `docs/ENTRY_VISUAL_DESIGN.md`. Join's admission reply names the host's planet: that
  world swings forward, the ship arrives as a line from beyond the frame that
  contracts into the hull, then the same drop runs. Colony joins enter directly. The
  pod is the design sheet's TOP view seen straight down, inside a gold ring within a
  red one. See `docs/JOIN_ARRIVAL_AND_RUNWAYS.md`.
  Keep entry movement display-paced; cache slow surface shading separately so
  resource savings do not impose a low frame rate on zooms and planet exchanges.
  A flight holds its first surface sample and never reshades a globe in the zoom.
  Destination globes, titles and selection controls share document coordinates;
  room/status notices and scrolling must move them together, including on phones
  and while animation is paused. The distant sky remains independent.
  Signed-in current-room Return / Save and leave controls belong on Continue;
  New Game only explains an active-room creation block inside its creation form.
  Guests retain room controls on Join because they have no Continue page.
  Lobby status feedback floats without a box or layout space. Routine success
  notices expire; errors remain readable. Save deletion uses an explicit named
  confirmation with Cancel/Escape before the server request.
- Opening loop (author, 8 November 2026): the scene-04 idle loop is a title screen
  in front of `/`, `/campaigns/` and `/login/`, once per tab session. It waits for
  any key, click or tap (not lone modifiers or browser shortcuts), with a shining
  gold "Press any key to skip" line ("Tap to skip" on touch). It then blacks out:
  a redirect waits for and keeps the black, so the next page fades in from it.
  Reduced motion shows the still frame and keeps the gate. Automated browsers
  skip it. It is presentation only. See `docs/OPENING_LOOP.md`.
- In-game HUD: `docs/HUD_AND_POLISH_STAGE.md`. It must read in one second. One
  graphite and gold interface on every planet; blue stays for ORB and actual aim,
  and each planet's colour lives in its terrain. Information belongs on the unit
  and cursor: health ring and spine lights, reload arc, X projects the locator.
  The folded mission bar is optional guidance and never gates play. Panels are one
  row with no heading or instruction sentence; text appears for errors and live
  status. Players learn by playing, so full specs stay in the field guide. Danger
  warnings always stay visible, and phones tap where desktops hover.
- Weapon audio follows confirmed combat events, never input attempts. Baseline
  joins/reconnects silently, discard stale/muted history, and bound simultaneous
  browser voices. Music/effects have independent saved controls; hidden tabs stop
  effects. A note and a bars switch beside the HUD menu (under the minimap on
  phones) turn them on and off; volumes stay in the field guide. Both start on,
  music at 5% and effects at 25%, until a player saves a level (author, 9 November 2026). The author's generated audio uses `public/sound-catalog.js`; treat
  supplied shot clips as one-shot even when their filename says loop/burst.
  Flame/beam playback needs continuing confirmed firing, and projectile traces
  must never retrigger a discharge. Audio checks must measure nonzero samples in
  the final speaker-output path; decoding and starting a source alone do not
  prove audible output. See `docs/WAR_ZONE_GENERATED_AUDIO.md` and
  the earlier `docs/SOUND_EFFECTS.md`.
- Deployment and vehicle audio follows accepted world snapshots. Pod impacts
  and individual panel contacts are one-shots; only explicitly designated engine,
  movement and servo beds loop. Keep at most six continuous layers within the
  shared sixteen-source budget. Engine gain/pan follows actual operation and
  motion; parked/destroyed machinery stops, stale snapshots expire, and mute,
  pause, hidden tabs and disconnects clean up every source. Preserve supplied
  prompts and source WAVs, including documented filename/content mismatches.
- Colony activity audio uses its own catalogue and runtime exports; preserve
  supplied prompts and WAVs. Alternate the two spider footsteps on audible
  strides, randomly choose among supplied one-shot takes without immediate
  repeats, and loop only designated continuous beds. Follow accepted activity
  state, actual useful work and loaded cargo transfers; do not replay history
  on reconnect or region changes. Keep four continuous layers within sixteen
  sources, stop on pause/hide/disconnect, and share saved effects controls across
  modes independently of music. See `docs/COLONY_SOUND_EFFECTS.md`.
- Sound-effect calibration uses measured per-codec loudness gains, not peak
  normalization. Preserve audio bytes and authored prompts; keep variant-family
  targets together, existing role volumes and the decoded-peak guard. Recalibrate
  after replacing recordings or changing catalogue gains, and run
  `node scripts/measure-sound-effects.mjs --check`. The peak policy bounds a
  single voice after role gain, before panning/mixing; final output still needs
  native browser checks. See `docs/SOUND_LOUDNESS.md`.
- Background music follows the saved planet and mode through one browser
  player: Caldera / Apex of Conquest, Sirocco / Crimson Vanguard, Vesper / Steel
  Wrought Ascent; Morrow / Twilight Over the Still Lake, Nacre / Harvest at Low
  Tide, Aurelia / Sun Drenched Sanctuary (author request, 9 November 2026;
  colony pairings chosen by Codex). Keep one saved music preference across modes,
  independent of weapon effects and cinema audio. Start after a gesture, pause
  hidden tabs, and retain the track position through snapshots and Morrow region
  changes. Colony controls belong in Crew. See `docs/AUDIO_PLAN.md`.
- Pure overhead 2D with square tiles; no isometric battlefield assets. Biological
  art is mildly unpleasant, overhead and readable; final textures remain open.
- Enemy art (`public/enemy-art.js`) simplifies the author's concepts into flat
  overhead creatures. Poses follow saved state (attack windup and strike, laser
  phase and cooldown, blocked hits) and rendered travel, never animation time;
  kinds, hit circles and labels are unchanged. The armored enemy keeps the name
  Bulwark (wearing the Berserker concept art) and Heavy laser art stays near its
  hit footprint, not 2.5x (author, 9 November 2026). Hostile facilities share
  that language (`public/facility-art.js`) and follow saved site state the same
  way; their warnings, labels, footprints and collision are unchanged, and the
  visible lance beam starts at the drawn tip. See `docs/ENEMY_ART_STAGE.md`.
- Re-entry (`public/reentry-art.js`; author request, 9 November 2026; awaiting
  playtest): every orbital arrival and strike shell comes down one orbital track
  per planet, posed from its saved countdown and exactly on its saved point at
  its saved impact. Capsules (pods, crates, capsules, the robot pod) brake: their
  plasma dies, retro rockets light the ground and blow dust before contact.
  Shells stay hypersonic to impact. Smoke is browser-only, keyed by id on the
  server clock (frozen in pause), lingers 14 s (heavy 20 s) drifting in the
  shared wind under facilities and units, and is capped at 48 trails. Reduced
  effects drop plasma and smoke. The menu dive is separate. See
  `docs/ORBITAL_REENTRY_STAGE.md`.
- Source `assets/` tracks only the selected evidence in `assets/used-assets.json`;
  all other local library files stay ignored. Keep original source licenses and
  distinguish active use, preparation dependencies and historical media. Track
  runtime copies under `public/` so Docker builds need none of the source library.
- The Dockerfile copies root-level server modules by name: add every new
  root `.js` imported by `server.js` to its `COPY` line, or the deployed
  container fails to start.

## 4. Identity, accounts and campaigns

Details: `docs/ACCOUNT_DESIGN.md`, `docs/ENTRY_AND_CAMPAIGNS.md`,
`docs/CAMPAIGN_STAGE.md`, ADR-001/002 in `docs/decisions/`.

- Unlinked guest identity is browser-bound; an activated account links the same
  stable player ID, preserving ownership and saves. Never silently merge another
  guest at login; require explicit takeover before replacing another session.
- Rotate old guest credentials when attaching an account; on logout, reset or
  takeover expire sessions, stop held inputs and revoke live streams.
- Keep private account data out of game snapshots and logs. Never serialize
  account rows, request bodies, invitation codes or cookies. Keep SMTP secrets
  server-only (local `.env` is ignored); never copy credentials between repos.
- Real-email and Demo accounts: Demo activation never establishes email
  ownership; keep visible Demo labels and guest entry by invitation. SMTP
  configuration (and passing TLS/auth checks) is not proof of inbox delivery.
- Authentication changes need save-retention, token-replay, inbox-isolation and
  live-control checks.
- Email/Demo accounts may host; unregistered guests may only join. Owner exit
  saves, closes the room and returns members to the lobby with its reason shown in a
  dialog and kept in the lobby; leaving by choice shows nothing. Leaving passes
  through black, as in the colony: the view zooms out while the battlefield fades,
  and a closed room's battlefield fades behind its dialog (author's request, 9
  November 2026; see `docs/JOIN_ARRIVAL_AND_RUNWAYS.md`). The Esc room menu
  fades in and out; its Account settings fades the battlefield to black and the
  account page fades in, and Return to battlefield fades back out (author's
  request, 9 November 2026; `docs/HUD_AND_POLISH_STAGE.md`). Invited accounts keep
  membership. Departing guests' construction persists and the host may manage it.
  Guest visits survive refresh/disconnect for 30 s; owner loss freezes the room
  for 30 s. Solo pause resumes, with a warning, when a teammate joins.
- Preserve per-runtime authorization and recheck delayed commands against their
  original visit/runtime. Keep root and per-campaign maintenance locks and the
  shared account store. Retain server-side permission checks and the ADR-002
  exceptions.
- Entry: `/` and `/campaigns/` offer Caldera and Vesper selectors and explicit
  create/join/resume; the labelled legacy shared world stays at `/?legacy=1`.
  Accounts alone never create a campaign. A new planet needs a server generator
  and save compatibility, not just catalogue metadata. Vesper (`vesper-v1`) is
  generated only for a new campaign; never regenerate existing world rows.
  Its immutable mountain/water masks block ground and aircraft at high ridges and
  exclude player ships from rivers/lakes. Caldera keeps its existing rules.
- Vesper has one aquatic hive: HE damages it, hits interrupt healing, and
  destruction permanently stops healing/spawns. Bile spitters share swimmer and
  global enemy caps; poison warnings and puddles share field admission. Exclude
  airborne bodies, fully submerged boats and protected starting cores from poison;
  damage occupied hulls without also damaging their crew. Save accepted bile and
  warning timers in simulation time. See `docs/VEHICLE_POLISH_ROADMAP.md`.
- Accounts adapt Crit 7's real/Demo separation, not its ANU-only addresses or
  academic schema.
- Guests without a core or occupied vehicle start in orbital core selection with
  no ground body; the server enforces that they cannot act or block placement.
  Returning players resume saved state.
- Deploy and Remote require an active robot (initial orbital landing excepted);
  enforce catalogue, strike and acquisition admission on the server.
- Reset tooling is local/operator-only: server stopped, SQLite backup first, the
  maintenance lock held. It clears the legacy test world only (keeping named
  campaigns, membership, accounts and linked IDs). Never expose a public reset
  endpoint or run it on Fly without an explicit request. Unknown future schemas
  need a deliberate reset-retention update.
- Observability (`docs/OBSERVABILITY.md`): structured logs with allowlisted
  fields and original actor/projectile attribution through combat saves; log
  committed named-world outcomes after checkpoint success.

## 5. Economy, construction and facilities

Details: `docs/CONSTRUCTION_LOGISTICS.md`, `docs/SUPPORT_NETWORK_STAGE.md`,
`docs/ECONOMY_DESIGN.md`, `docs/FACILITY_LIFECYCLE.md`,
`docs/STARTING_CORE_RECOVERY.md`, `docs/BRIDGE_BUILDER.md`,
`docs/ORBITAL_CARGO_PRESENTATION.md`, `docs/ORBITAL_PANEL_FOOTPRINTS.md`.

- Two campaign-wide budgets shared by every core and teammate: ORB (rocket
  delivery; orbital deployment) and GND (local processing; local construction and
  repair). The old supplies field is ORB; never duplicate money in migration.
- Provisional prices and timers live in `public/logistics.js`; document balance
  changes. Cost and object insertion are atomic; retries never double-charge.
  No per-shot charge, offline income, duplicate join credit or ORB→GND conversion.
  Salvage and launch credit are once-only; ground corpses have bounded saved salvage.
- ORB (orbital) delivery needs no construction support: clear terrain, full
  unfolding-wall clearance, supplies and facility limits still apply. GND local
  construction alone needs a completed friendly core, factory or outpost's
  full-footprint support; it takes 60 s at 25% cost. Existing unsupported
  equipment keeps working.
- Trade-ins credit 80% of the actual recorded payment in the same pool, rounded
  down and capped at the new price; record only the new net payment. Free, lost
  or receipt-less vehicles get no credit. Validate ownership, occupancy, cargo,
  readiness and capacity before an atomic debit and replacement; persist order
  IDs and vehicle revisions so stale or repeated requests cannot double-charge.
- Destruction is permanent: ruins remain, replacements are new builds, and ruins
  do not count toward facility caps. Surviving damaged vehicles can be repaired.
  A same-site dock may cover its owner's ruined deck and inherit the surviving
  assigned ship without moving, healing or charging for it.
- One core per campaign is the protected starting core: immune to damage and
  hostile targeting (`logistics.startingCoreId`). Other cores and outposts are
  vulnerable. If none survives, the emergency orbital core flow designates the
  next one. Preserve emergency core/HE-tank recovery and identities after core loss.
- Large-dock manual mooring accepts a 1.5-tile berth-centre offset; legacy docks
  keep 0.8. Require stopped, aligned, surfaced ships. Disembarkation chooses a
  clear dock tile when the usual exit is occupied; never remove wreck salvage
  or move the saved hull to make docking succeed.
- Dock or base destruction never silently deletes ships at sea or freezes
  airborne aircraft.
- Factory orders reserve space, cost less, take time and cannot be operated until
  ready; destroying a workshop cancels pending orders with a half refund.
- At a launch station, the E stripe and recycler station button send stored cargo
  directly, with amount/launch/return status. Keep the full logistics overview for
  management; launching locally must not open it or pan away from the rocket.
- Robots entering their own completed docks or airbases get a non-modal GND
  workshop (60 s drone assembly). Paid automatic dock hull repairs checkpoint with
  their supply charge; pause or offline time never advances them.
- Facility durability uses HP and numeric armor: penetration below armor deals no
  damage, equal or greater permits damage. Do not silently apply this threshold
  to existing robot/vehicle damage or change lethal alien hazards. Rails and
  terrain have no HP.
- Ground claws and acid damage facilities through armor; do not claim every enemy
  weapon was extended.
- Orbital cargo arrives in a metal crate, unfolds and deploys; new crates reserve
  their payload-sized four-wall cross (a double airbase opens its two long walls),
  then leave saved walkable flooring. Never
  draw construction drones for orbital cargo; local builds keep drone workers.
  No individual worker or electricity simulation.
- Keep the original core layout, each strip's 6 x 10 runway, air delivery aprons and the
  3×5 dock navigation footprint; tank pods are five tiles and roll out one east.
  Existing facilities are not retrofitted.
- Recyclers: one saved seat (E boards/exits, WASD drives, parking collects or
  unloads, L opens shipments). Remote commands need an empty seat. Loss disables
  the driver and drops only unshipped cargo. There is no panel while driving: the
  gold ring fills with the load and the unit's label reads it, then FULL. Beside a
  station L presses the send button instead, and repeating it never opens the
  overview. The bridge builder plans with G.
- Bridges: the existing builder offers Standard (3 wide, up to 24 interior rows)
  and Heavy (5 wide, up to 48). Both allow mixed land/water spans and require clear
  full-width anchors and approaches. Save profile, width, timing and paid cost;
  legacy bridges retain their original geometry and timing. The default
  planner is Find shore ahead with full preview and explicit confirmation; never
  silently replace an invalidated route or spend before confirmation. Admit and
  charge atomically; lock the builder and reserve the span until complete.
  Completed decks carry ground traffic while vessels and swimmers pass beneath;
  unfinished spans reserve both layers. Bridges are GND-funded only; show both
  balances, the shortfall and unloading advice. No terrain rewrite or diagonals.

## 6. Ground forces

Details: `docs/CORE_DEPLOYMENT.md`, `docs/ROBOT_COMBAT_DESIGN.md`,
`docs/SURVIVAL.md`, `docs/GROUND_WEAPONS.md`, `docs/TANK_GUARD.md`,
`docs/VEHICLE_COMBAT.md`, `docs/VEHICLE_HANDLING.md`.

- Cores keep the saved 57-cell cross, staggered unfolding and robot exit. Keep
  occupied footprints reserved until complete; flooring affects server collision.
  Limit: one core per scout and eight per world.
- Robot: held LMB/Space fuel jet, held RMB/J laser, labelled touch buttons;
  the jet reaches 7.5 tiles and heavy fuel keeps 8 (author, 9 November 2026). The
  jet is drawn from the server's packets as burning liquid, slim to thick and bent
  like a hose by a swinging nozzle; its splash and smoke are browser-only and never
  read as a fire field (`docs/FUEL_STREAM_STAGE.md`). A fuel packet that ends on
  land without hitting an enemy leaves a burning pool for 4 s: one per tile (renewed,
  never stacked), 12 per shooter and 48 in the world, apart from the field caps,
  saved with combat. Hunters and Breakers touching one burn and flee as from the
  laser; Bulwarks slow; routing ignores pools. The robot has an
  aim-facing body turning at 540°/s with world-direction movement. Weapons stop
  at rocks and solid structures. Health persists; disabled bodies cannot move,
  fire or build. Recovery uses a selected friendly core's clear area with
  idempotent requests and landing revalidation; death never grants a new core.
  Robot art (`public/robot.js`) is an overhead humanoid. The right arm is the
  weapon, with no hand: a flamethrower over the laser emitter. The left hand grips
  the gun. Yellow armour (teammates keep their colour) and a red optic. The gun
  sits just right of centre so existing flame and laser effects leave its muzzle.
- While its player operates a facility the robot holds position and guards with
  its own weapons; stop automatic fire on handoff, death, recovery, disconnection
  or lease loss.
- Turrets: shared configurable turn function. Player turret 180°/s in world space;
  APCR sentries 270°/s, keep valid targets, fire within 2° of aim. The server owns
  actual firing bearings. Gold crosshair = desired target; pale-blue diamond =
  actual aim point.
- Tanks: unlimited count (supply-funded; no per-player or world cap). Primary
  HE/Magnetic and secondary APCR/Heavy fuel are separate saved selections.
  Saved seat transitions before acknowledgement; movement checkpoints with the
  driver. Offline drivers keep their seat; empty tanks can be boarded by a
  teammate. Exit checks all adjacent cells without teleporting.
- Empty operational tanks guard in place with the selected main gun (prefer
  visible Bulwarks; respect range, occlusion, turret speed, charge and cooldown).
  No autonomous movement, secondary fire, facility targeting or takeover.
- Tank physics: gradual acceleration/braking and bounded turning within the
  server tick; momentum is transient. W/S drives along the saved hull heading
  (forward/reverse), A/D steers and can pivot at rest; release brakes. Recyclers
  and builders use the same controls. Remote paths retain world-direction routing.
  Keep slower reverse, independent tank aim and the existing footprint. Recoil is browser-only; reduced motion
  disables the hull kick.
- Magnetic charges reserve projectile capacity and cancel on focus loss,
  disconnect or control change; no blast or crater. Heavy fuel shares the lethal
  liquid packet logic (8 tiles) and packet caps. Robot loadouts are unchanged.

## 7. Rails, artillery, missiles and Remote

Details: `docs/RAIL_ARTILLERY_DESIGN.md`, `docs/CANNON_CONTROLS.md`,
`docs/COMPACT_RAILS.md`, `docs/RAIL_SWITCHES.md`, `docs/ARTILLERY_FIELDS.md`,
`docs/MISSILE_LAUNCHER_DESIGN.md`, `docs/GUARD_CURVES_EXPANSION.md`.

- Rails: compact one-tile corners and junctions for new construction; EW/NS
  overlays merge into J on owned clear track; WASD chooses connected exits. Never
  teleport through missing or nonreciprocal connections. Legacy broad curves and
  owner-installed switches remain valid in saves.
- Ground checks use `coreBlocks`: flooring and the pad are traversable; machinery,
  active reservations, uncovered rocks, water and sentries block. Turning cannons
  use the swept 3×3 body for unit collision (also in `canStand`), separate from
  the one-tile permanent rail reservation.
- Rail presentation/range: see `docs/RAIL_WEAPONS_POLISH.md`. New five-tile
  straight tracks unfold 1 -> 3 -> 5 over saved metal flooring; their animation
  does not delay rail usability. Tracks draw below remains and world objects.
  New rail corners and single straight tiles share one compact crate animation,
  leaving one permanent metal base tile without unfolding surrounding panels.
  Cannon shells reach 180 tiles, retaining the six-tile minimum.
- Rail MAC: separate R-03 weapon, one kinetic type, 2.5 s committed charge then
  10 s cooldown, 180-tile range, 900 damage and at most three distinct enemies.
  Charge locks carriage and direction; cover stops the shot, friendlies stay
  immune, and kills retain salvage. Persist accepted charge/trajectory/hit IDs
  in named campaigns; releasing control must not cancel or duplicate discharge.
  See `docs/RAIL_WEAPONS_POLISH.md` for provisional balance and controls. MAC art
  is electromagnetic: radiator, a ring whose segments sweep across the bore,
  a coil-wound barrel fed by power cables, and cable rings square across the
  muzzle (presentation only).
- Rail cannon: single shared operator, released on death/disconnect; manual only.
  Bearing and elevation converge server-side on the higher arc and never snap to
  the cursor. Robot and vehicle wheel zoom share the full survey-scale range.
  Commands expire after 350 ms; a started segment completes but no new
  one begins without fresh input. Reject off-map impacts. Rail HE has a 6 t
  damage radius, 2.2 t full-damage core, 420 centre / 60 edge damage; its profile is
  separate from naval HE. Accepted shells retain their launch profile. Blast size is
  independent of the cosmetic 8 t crater; heavy HE is never a personal weapon.
- Missile battery: fixed 4×4 site, 12×18 area, 12 staggered missiles, 15–200 t
  range, 15 s reload after the last launch, two committed volleys max, immutable
  impacts. Its launcher deploys for 2.5 s while operated, turns at 60°/s and
  elevates at 15°/s (20–65° by range). Volleys strike the actual pose, never the
  cursor: gold is desired, pale blue is actual. It stows 6 s after release unless
  its own volley flies. Save pose, not aim; old saves load stowed and never take
  the rail cannon's default elevation.
- Fields: lethal contact (Hunters; Breakers in fire), exact gas capacity,
  fire-first priority, friendly immunity, simulation-time expiry; gas has no timer.
  Active plus incoming fields share count caps and the area budget (216 tiles per
  barrage; 512 total / 256 per type). Selection shares reload and cannot alter
  in-flight ammunition. Test field accounting and routing before changing sizes,
  caps or monster numbers.
- Fire, gas and smoke drift with one cosmetic wind per world (`public/wind.js`),
  derived from the world id and the server clock so every client sees the same; it
  moves nothing in the game. Flames sway and burn down over a field's time; gas
  spreads to its full bound within 1.5 s while its dashed boundary shows the full
  area from the first frame (author, 9 November 2026).
- Distant battery/submarine aim clamps the whole rectangle along its bearing, and
  tank distant aim clamps travel to weapon range while keeping the actual turret
  bearing; preview and server agree and keep minimum-range and other fire gates.
- Facility control opens near the gun, framed on its closest target in range; M
  flips to the planet overview and back, and T jumps to the next target. The wheel
  and pinch zoom at the pointer. The bottom facility manual replaces body controls
  until exit. Ships and aircraft keep the global Remote view.
- Remote panels are a command strip: one word, one key, in the dock's language.
  LMB attacks and RMB moves; RMB on a free friendly dock moors a ship there without
  changing its home. R returns a ship or helicopter home; on aircraft it
  turns the approach, because attack runs relocate by themselves. G deploys a
  ship's ramp at the nearest shore or lands a helicopter, V lifts or drops a
  slung vehicle, T turns a submarine's strike area, L launches from a carrier.
  WASD still walks the robot, so never bind them here. Panels stay open for the
  next order; Esc, F or Remote leaves. Touch has no right button, so it keeps
  mode buttons. There is no Stop: a new order replaces the old one.
- R-02 cannon belongs in Rail; S-01 battery stays in Ground. Remote (F) opens map
  selection of friendly facilities; keep server control locks, Escape release,
  robot guarding, rail movement and shell behaviour.

## 8. Navy

Details: `docs/NAVY.md`, `docs/SHIP_ARMAMENT.md`, `docs/SHORE_RAMP.md`,
`docs/SUBMARINE.md`, `docs/ARMORED_TRANSPORT.md`,
`docs/CONSTRUCTION_AND_SHIPYARDS.md`, `docs/AIRCRAFT_CARRIER.md`,
`docs/REMOTE_NAVAL_ORDERS.md`, `docs/HELICOPTER_AND_SUBMARINE_REFINEMENT.md`.

- Docks first: N-05 places an empty dock; ship cards choose an existing empty
  dock. One assigned vessel per dock, four active ships per campaign; same-type
  ships may use different docks. New docks reserve the 3×1 shore, 3×5 water deck
  and adjacent berth; completed decks are walkable. Never relocate old docks.
- Exclusive saved seats; restart at sea restores the robot inside. Board and exit
  through an aligned berth or a validated shore ramp (G; two-tile reach, full
  clearance, server-chosen endpoints, movement lock). Ramps never floor water.
- Gunship: two twin main turrets (world-stabilised), one-click turret volleys,
  double-click full salvos, independent 6 s reloads, hull-relative side arcs.
  Cursor input never overrides actual mount angles. Main-gun range for gunships
  and transports follows `docs/REMOTE_NAVAL_ORDERS.md`.
- Gunship art is an Iowa silhouette drawn at 80% of the saved beam, with Iowa
  main turrets and 5"/38-style twin secondaries whose muzzles stay on the shared
  firing geometry; collision, docks and berths keep the saved rectangle. The six
  secondaries sit inboard on the superstructure via shared `BATTERY_MOUNTS`
  (`docs/SHIP_VISUAL_SCALE.md`).
- Submarine: four independent six-silo groups (24 tubes), each launching a 6 x 8
  strike and reloading for 18 seconds after its last missile. Groups cycle through
  ready banks; ammo changes never reset timers. Matching lids and launch origins
  use the saved group/tube index. Save group timers, next group and accepted volleys
  atomically; old single-reload saves keep that cooldown on group one. The helm
  shows ready groups; aiming stays yellow until all groups reload, then red.
  Maximum 16 submarine volleys in flight; batteries/bombers keep their shared two.
  Moving and submerged launches are supported. Depth transitions remain vulnerable;
  only fully submerged hulls evade swimmers. Ramps and boarding require surfacing.
  Both large and compact hulls show 24 lids; art is separate from collision geometry.
- E on an owned dock opens the unified shipyard panel. Retiring with keepYard
  keeps occupied deck flooring; deleting a yard needs clear deck and berth access.
  Keep completed deck flooring through hull replacement and dock damage, and
  require a clear offshore deck before recall. The ramp sentry cannot regain HP or
  reload by folding; repairs are a paid dock service.
- Transport: one unoccupied ground vehicle in a saved cargo slot, moved atomically,
  keeping ownership, health, loadout and salvage. Loading needs management
  permission; cargo sinks with its ship. K drives cargo off. LCU layout: large
  transports load over a bow ramp on beaches and through a pier side gate at docks;
  one stern triple turret (three shells, saved id `fore`) and two open side guns
  aft. Never change gunship mount counts. See `docs/ARMORED_TRANSPORT.md`.
- Carrier: two deck spots (one heavy: bomber or aerial gunship; one attack jet)
  and two fleet slots. Deck A uses the axial runway over the bow and deck B the
  angled runway (heading turned to port); each launches and recovers independently.
  Spot A keeps the carrier id, spot B's holder is `ship.wing`. Stationary
  operations, parked aircraft move with it, recovery locks the helm, side guns
  only. Its onboard GND store pays stationary repairs; rebuilding never restores
  free supplies. Carrier-to-carrier workshop exchange preserves both parked,
  unoccupied aircraft and their save identities; active flights block exchange.
  Exchanging to another ship type automatically recycles the owner's assigned
  parked aircraft, without confirmation, for 50% of actual payment in the original
  GND/ORB pool. Aircraft removal, refund and ship purchase are one transaction.
- Enemy-only hull damage; vehicle and pilot loss are atomic. Naval contacts share
  a 30 s timer and six-swimmer cap and pause with no viewers.

## 9. Air

Details: `docs/AIR_FORCE.md`, `docs/AIR_TRAFFIC.md`, `docs/AUTOMATIC_BOMBER.md`,
`docs/ANTI_AIR.md`, `docs/ORBITAL_FORCE_DEPLOYMENT.md`, `docs/HELICOPTER.md`,
`docs/AIR_POWER_REFINEMENT.md`, `docs/AC130_GUNSHIP.md`.

- Fixed-wing weapons, HUD and silhouettes follow `docs/AIR_POWER_REFINEMENT.md`
  (it replaces finite fixed-wing ammunition, refill waits and the old bomb
  pattern; helicopter ammunition is unchanged).
- Aircraft keep stable saved identities across bases and carriers. Cruise is an
  explicit persisted unmanned order; aircraft may land at any free friendly base
  with exclusive runway reservations. Fleet counts include aircraft in flight and
  delivery; empty airbases are allowed within the four-base campaign cap. A free
  runway is not permission to manufacture another aircraft.
- New airbases are 6 x 20 (R turns them): two strips, one health pool, one aircraft.
  The second strip is a visitors' landing field, never a production or fleet slot.
  Older bases keep one strip. See `docs/JOIN_ARRIVAL_AND_RUNWAYS.md`.
- Airbase placement is empty; separate jet and bomber cards choose an existing
  empty owned runway with server new-only admission. Keep the first free orbital
  bomber distinct from local production.
- Airborne pilots have no ground body or ground weapons. Viewer-based pause,
  offline cruise and saved flight state apply; departed pilots release their seat
  and unattended aircraft are recovered.
- Automatic bomber missions: one shared mission per aircraft, fixed accepted target
  and payload, no duplicate release across restart, abort and return on home-base
  loss. Cruising aircraft are Remote strike markers with bounded flak detours.
- Anti-air: airborne-only predicted flak with fixed warned points; aircraft damage,
  consumed impacts and pilot loss checkpoint atomically.
- Helicopters: separate helipads (max eight active or incoming) and fleet
  capacity; hover controller, LMB cannon, RMB rocket window; pads never unlock
  fixed-wing capacity.
- Aerial gunship (A-06): manual stage only; automatic orbit awaits author review.

## 10. Enemies, encounters and detection

Details: `docs/CONQUEST_STAGE.md`, `docs/MORTAR_OUTPOST.md`,
`docs/ENVIRONMENT_MODIFIER.md`, `docs/ALIEN_SETTLEMENT.md`,
`docs/AIR_CONTAMINATOR.md`, `docs/LASER_TOWER.md`, `docs/DEFENSIVE_SECTORS.md`,
`docs/DETECTION_AND_ALARMS.md`, `docs/LAND_AI_AND_SEEDED_FRONTS.md`,
`docs/MOBILE_LASER_ENEMIES.md`, `docs/NATURAL_ENCOUNTERS.md`,
`docs/ENEMY_DESIGN_DISCUSSION.md`.

- Named campaigns use the natural encounter director: compound replenishment and
  seeded raids with saved active-play deadlines. No offline catch-up and no
  invisible deletion or healing to free slots. Legacy drills stay separate.
- Sleeping survivors stay damageable. An event with no eligible ground combatants
  or recovery structures resolves with a recovery grace; never declare permanent
  campaign loss.
- Pursuit: ordinary acquisition/retention ranges, remembered positions and bounded
  enemy-only routing budgets. Enemies give up distant pursuit; disengagement,
  sleeping and despawning are separate. Never silently heal enemies or reset sites.
- Seeded compounds: generated once per save from a versioned manifest; unsafe
  slots are skipped permanently; never reroll or refill. Finite initial guards with
  saved roles under the shared 24 cap; only crowns call Hunter reinforcements.
- Roles (author, 9 November 2026; `docs/FUEL_STREAM_STAGE.md`): fire, fuel and
  gas kill Hunters on contact, and a gas kill spends one of the cloud's count.
  Breakers still die to fire and fuel, but gas wears them down at 20 hp/s and
  confuses them (target dropped, slow wandering) while inside and 3 s after.
  Bulwarks take HE/explosives, Magnetic, the MAC and now gas at 20 hp/s. They are
  never lured, never turned aside by fire and never panic, but fire fields, their
  heat band and fuel pools halve their speed. A cloud spends a kill on a Breaker or
  Bulwark only when it dies of the gas inside it. Status shows on the unit (gas
  bubbles, confusion stars, slowed chevrons). Bulwarks obey terrain and windups.
  The centipede and skimmers stay hazard-immune. Mobile lenses are aircraft specialists with normal ground
  vulnerability; their elevated beams never hit parked aircraft or ground units.
- Automatic bullet/fuel guards prefer damageable targets; keep truthful
  blocked-hit feedback.
- Only intact alert stations call warned, capped reinforcements. Never classify
  new non-alert site kinds as scanners or callers by default. Red shading is
  overview territory, not detection or weapon range.
- Detection is separate from reaching or attacking a contact. Focused tracking
  stops circular search, marks fade after lost lock, solid obstacles block beams;
  submerged escape is preserved. Noise/neighbour reports carry last-known
  positions only.
- Contaminator fog is fixed and opaque: reduced effects never bypass concealment;
  ground aim and attack warnings stay below it.
- Lance tower: full 40-tile beam clipped by hits and cover; charge holds bearing,
  firing tracks the angle at 4°/s; lethality is cumulative exposure.
- Do not silently resolve the armor-model conflict or remove fire avoidance and
  burning panic.
- Local Test frenzy is owner-triggered and disabled on Fly/production. Its button
  stays hidden in campaigns unless the URL carries `testTools=1`.

## 11. World, map and interface

- Sirocco: `docs/SIROCCO_PLANET.md`. Only new `sirocco-v1` campaigns use the
  desert generator. Distinguish firm ground from naval-class loose sand; oasis
  lakes remain inland water excluding ships. Keep existing hull, placement,
  pressure, bridge, weapon and conquest rules. Sand skimming/burrowing, palms
  and dunes are biome presentation; never allow ships across all land or
  regenerate an existing planet. Preview masks must match the saved generator.

Details: `docs/PLANET_EXPANSION.md`, `docs/GUARD_CURVES_EXPANSION.md`,
`docs/UI_REFINEMENT.md`, `docs/ORBITAL_STRIKES.md`.

- The planet is 512×384 saved terrain, preserving every older coordinate and the
  pre-expansion JSON. The globe (N) moves only the camera; M is the flat tactical
  overview. No spherical travel or extra caps from the larger map.
- The map edge is weather (`public/map-horizon.js`). Every rim is open sea or loose
  sand, so each planet's own surface continues past it and fades out. Picture only:
  the map stays closed and the same size. The fog sits under units and warnings,
  stays off land, and is skipped inland. A new planet must keep an open rim.
- Orbital strikes (V): one shared order slot and single payment; fixed previewed
  points, monotonic request sequences and saved landed flags. Orbital hazard
  fields have one canonical copy in logistics.
- Choosing an orbital strike closes Deploy for direct map targeting. B reopens
  the catalogue for reselection without spending; R rotates directional strikes
  and Esc exits targeting. Keep touch alternatives compact and the map visible.
  The cutting beam has no R: its two clicks already set any direction. A committed
  strike closes targeting and hands the robot back (Combat, camera and zoom on the
  robot). When the caller's own strike has landed, Deploy reopens on the strike
  tab, unless they are firing, driving, operating or in another panel (author,
  9 November 2026; `docs/ORBITAL_EXPANSION_AND_POLISH.md`).
- Orbital expansion: heavy bomb, seeded 15-second barrage and three spaced
  cluster shells with saved smaller impacts. New cutting beams allow 72 tiles
  over 18 seconds; accepted orders retain their saved profiles and timing.
  See `docs/ORBITAL_EXPANSION_AND_POLISH.md` for provisional values.
- Fire and gas footprints are land-only; the cutting beam damages along its
  moving ground contact and can conquer facilities, while its sky ray is cosmetic.
  The first strike's reference stays stable; planning uses a regional camera.
- Keep terrain rendering cached and overview rendering cheap. After the first paint
  redraw only changed tiles (`public/terrain-repaint.js`): repainting the whole map
  for one finished core or tank froze every client. A GPU reset wipes cached
  canvases, so the battlefield reloads on `contextrestored`. Caldera is painted
  blue grass, silver shores and blue trees from fixed tile positions
  (`public/caldera-art.js`); colours only, and its trees stay cosmetic.
- War-zone ground, water and ridges are painted by `public/ground-art.js` from
  the saved terrain, mountain and water masks only, in code (no texture images).
  Coasts and ridge outlines are smoothed but held within 0.35 tiles of the saved
  edge, and every tile centre shows its saved surface; never let art hide a
  one-tile island, river or rock. Chunks snap to device pixels (no seams) and
  build within a frame budget behind the overview image. No per-pixel grain: it
  made full-screen PNG screenshots take half a second to encode, pausing the page
  past the 700 ms input lease, and a lapsed lease stops a ship and clears its
  throttle. Rocks must stay easy to see, because they block movement and weapons.
  See `docs/TERRAIN_TEXTURE_STAGE.md`.
- UI is presentation and input only: never alter server rules, prices or save
  formats from the UI. Add keys to `public/keymap.js` BINDINGS (precedence,
  labels, F1) and assets to `public/catalogue.js`; never reuse asset codes;
  numeric shortcuts follow category order. A key that works in only one state
  takes that state's scope, never `global`: F1 lists global keys everywhere.
- Deploy is a shelf with one tile per item. With a mouse the ghost follows the
  cursor: LMB places with ORB, RMB builds with GND inside support, Shift keeps
  placing. Touch and the coordinate form keep an explicit confirm and both prices.
  Do not reintroduce hidden Deploy restrictions or implicit aircraft exchange.
  Every tab fits one row on a desktop, tiles read 1, 2, 3 from the left, and the
  wheel scrolls the row wherever it still overflows.
- E selects the nearest enabled interaction.
- `/readme/` renders `README.md` through `public/readme-markdown.js`, sending
  repository paths to GitHub. Keep the README within what that renderer covers.

## 12. Verification

- Tests use isolated saves (`tests/browser/rover-helper.js`, temporary
  `DATA_DIR`s); never touch the author's saved worlds.
- Run relevant domain/HTTP tests, then browser checks at 1920×1080 and 390×844,
  including keyboard use and resize. Inspect screenshots, not only results.
- In live-tick tests, wait for observable simulation state, not fixed sleeps,
  while keeping explicit time bounds.
- Browser specs read a whole world as text and parse it in Node. Returning it as
  an object through `page.evaluate` makes Playwright walk every tile: 390 ms a
  read, and it crashes the test worker.
- `close()` forces remaining connections after one second: a browser's spare
  socket has sent no request, so Node never counts it as idle and `server.close()`
  would wait on it forever.
- A campaign timer that stops in a test usually means a frozen room, not a slow
  server: a dead owner tab freezes it. Read `room.state` and the trace's page
  frames before changing the test.
- Report a test that needed a retry as flaky, with its cause, never as a pass.
- On the author's i9-14900K, Chrome tab and Node worker crashes followed the
  P-cores (`docs/HUD_AND_POLISH_STAGE.md`). Run full browser suites on the E-cores
  (`start /affinity FFFF0000`), and judge an unexplained crash from a Chrome dump
  rather than from a retry.
- Hazard visual checks include aged fields, not only impacts or labels.
- Treat memory/CPU feasibility as unproven until measured under representative
  sustained load; a preview or idle probe is not a combat benchmark.
- Before pushing a new root server module, check the Dockerfile `COPY` line
  (CI starts the production image).

## 13. Superseded behaviour (older docs may still describe these)

- Free deployment and free aircraft or vehicle replacement (replaced by the
  12 October economy and permanent loss).
- One tank per player or eight per world (tanks are now unlimited).
- Repairing destroyed docks or runways in place (destruction is now permanent).
- Per-type naval caps and combined ship-plus-dock placement (now dock first).
- Fixed home-airbase parking and combined airbase+aircraft cards.
- Ships blocked by bridges (completed decks now have underpasses).
- Broad radius-three rail curves for new construction (now compact rails).
- Finite fixed-wing ammunition, refill waits and the old bomb pattern.
- The rover starting body (guests now start in orbit).
- `1` returning to Combat mode (now Esc).
- The Operations panel and full-width top bar (now a folded mission bar and one menu).
- Facility control opening on the planet overview (guns now open near themselves).
- Separate ORB and GND catalogue cards (one tile; the method is chosen at placement).

Large naval scale is authorized and implemented locally: new docks save
`dockScale:2` (7 shore tiles, 7 x 12 pier); new hulls there save `navalScale:2`.
Use `naval-scale.js` for hull, berth and mount dimensions. Preserve legacy sizes
and saved coordinates; do not enlarge old berths in place. See
`docs/SHIP_VISUAL_SCALE.md` for artwork, stern loading and ocean validation.
New empty-dock placement snaps shore/nearby-ocean clicks to a validated coastal
site. The seven-tile shore platform may bridge uneven water edges but must touch
clear land; the full pier, berth and departure water must remain clear ocean.
Preview and server use the same search; keep the accepted click for retry safety.

## 14. Not authorized yet

Proposals only until the author approves a stage: orbital cleanup
(`docs/ORBITAL_CLEANUP.md`), elevation mechanics (`docs/ELEVATION_DESIGN.md`),
the general movement-noise network, Spitters, carrier helicopter parking,
a longer/slimmer saved transport hull (`docs/ARMORED_TRANSPORT.md`),
audio (`docs/AUDIO_PLAN.md`),
later vehicle polish stages (`docs/VEHICLE_POLISH_ROADMAP.md`), aerial gunship
automatic orbit, and bridge HP/dismantling.

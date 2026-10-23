# Frontier working agreement

This file holds the rules in force now, grouped by topic. It is not a history:
dated decisions, evidence and stage narratives live in `PROCESS.md`, `docs/` and
git. When a rule here and an older stage doc disagree, this file and the newest
stage doc win; see "Superseded behaviour" at the end.

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
- Never remap, move or regenerate existing records or player construction.
  Migrations back up populated saves first, then apply additive changes
  atomically. Never reset a campaign or the user's world for testing.
- Never retroactively charge for owned equipment or silently erase legacy guests.

**Server authority**
- The server enforces placement, ownership, costs and outcomes; browser drawings
  never decide shared results. Previews and server admission must agree.
- Keep terrain, territory, objects and rendering separate. Collision comes from
  world data, not sprite size or what is on camera.
- Particles, drones, wrecks' animation and cosmetic craters are browser-only.
  Never infer readiness from animation time; use saved countdowns.
- HTML and snapshots share a build fingerprint computed at server start. Reload
  an outdated client before it consumes a new state format.

**Combat safety**
- Friendly entities never receive weapon damage.
- Conquest is permanent: no site-regeneration timers, recapture or refill of
  conquered sites. Facility loss never reverses conquest. Completion requires all
  saved member IDs; missing records never count as wins.
- Accepted attacks (shells, strikes, warnings) are never dropped, duplicated or
  rolled back across restart, pause or closure.

**Runtime budget and capacity**
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

**Presentation and assets**
- Pure overhead 2D with square tiles; no isometric battlefield assets. Biological
  art is mildly unpleasant, overhead and readable; final textures remain open.
- Source `assets/` stays local and ignored. Track selected runtime assets with
  licences and provenance so Docker builds need none of the source library.
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
  saves, closes the room and returns members to the lobby; invited accounts keep
  membership. Departing guests' construction persists and the host may manage it.
  Guest visits survive refresh/disconnect for 30 s; owner loss freezes the room
  for 30 s. Solo pause resumes, with a warning, when a teammate joins.
- Preserve per-runtime authorization and recheck delayed commands against their
  original visit/runtime. Keep root and per-campaign maintenance locks and the
  shared account store. Retain server-side permission checks and the ADR-002
  exceptions.
- Entry: `/` and `/campaigns/` offer the Caldera selector and explicit
  create/join/resume; the labelled legacy shared world stays at `/?legacy=1`.
  Accounts alone never create a campaign. A new planet needs a server generator
  and migration, not just catalogue metadata.
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
- Dock or base destruction never silently deletes ships at sea or freezes
  airborne aircraft.
- Factory orders reserve space, cost less, take time and cannot be operated until
  ready; destroying a workshop cancels pending orders with a half refund.
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
  their payload-sized four-wall cross, then leave saved walkable flooring. Never
  draw construction drones for orbital cargo; local builds keep drone workers.
  No individual worker or electricity simulation.
- Keep the original core layout, runway dimensions, air delivery aprons and the
  3×5 dock navigation footprint; tank pods are five tiles and roll out one east.
  Existing facilities are not retrofitted.
- Recyclers: one saved seat (E boards/exits, WASD drives, parking collects or
  unloads, L opens shipments). Remote commands need an empty seat. Loss disables
  the driver and drops only unshipped cargo.
- Bridges: three-wide straight crossings with mixed land/water spans and clear
  full-width anchors (≤24 interior rows, counted in price and timer). Default
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
  aim-facing body turning at 540°/s with world-direction movement. Weapons stop
  at rocks and solid structures. Health persists; disabled bodies cannot move,
  fire or build. Recovery uses a selected friendly core's clear area with
  idempotent requests and landing revalidation; death never grants a new core.
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
  server tick; momentum is transient. Keep world-direction WASD, slower automatic
  reverse and the existing footprint. Recoil is browser-only; reduced motion
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
- Rail cannon: single shared operator, released on death/disconnect; manual only.
  Bearing and elevation converge server-side on the higher arc and never snap to
  the cursor. Commands expire after 350 ms; a started segment completes but no new
  one begins without fresh input. Reject off-map impacts. Damage radius (3 t) is
  independent of the cosmetic 8 t crater; heavy HE is never a personal weapon.
- Missile battery: fixed 4×4, 12×18 area, 12 staggered missiles, 15–100 t range,
  15 s reload after the last launch, two committed volleys max, immutable impacts.
- Fields: lethal contact, exact gas capacity, fire-first priority, friendly
  immunity, simulation-time expiry; gas has no timer. Active plus incoming fields
  share count caps and the area budget (216 tiles per barrage; 512 total / 256 per
  type). Selection shares reload and cannot alter in-flight ammunition. Test field
  accounting and routing before changing sizes, caps or monster numbers.
- Distant battery/submarine aim clamps the whole rectangle along its bearing, and
  tank distant aim clamps travel to weapon range while keeping the actual turret
  bearing; preview and server agree and keep minimum-range and other fire gates.
- Facility control opens the orbital overview by default; the bottom facility
  manual replaces body controls until exit.
- R-02 cannon and S-01 battery are Ground catalogue cards. Remote (F) opens map
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
- Submarine: shares hull/seat/ramp/damage rules; six-missile 6×8 strikes, full-
  area range checks, server-owned vulnerable dive transitions, limited battery and
  forced surfacing. Only fully submerged hulls lose swimmer targeting; missiles,
  ramps and boarding need the surface.
- E on an owned dock opens the unified shipyard panel. Retiring with keepYard
  keeps occupied deck flooring; deleting a yard needs clear deck and berth access.
  Keep completed deck flooring through hull replacement and dock damage, and
  require a clear offshore deck before recall. The ramp sentry cannot regain HP or
  reload by folding; repairs are a paid dock service.
- Transport: one unoccupied ground vehicle in a saved cargo slot, moved atomically,
  keeping ownership, health, loadout and salvage. Loading needs management
  permission; cargo sinks with its ship. K drives cargo off. One bow turret;
  never change gunship mount counts.
- Carrier: one fleet slot and one runway; stationary operations, parked aircraft
  move with it, recovery locks the helm, side guns only. Its onboard GND store
  pays stationary repairs; rebuilding never restores free supplies.
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
- Roles: Hunters and Breakers are vulnerable to fire and gas. Bulwarks are
  damaged only by HE/explosives and Magnetic, ignore heat and gas lures, and obey
  terrain and windups. Mobile lenses are aircraft specialists with normal ground
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
- Local Test frenzy is owner-triggered and disabled on Fly/production.

## 11. World, map and interface

Details: `docs/PLANET_EXPANSION.md`, `docs/GUARD_CURVES_EXPANSION.md`,
`docs/UI_REFINEMENT.md`, `docs/ORBITAL_STRIKES.md`.

- The planet is 512×384 saved terrain, preserving every older coordinate and the
  pre-expansion JSON. The globe (N) moves only the camera; M is the flat tactical
  overview. No spherical travel or extra caps from the larger map.
- Orbital strikes (V): one shared order slot and single payment; fixed previewed
  points, monotonic request sequences and saved landed flags. Orbital hazard
  fields have one canonical copy in logistics.
- Fire and gas footprints are land-only; the cutting beam damages along its
  moving ground contact and can conquer facilities, while its sky ray is cosmetic.
  The first strike's reference stays stable; planning uses a regional camera.
- Keep terrain rendering cached and overview rendering cheap.
- UI is presentation and input only: never alter server rules, prices or save
  formats from the UI. Add keys to `public/keymap.js` BINDINGS (precedence,
  labels, F1) and assets to `public/catalogue.js`; never reuse asset codes;
  numeric shortcuts follow category order.
- Inside supported footprints show ORB/GND as blue/gold halves; outside, ORB only.
  Do not reintroduce hidden Deploy restrictions or implicit aircraft exchange.
- E selects the nearest enabled interaction.

## 12. Verification

- Tests use isolated saves (`tests/browser/rover-helper.js`, temporary
  `DATA_DIR`s); never touch the author's saved worlds.
- Run relevant domain/HTTP tests, then browser checks at 1920×1080 and 390×844,
  including keyboard use and resize. Inspect screenshots, not only results.
- In live-tick tests, wait for observable simulation state, not fixed sleeps,
  while keeping explicit time bounds.
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

## 14. Not authorized yet

Proposals only until the author approves a stage: orbital cleanup
(`docs/ORBITAL_CLEANUP.md`), elevation mechanics (`docs/ELEVATION_DESIGN.md`),
the general movement-noise network, Spitters, carrier helicopter parking, ship
visual enlargement (`docs/SHIP_VISUAL_SCALE.md`), audio (`docs/AUDIO_PLAN.md`),
later vehicle polish stages (`docs/VEHICLE_POLISH_ROADMAP.md`), aerial gunship
automatic orbit, and bridge HP/dismantling.

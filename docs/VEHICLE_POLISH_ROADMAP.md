# Vehicle polish and world variety

## New planet: mountain watersheds and aquatic hives, 24 October 2026

Terrain foundation implemented locally as **Vesper** (`vesper-v1`), a separate
512 x 384 campaign template. Create a campaign from the Vesper card in the lobby;
existing campaigns retain their saved terrain, assets and water rules. Caldera
remains the default. The author is refining ship artwork separately; this stage
changes navigation checks, not ship drawings. Heavy bridges are now implemented
locally, followed by one playable aquatic hive encounter.

### Environment and navigation stage

Requested: more environmental variety, high mountain chains that robots, tanks
and jets cannot cross, rivers and lakes that ships cannot enter. Treat this as a
bounded impassable-ridge model first, not a full 3D elevation simulation. This
new-planet rule supersedes the old elevation proposal's unchanged-navigation
assumption only for Vesper.

Implemented: four landmasses, broken slate mountain chains and passes, four lakes
with rivers to the sea, green lowlands, pale peaks, scrub, reeds, fallen timber,
gravel and shale. Cosmetic vegetation does not create invisible collision. Saved
mountain and water masks are immutable; cached tile art adds no simulation
entities. River/lake water is visibly lighter than the ocean. The starting plain
reserves core and runway space; a straight western coast fits a 7 x 12 dock.

High ridges reject ground movement and pod placement, turn fixed-wing aircraft
away and brake helicopters. Swept collision prevents crossing between ticks.
Remote routes and unattended return use bounded mountain detours. All four player
ship types reject inland water; swimmers retain access. Existing rock-cover rules
apply to mountains, while artillery keeps its current arc model. This is not a
height-aware ballistic simulation.

Proposed visual set: moss/grass patches, scrub, reeds, fallen timber, gravel,
layered shale, basalt outcrops, mineral seams and scree. Keep cosmetic ground
patterns separate from clearly outlined solid obstacles. Use coherent seeded
patches, cached terrain drawing, strong ridge shadows and contour highlights;
retain enough quiet ground to read units, weapon previews and salvage.

Mountain chains need connected valleys, visible passes and broad construction
plains. Manual aircraft movement, remote strike routing, cruise, takeoff and
return-to-base must share mountain exclusion. Proposed behavior is warning and
turn-away rather than an unexplained invisible stop or automatic instant death.
Apply the same exclusion to helicopters and aerial gunships for consistency.
Validate swept movement at maximum speed; never let a jet cross a ridge between
ticks. Show an explicit unavailable-route reason when no safe flight path exists.
Direct-fire cover and high-arc artillery interaction need a deliberate shared
rule before release; this brief does not claim full terrain-height ballistics.

Water needs saved ocean/river/lake classification separate from walkable bridge
flooring. All player vessels, including submarines, use ocean navigation only;
aquatic enemies may use all connected water. River mouths should have visible
shallows or rapids so a ship restriction is understandable. Do not classify all
sea-connected water as ocean, since that would incorrectly admit ships to rivers.
Preserve ocean bridge underpasses; a bridge does not change a river's water type.
Provide broad ocean channels and shores suitable for the current 7 x 12 docks.

### Bridge stage

Implemented locally: the existing builder offers Standard (3 wide, up to 24 deck
rows) and Heavy (5 wide, up to 48). Both work across sea, rivers and lakes; the
water's navigation rules remain unchanged. Preview and server admission check
full-width anchors, approaches and deck, and show cost and duration. Heavy costs
50 + 10 GND per row and takes 5/3 of standard construction time at the same span.
Saved bridges keep their geometry, timing and payment; new records store their
profile explicitly. See [bridge builder](BRIDGE_BUILDER.md) for behavior and tests.

### Aquatic hive stage

Implemented locally: one hive at Glassmere on Vesper. Use Planet overview's
compound selector, **Glassmere / aquatic hive**, to locate it. A backed-up additive
migration finds clear lake water near the shore, avoids saved units, facilities
and bridge decks, and leaves terrain unchanged. If that lake is occupied and no
safe position exists, it records a skipped placement rather than moving assets
or retrying unexpectedly later. Caldera receives no hive. Native canvas art shows
a half-submerged mound, breathing sacs, vents and spawning mouths.

Current rules (author playtest and balance tuning still pending):

- 1,500 HP; ordinary HE artillery, bombs and missiles damage the exposed body.
  A scattered missile barrage damages it; sustained HE is needed to defeat it.
- Regeneration starts eight seconds after the last damaging hit and restores
  30 HP/second. Hits interrupt healing. Health and healing status are visible.
- A two-second warning precedes a six-tile toxic cloud. It lasts six seconds,
  deals 8 HP/second and can vent every sixteen seconds. Exposed ground/surface
  bodies, hulls and facilities are vulnerable; airborne bodies, fully submerged
  submarines and protected starting cores are excluded. Occupied hulls take
  damage without also damaging their crew. Clouds stay translucent.
- Spawn attempts occur every six seconds on valid water, up to six living
  defenders per hive (including sleeping survivors). Active swimmers retain
  their six-enemy limit and share the global 24-active-enemy budget. No queue
  accumulates while full. Saved sequence/timers make spawning deterministic.
- Bile spitters have 100 HP, ten-tile range and a four-second cooldown. A visible
  1.1-second windup locks the target point; a dodgeable glob arrives 1.4 seconds
  later. Impact deals 24 damage within 1.4 tiles and leaves a 1.6-tile puddle for
  3.5 seconds. They stay in water and within a bounded distance of home.
- At most four aquatic warning/cloud fields share the existing twelve-field,
  512-tile-area admission budget. Active bile shares the eight-shot acid pool.
  Full capacity rejects new shots cleanly; accepted shots resolve once even
  after shooter loss, save/restart or a long simulation step.
- Hive destruction is permanent: regeneration/spawning stop and its ruin remains.
  Pending vents cancel; emitted clouds expire. Surviving defenders remain but
  never recreate the hive. Health, damage delay, ownership, shots, fields and
  conquest persist in simulation time; nothing advances while paused/offline.

### Order and acceptance

1. New template and seeded terrain: compare silhouettes, routes, broad naval
   approaches, buildable landing area and readable desktop/phone survey views.
2. Shared ground, flight and water navigation: manual and remote paths, return
   missions, maximum-speed ridge avoidance, ocean-only ships, save/restart and
   byte-for-byte preservation of existing Caldera terrain.
3. Longer/wider bridges: bank selection, full preview, payment, construction,
   robot/tank/builder crossing, ocean underpasses and legacy bridge compatibility.
4. One aquatic encounter: HE damage, interrupted regeneration, warned clouds,
   dodgeable bile, target-medium rules, capped spawning, multiplayer observation,
   restart and permanent conquest. Tune it before placing multiple hives.

Stages 1-4 are implemented locally. Terrain/bridge checks cover deterministic
generation, movement, construction, underpasses and preservation of legacy maps.
Aquatic checks cover HE damage, delayed regeneration, water-only bounded spawning,
warning/dodge behavior, crew and medium exclusions, shared hazard admission,
accepted projectile persistence, backup migration, two accounts observing one
hive and permanent conquest. Desktop and phone browser checks cover the actual
Vesper encounter's warning, active cloud, swimmer rendering, overview location and
reload without client errors. Sustained multiplayer combat capacity is still
unmeasured; local checks are not Fly deployment evidence.

The [orbital expansion and following polish](ORBITAL_EXPANSION_AND_POLISH.md)
records the additional strike types, presentation art, texture/terrain variety
and the author's request for two further planets. Audio replacements are listed
in [the sound asset checklist](SOUND_ASSET_CHECKLIST.md).

Agreed 23 October 2026. These are staged follow-ups after helicopter and
submarine Remote. Stages 1-4 and stage 5's single-track BGM are implemented locally;
weapon sound effects are now implemented locally too. Movement/ambient sounds,
adaptive music remain future work. Stage 6's Vesper terrain foundation is now
implemented as described above, including one aquatic hive; additional planets
and more hive placements remain ahead.

1. **Tank appearance and movement effects - implemented locally.** A fictional
   heavy tank inspired by the Challenger 2 silhouette: broad tracks, angular
   turret cheeks, sloped hull armor, engine grille and a long recoiling cannon.
   Track links follow signed travel and hull turning, including reverse motion.
   Sand produces a stronger dust trail than grass; water and metal floors produce
   none. Dust uses at most ten analytic puffs per rendered tank, with no growing
   particle collection or server state. Reduced effects disables dust and track
   animation. Existing recoil drives the new hull and cannon. Gameplay footprint,
   acceleration, steering, health, weapons and guard behavior are unchanged.
   Validation: 20 tank/motion/guard tests, typecheck, desktop (1920 x 1080) and
   phone (390 x 844) driving/reload checks, inspected screenshots, and canvas
   checks for sand/grass versus floor/water/stopped/reduced dust suppression.
2. **Recycler and bridge-builder handling - implemented locally.** Both retain
   their appearances and 3.5 tiles/s forward limit. The recycler accelerates and
   steers more quickly; the builder feels heavier. Release WASD to brake, hold
   the opposite direction to brake then reverse, and slow for tighter turns.
   Remote recyclers brake and align at route corners and stop before collecting
   or unloading. Manual collection waits for a stationary half-second. Sand and
   grass produce bounded dust; flooring, water and reduced effects suppress it.
   Expired input, disconnect, boarding/exit and restart clear manual momentum;
   bridge construction holds the builder still. See [handling](VEHICLE_HANDLING.md).
3. **Friendly wrecks and recycling - implemented locally.** Cracked vehicle wrecks
   use the facility-ruin visual language. Park a recycler near a land wreck, or
   stop an armored transport carrying a recycler near a sea wreck. Half the
   actual recorded GND/ORB payment becomes raw salvage, using normal receiver
   processing and rocket shipments. Free/unknown purchases have no hull refund;
   stored cargo remains recoverable. Saved finite balances prevent duplicate
   awards; ruins and conquest history remain. See [wreck recovery](FRIENDLY_WRECK_RECOVERY.md).
4. **Deployment icons and facility art - implemented locally.** Distinct SVG
   silhouettes identify the four orbital strikes, support outpost, bridge builder,
   empty runway and five-cell tank pod. The compact strike aiming bar retains small
   icons. Missile and rail cards also match their overhead equipment more closely.
   The missile battery has twelve recessed cells, service grilles, perimeter armor
   and reload indicators. The railway cannon has rail bogies, hydraulic stabilizers,
   a bolted turntable, armored breech and reinforced recoiling barrel. Existing
   bracing, chassis rotation, elevation and operator indicators still drive the art.
   Drawings scale with tile size; collision, placement, costs and weapons are
   unchanged (4 x 4 battery; 3 x 3 rail cannon). No particles or saved state added.
   Validation: 19 catalogue/rail/missile tests, typecheck, desktop 1920 x 1080 and
   phone 390 x 844 catalogue checks, Escape/resize checks, and inspected canvas
   previews for ready/reloading/invalid battery and braced/traversed/elevated cannon.
5. **Audio - BGM and weapon effects implemented locally.** Apex of Conquest
   loops during play with saved on/off and volume controls under Help, gesture
   startup and hidden-tab pause. The supplied audio is unchanged. Travel/combat
   crossfades remain a later stage; see [background music](BACKGROUND_MUSIC.md).
   [Weapon effects](SOUND_EFFECTS.md) add confirmed firing, missile launches and
   impacts with independent controls and a bounded distance-based mix. Movement,
   ambience and UI sounds remain later stages. The next
   proposed communication stages and inspected local sound candidates are in
   [chat, emotes and sound](CHAT_EMOTES_AND_SOUND_PLAN.md).
6. **Terrain and a second planet.** Add obstacle variety, then another planet with
   distinct terrain textures. Define collision/navigation and seeded generation
   before introducing new obstacles; keep existing saved worlds intact.

Complete and play-test each stage before the next. Bound dust/wake/audio work,
support reduced effects and mobile layouts, and measure rather than assume the
runtime cost. Commit, push and deployment are separate release steps.

## 24 October: rail presentation and weapon plan

See [Rail weapons polish](RAIL_WEAPONS_POLISH.md): the cannon returns to Rail,
tracks render below objects, new straight sections unfold from a central crate,
and the long-barrel cannon reaches 180 tiles. The separate charged rail MAC is
implemented locally: 2.5-second charge, three-enemy penetration, 900 damage per
target and a 10-second cooldown. Author playtesting and balance tuning are next.

Deployment presentation: the Logistics category is now labelled **Facilities**.
Air and Naval cards use distinct inline silhouettes for all eight vehicle types:
gunship, submarine, transport, carrier, bomber, attack jet, helicopter and aerial
gunship. Card icons also carry through to the detail preview and delivery choices.
Desktop and phone layouts were checked locally; this is a presentation change.

Large fleet stage (24 October): new 7 x 12 offshore docks and 10-12-tile-long
ships are implemented locally with matching physical hulls, turret origins,
stern transport loading and return approaches. Older berths retain their working
scale. See [Ship visual scale](SHIP_VISUAL_SCALE.md) for dimensions, compatibility,
ocean-clearance findings and validation. Next: author playtesting of proportions
and coastal routes before considering a larger map or further balance changes.

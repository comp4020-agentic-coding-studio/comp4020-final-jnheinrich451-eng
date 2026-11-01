# Colony industry, settlement life and a meaningful ending

2 November 2026. Design proposal for review, not implemented gameplay or a
commitment to every feature below. The author requests discussion of conveyors,
food processing, bio-power and robot charging, with mild pressure and a clearer
long-term purpose for the separate peaceful expedition.

In the follow-up, the author welcomes that direction and adds fishing, ponds
or lakes, a bonfire, a wooden cabin, a movie screen, weather and sunrise/sunset.
These form the proposed settlement-life branch below. Recipes, pacing and the
individual implementation stages still need playable validation; recording the
ideas does not mean their functionality has been implemented.

## Current game, verified in code

`public/colonization.js` implements planting, free watering, sprinklers, harvests
and shared produce storage. Sending two matching crops consumes them once and
returns 16 building materials after eight active seconds. All three crop types
currently get that same starter exchange. Dry plants pause; ripe crops and
stored produce wait. There is no industrial processing, electricity or robot
battery. First planting, harvest and shipment are opening milestones, not a
complete colony-development campaign.

The current destinations are Morrow, Nacre and Aurelia; older planet names in
the original roadmap are superseded by `COLONIZATION_HUD_AND_PLANETS.md`.

## Recommended core

Turn a hand-tended garden into a reliable settlement, then commission its link
to human society. Give the expedition a finite campaign and an optional
continued gardening/building mode after completion. The interesting decisions
come from how a small set of machines depend on each other: crop allocation,
food versus fuel, transport capacity, storage and available power.

An initial design target is roughly 60–90 minutes to the first commissioning,
across one or several saved sessions. This is an untested pacing target, not a
promise; adjust recipes, objective scope and growing times after playtests.
Do not lengthen the game simply by increasing waiting times or shipment counts.

## A compact connected chain

```text
Growing beds -> harvest outlet -> belts -> food processor -> provisions
                                              |                |
                                              v                v
                                           biomass        orbital exports
                                              |                |
                                              v                v
                                        bio-generator       materials
                                              |
                              processing / tending / charging
```

- **Harvest outlet:** a powered bed attachment that gathers a ripe crop into
  its own small output store and can replant a chosen renewable seed. Stops
  safely when full. Manual gardening remains available.
- **Conveyors:** short, directional links between clearly marked machine
  ports. Begin with straight pieces and corners; splitters and multiple lanes
  can wait. Transported goods occupy bounded inventories and take time to
  arrive. Blocked destinations stop the line without losing goods.
- **Food processor:** converts crops into provisions and useful biomass. Crop
  recipes should differ in food output, processing time and byproducts. Use a
  few legible recipes first, rather than many ingredients.
- **Bio-generator:** burns biomass to run the industrial network. It can also
  accept raw harvested crops directly, so starting or restarting electricity
  never requires an already powered processor. Diverting food crops to fuel
  trades export income for immediate energy.
- **Charging:** the hub offers automatic charging while parked; a later remote
  charging pad extends work away from home. The hub keeps an independent slow
  emergency supply. The new tracked worker retains its existing appearance.
- **Orbital post:** accepts valuable provisions and milestone consignments.
  Keep the existing raw-sample exchange as a basic route to building materials.

The first processor can be loaded manually. Automation adds continuous tending
and transport, reducing repeated handling as the settlement grows. Belts must
not just decorate the existing global store: automatic production uses local
input/output buffers, while shared storage remains a manual reserve. Once a
unit of cargo moves, its old inventory must no longer contain it.

## Mild pressure and recoverable failure

Power shortage slows or stops optional machinery. Full output buffers stop
processing; full harvest outlets leave crops ripe. These visible bottlenecks
give players useful problems to solve. The player can read the cause at the
machine: no input, full output, blocked route or insufficient power.

Robot batteries should last a useful work trip, not interrupt play constantly.
Charging is automatic at a dock. An empty battery enters slow reserve travel
and suspends powered work; a free recovery route returns the worker to the hub.
Do not introduce battery costs as a substitute for meaningful handling: current
gardening commands are available remotely throughout the surveyed district, so
draining charge merely for clicking those commands would add chores without
improving logistics. Review battery costs with the first physical tending jobs.

Optional priority consignments provide explicit failure: a player knowingly
accepts a delivery with an active-play deadline. Missing it records a failed
order and loses the bonus; it creates no debt and destroys no settlement.
Ordinary exports and main milestones remain untimed. Deadlines, fuel use and
robot drain stop whenever the existing runtime stops simulation. Inactive or
disconnected workers must not drain batteries.

No crop death, food spoilage, human hunger or permanent loss of a save is
proposed for this stage. Preserve a recovery path through free seeds, watering,
manual harvests, raw exports, direct generator fuel and emergency hub charging.
Allow safe removal/rerouting with visible treatment of contained cargo; an
unaffordable layout error must not trap the colony permanently.

## Completion

The final project commissions a communications and freight link. It requires
a varied provisions consignment, built infrastructure and a short active-time
demonstration that food production and energy reserves can support the link.
Exact requirements and trial duration remain balance decisions. A failed trial
can be retried after fixing the line; paused or closed rooms do not fail it.

On success, celebrate **CONNECTED TO THE HUMAN NETWORK**, show the settlement
and its contribution, and offer continued free building. Later planet-specific
recipes and layouts can create replay variety; another large machine roster
is not required before this first ending works.

## Suggested implementation sequence

1. Food processor, a small recipe set, local input/output stores and provision
   exports. Manual loading makes the entire processing loop playable first.
2. Harvest outlets and simple belts, using those same inventories. Verify that
   layout and throughput create decisions before adding more transport types.
3. Bio-power and charging with direct-fuel startup, emergency recovery, explicit
   machine states and readable energy supply/demand.
4. Network commissioning, a completion presentation and optional rush orders.

The settlement-life branch can be developed alongside these stages. Its
proposed order is shared lighting/time and camp decorations, natural-water
fishing and a garden pond, gentle weather, then the licensed outdoor cinema.
Freeform terrain editing remains a later, separately bounded feature.

These are proposed stages, not changes already authorized by this document.
Before implementation, settle the first stage's recipes, costs, footprints and
storage limits; present later numbers as provisional instead of silently
adding all systems to an existing save. Preserve established free garden tools
and terrain. Any saved industrial additions require additive, backed-up
initialization rather than resetting an expedition.

## Engineering and playtest boundaries

Keep one authoritative colony simulation and durable resource transactions.
Co-op players share infrastructure and production, with individual worker
batteries. Test concurrent loading/harvesting, input and output saturation,
duplicate commands, power loss/recovery, dismantling with cargo, paused rooms,
restart during processing and completion recorded only once.

Conveyors should use bounded transport queues and cached connected routes, not
a physics body for each crop. Clients animate representative crates between
server updates; server inventories decide actual quantities and arrival. Wube's
[belt optimization write-up](https://www.factorio.com/blog/post/fff-176)
describes grouping connected belts and avoiding per-item position updates.
That supports investigating grouped transport here; it does not establish any
performance result for Frontier. Measure busy desktop/phone scenes and co-op
delivery alongside the existing movement checks.

Keep the warm illustrated landscape, white mechanical buildings, small glowing
status lights and visible cargo. Existing compact inspectors should explain
each machine's inputs, outputs and blockage without permanent screen clutter.

This turn verifies the existing loop and records the proposal only. No runtime,
economy, saves, tests or deployment are changed by this design discussion.

## Life at the settlement

The settlement should be a place the human operators enjoy through their robot
bodies. Leisure offers its own reward: a favorite fishing spot, a cabin beside
the water, sunsets, firelight and shared movie nights. Keep it voluntary; no
mandatory happiness meter, sleep chore or entertainment requirement gates the
human-network objective. This supports continued play after commissioning.

### Fishing and ponds

Morrow, Nacre and Aurelia already have water in their generated districts. First
allow shore fishing from a reachable bank: cast, watch a float, respond to a
clear bite cue and reel in. Use one accessible interaction with a generous
window and an optional relaxed-assist setting. A missed bite costs a short wait,
not scarce starter materials. Species can vary by planet, in-game time and
weather. A collection journal, release option and later provision recipes give
fish several uses without making fishing mandatory for basic progression.

A buildable garden pond provides a chosen home fishing spot. Start with a
bounded footprint, illustrated water, planted edges and a small optional jetty.
Natural-looking stone/reeds can soften the white service rim. Later stocked
aquaculture can use crop-based feed and produce ingredients for the food
processor; it is separate from the first recreational fishing interaction.

Implement the pond as a saved placeable overlay before offering an unrestricted
terrain brush. Its water must participate in authoritative collision and
placement rules. Never cover a worker, spawn, hub, shuttle pad or occupied
facility, and preserve access to essential routes. A later lake-sculpting tool
needs a preview, bounded cost, reversible saved tile edits and connectivity
checks. Existing worlds must not be regenerated.

Current implementation constraints: `colonyCanStand` recognizes terrain and the
hub, so solid new decorations need shared collision support. Terrain rendering
is cached by world identity/version, and routine snapshots omit the world.
Actual terrain edits therefore need revision propagation, cache refresh,
reconnect/reload handling and durable edits in addition to a placement brush.

### Daylight, weather and atmosphere

Use the saved authoritative active-game clock for a shared dawn, day, sunset
and blue night. A 24-minute full cycle is an initial visual pacing proposal,
not a settled balance rule. All players should see the same phase, and saves,
reconnects and pauses preserve it. No requirement to attend at a real-world
hour. Keep night readable and the interface independent of scene darkness.

Start with clear skies, drifting cloud and light rain. Warm sunrise, amber/pink
sunset, small stars, water glints and warm window/firelight create atmosphere.
Later gentle rain can water beds and change the fishing table, with no floods,
crop death or destroyed machinery in this pass. Keep weather randomness seeded
and saved so rejoining cannot reroll beneficial weather. Normal crop growth
need not stop at night.

A scene tint and a limited set of cached local light masks can provide the
look without a dynamic lighting simulation. Cap visible rain, smoke and fire
particles; reduced animation simplifies those effects while retaining the
shared day/weather state. Validate phone rendering before adding more effects.

### A small decoration set

- Bonfire with seats, warm flicker, tiny sparks and a quiet local crackle.
  No spreading fire or compulsory fuel upkeep in the leisure version.
- Wooden cabin with a white Frontier frame, timber cladding, a small porch,
  warm windows and a place to park the robot. Start as an exterior building;
  a walk-in furnished interior would be another stage.
- Benches, paths, lamps and reeds to connect the cabin, pond and working garden.
- Outdoor cinema with seats, a softly lit screen and optional personal audio.

Keep the white metal and illustrated environment already established. These
elements should make a coherent lakeside space rather than another collection
of mandatory resource-producing facilities. Optional co-op interactions can
let workers park together at seats, fish side by side and watch a common clip.

### Movie media and rights

The proposed screen uses a short authorized local video. In multiplayer, the
server shares a media ID, play/pause state and start position on the active
clock; each client decodes the file locally and can mute or enable its own
audio. Late viewers seek to the current shared position. Decode only a visible
screen, cap resolution and reduce the background music when a viewer chooses
movie sound. No arbitrary external streaming URLs or user media uploads are
needed in the first version.

General Australian copyright guidance: a downloaded or purchased copy does
not itself establish permission to redistribute the film inside a hosted game.
Use an applicable license, rights-holder permission or a valid exception; being
a free or student project is not by itself permission. The
[Attorney-General's guidance for users](https://www.ag.gov.au/rights-and-protections/copyright/copyright-users)
explains permission, open licenses, exceptions and expired copyright. Check
the actual selected version, including its soundtrack; an unfamiliar uploaded
file cannot be cleared from its filename alone.

Promising animated candidates identified by their official published project
pages are [Spring](https://studio.blender.org/projects/spring/pages/about/)
(CC BY 4.0) and [Big Buck Bunny](https://peach.blender.org/about/)
(CC BY 3.0). Use the original official release, retain its required attribution,
and do not assume unrelated uploads, replacement music or associated logos
share those permissions. The Spring page expressly excludes logos/trademarks.

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) allows redistribution
and adaptation, including commercial use, subject to its terms: appropriate
credit, a license link, identification of changes and no additional restrictions
on the licensed work. Other license types must be checked individually. An
asset record should retain the title, creator/credit, source URL, license URL,
downloaded version and any edits. These are candidate sources and licensing
guidance, not clearance of an as-yet-unselected movie file. No film was downloaded
or added to the project in this discussion.

### Validation before release

Check simultaneous fishing claims and duplicate requests, restart during a
cast, placement under workers or on essential routes, saved pond/cabin
collision, undo/removal, shared weather/time across two clients and reconnect,
paused growth/weather, screen start/pause/seek and late entry, personal mute,
readable phone controls, reduced effects and rendering performance. Preserve
the separate combat game and developer saves throughout.

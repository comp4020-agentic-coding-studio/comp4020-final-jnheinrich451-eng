# Colonization: the growing years

This records the initial playable stage. The later
[HUD and planets stage](COLONIZATION_HUD_AND_PLANETS.md) supersedes its entry
instructions: use **Colonization → New expedition**, with separate peaceful
Continue browsing and the Morrow, Nacre and Aurelia destinations.

1 November 2026. The author approved a first implementation of the separate
peaceful expedition, with a warm, cute appearance: "like the war never exist."
This is a local playable stage. It does not deploy or replace a military save.
The [longer-term design](COLONIZATION_MODE_DESIGN.md) remains the roadmap.

## Implementation plan and stage boundary

1. Add a Colonization choice beside Combat in New Game, with an explicit saved
   mode, a separate runtime and the same account/invitation lifecycle.
2. Build one complete loop: free bed, renewable seeds, watering, harvest,
   shared storage, orbital sample delivery, useful building-material reward.
3. Give it its own peaceful presentation and controls: cream, sage and peach,
   rounded nursery buildings, expressive robots, readable crop stages and gentle
   environmental motion. Check desktop and phone layouts.
4. Verify concurrent play, saved return, restart, pause and isolation before
   expanding its systems.

These four parts constitute this implementation. Next stages are useful
automation and projects, then wider settlement and connection to human society.
A handoff from a conquered combat campaign needs a separate explicit stage.

## Setting and entry

An earlier military expedition secured the world. A later ship, operated by
preserved human heads with AI assistance, arrives to cultivate and develop it.
The interface presents a fresh beginning: no military HUD, weapon controls,
enemies, danger warnings, ruined facilities or combat soundtrack. MOSS is a
small garden companion with contextual advice, not a network-dependent AI call.

Choose **New Game -> Colonization -> planet -> name -> Create and enter**.
Continue cards label Combat or Colonization. Invitations target one existing
expedition and route peers to the correct interface. Guests can join an invited
expedition through the existing Join flow. There are still three owned saves
across all planets/modes, four participants per room and two active named rooms.

Each new colonization save contains a deterministic **72 x 56** surveyed
district with safe starting ground, trees, flowers and water. Caldera, Vesper and
Sirocco use different palettes. This is a compact garden map, not the full
military planet or imported geography. No existing world regenerates. The
nursery hub supplies seeds/storage; the nearby shuttle pad handles deliveries.

## The first growing loop

| Item | Current rule |
| --- | --- |
| Starting materials | 40, shared by the expedition |
| First growing bed | Free; additional beds cost 6 materials |
| Growing bed | 3 x 3 footprint; one crop choice; maximum 16 |
| Sundrop | 45 seconds of watered growth; yields 2; replant after harvest |
| Moonberry | 90 seconds of watered growth; yields 3; shrub regrows after harvest |
| Cloudmelon | 150 seconds of watered growth; yields 5; replant after harvest |
| Seeds and watering | Renewable and free; watering supplies 90 seconds of moisture |
| Sprinkler | 12 materials; waters beds within 5 tiles; maximum 8 |
| Shared produce | 99 total; full storage rejects harvesting and retains the ripe crop |
| Orbital sample parcel | 2 of one crop; 8 active seconds; returns 16 materials |
| First delivery | Completes the opening milestones and adds a decorative pennant |

Dry plants stop growing; they do not die. Ripe crops wait indefinitely. Stored
produce does not spoil. Free first construction plus renewable seeds/water
prevents spending on sprinklers from making the first harvest impossible.
"Change crop" resets that bed's plant without removing the bed. Shipping consumes
produce once; its saved in-flight parcel returns its reward once.

Construction is limited to clear ground in a 14-tile survey radius around the
hub. The whole bed footprint must fit. Hub/pad space, rocks, water, other beds
and sprinklers reject overlapping construction. Crops and sprinklers do not
trap walking robots. All gardening commands use the ship's assistance anywhere
in this surveyed district; avatar proximity is not a prerequisite for tending.

## Presentation and controls

The canvas has soft grass and water, round shrubs, flowers, a friendly domed
nursery, a small shuttle, smiling robots and visible crop growth. Watering
changes soil color; sprinklers animate; harvests emit a short petal burst and
the first delivery celebrates. Butterflies and decorative effects remain local.
The renderer caches terrain, draws visible features, caps pixel density and
supports reduced animation. No new external art or audio service is required.
Audio composition and wider biome-specific vegetation remain later polish.

- **WASD / arrow keys:** walk; phone direction pad supports held movement.
- **Drag:** move the view. **Wheel / + / -:** zoom. **C / recenter:** follow robot.
- **Garden:** select an existing bed; choosing a bed reveals crop actions.
- **Growing bed / B:** choose a placement. The welcome button places the free
  bed in a validated starter spot. **Sprinkler:** place irrigation.
- **E:** water or harvest the selected crop; buttons provide the same actions.
- **Orbital post:** inspect storage and send two matching samples.
- **Crew:** invite, pause/resume while alone, or save and leave.
- **Escape:** close a panel or cancel placement. Movement releases on blur,
  hidden page, pointer cancellation and leaving.

## Shared state, durability and resource bounds

`campaigns/service.js` adds a backed-up, additive `mode` column. Existing rows
default to Combat; invalid new modes are refused. Colonization runs in
`colonization-runtime.js`, persists to its own `colony.sqlite`, and loads no
combat simulation or SUP economy. Combat weapon endpoints are unavailable in
the peaceful runtime. The mode is carried through server routing, saves, list
responses, guests and invitation entry. The runtime is included in Docker and
the shared client/server build fingerprint.

The server validates costs, coordinates, crop state and every accepted action.
Each accepted garden command commits the next state and a request receipt in
one SQLite transaction before acknowledgment. Repeated request identifiers
return the original result; reusing an identifier for a different order fails.
The latest 128 receipts per player are retained. Bed revisions and live state
prevent concurrent harvests from paying twice. Peers share beds, materials,
produce, parcels and milestones.

Growth and robot positions checkpoint once per second and on orderly lifecycle
changes. An abrupt process loss can lose at most that interval of unsaved
movement/growth, while accepted commands remain committed. There is no offline
catch-up. Active simulation stops when paused, the host disconnects, or no one
is connected. The registry's 30-second reconnect grace still applies. Joining
a solo-paused room resumes it under the existing room rules; solo pause is
unavailable while teammates are present. Host departure closes the room.

Movement uses sequenced input and a 450 ms lease. The server simulates movement
at 20 Hz, advances growth in roughly 250 ms steps and broadcasts at 4 Hz.
Paused rooms retain a one-second snapshot heartbeat without advancing growth.
Streams are bounded to three per player; slow streams are disconnected above
128 KiB queued output. Input/order limits are 30/12 requests per second per
player. Authorization and pause are rechecked after asynchronous body reads.
The existing request/audit framework records receipt, rejection, colony orders,
snapshots and broadcasts without treating client drawings as authority.

## Verification

Evidence is local and uses disposable accounts, databases and rooms. It does
not alter the author's saves or claim Fly deployment/capacity.

- **`pnpm check`: passed, 146 files / 1,142 tests**, including TypeScript,
  with an isolated HTTP fixture supplied as `APP_URL` (151.11 s test run).
  The two supplied course invariants are unchanged.
- **19 domain tests:** all three templates, placement and caps, first-bed
  affordability, drought, irrigation, harvest/regrowth, storage saturation,
  crop changes, saved parcel completion, malformed commands and collision.
- **2 registry tests:** a backed-up old-save migration, default Combat mode,
  explicit Colonization mode, persistence, guest invitation routing and the
  unchanged shared save limit.
- **3 real HTTP integration tests:** concurrent harvest produces one yield;
  duplicate request receipts and in-flight parcel survive restart; reward is
  returned once; isolated rooms, invalid/foreign/combat requests, paused time,
  actual host disconnect/reconnect and movement leases behave as intended.
- **Desktop and 390 px phone entry tests: 2 passed.** Mode persists through
  refresh; names and save cards retain the chosen mode. A failed enter after
  creation preserves the save instead of creating a second campaign.
- **Desktop and phone garden tests: 2 passed.** The desktop test used a genuine
  45-second growth cycle, canvas sprinkler placement, harvest, eight-second
  delivery, a seven-second solo pause, movement and reload. The final phone
  rerun also verified the nearby-sprinkler button, held movement/release and
  the visible selected bed. No browser errors or horizontal overflow.
- **Two-browser co-op test: passed.** Independently authenticated users joined
  with a real UI-generated invitation. Final measured peer UI delays were
  **58 ms for bed construction, 40 ms for planting and 42 ms for watering**.
  Host-tab closure froze growth; reopening resumed it. Held movement stopped
  after a synthetic browser blur event (headless contexts retain focus), while
  the active garden clock continued. These are local observations, not network
  or four-player capacity guarantees.
- Three existing entry/navigation browser regressions, JavaScript syntax
  checks and scoped whitespace checks passed.

The main checks live in `spec/colonization.test.ts`,
`spec/colonization-runtime.test.ts`, `spec/campaign-mode.test.ts`, and
`tests/browser/{colonization-lobby,colony,colony-coop}.spec.js`. The browser
fixtures start disposable app servers themselves; this run used temporary
Playwright configs without an additional `webServer`.

Archived evidence: [desktop garden](testing/evidence/2026-11-01/colonization-garden-desktop.png),
[delivery](testing/evidence/2026-11-01/colonization-delivery-desktop.png),
[phone garden](testing/evidence/2026-11-01/colonization-garden-phone.png),
[co-op](testing/evidence/2026-11-01/colonization-coop.png), and
[measured co-op propagation](testing/evidence/2026-11-01/colonization-coop-propagation.json).
The author's first visual review welcomed the environment and requested robot
and facility art consistent with Frontier's human civilization. The separate
[visual revision](COLONIZATION_VISUAL_DIRECTION.md) records that direction and
the proposed next pass. Longer-session balance remains to be playtested.

## Remaining stages

1. Nutrient processing, tending robots, optional replanting and packing queues;
   small shared projects and decorative rewards.
2. Distinct biome crops and shelters, more outposts, transport and a human
   network-connection objective. Preserve relaxed care and useful automation.
3. Evaluate a separate expedition created from a cleared combat world's stable
   geography. Resolve survivors/committed attacks first, preserve the original
   save, and explicitly choose which noncombat infrastructure can carry over.

These are planned work, not hidden functionality in this release. No fertilizer,
offline growth, daily obligation, factory chain, terrain transformation, farming
vehicle roster or combat-to-colony conversion is implemented in this stage.

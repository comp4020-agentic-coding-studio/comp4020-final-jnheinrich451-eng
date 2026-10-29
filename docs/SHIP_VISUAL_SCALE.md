# Ship visual scale plan

## Confirmation safety, 30 October 2026

Dock confirmation now includes the exact displayed shore, orientation, berth and
layout scale. If another player or enemy obstructs it before acceptance, the
server returns 409 before charging instead of silently snapping to a different
site. The player can review the updated preview and confirm again. Successful
retries still return the existing dock, including after restart. The HTTP
regression covers obstruction, no charge on rejection, malformed previews and
once-only admission after a new preview. Legacy API callers without a preview
retain their original admission behaviour; the current browser always sends one.

## Coastal placement correction, 25 October 2026

The old large-dock selector required a click exactly eight tiles offshore and
seven entirely dry platform tiles. This made ordinary beach clicks fail and
excluded stepped shorelines even with plenty of ocean space.

New empty docks accept shore or nearby-water clicks. A bounded, deterministic
search checks coastal anchors within 12 tiles of the click, preserving an exact
valid offshore selection first. The 7 x 1 shore platform can span water gaps but
must include clear land; its 7 x 12 offshore pier remains ocean-only. The full
8 x 14 berth, carrier departure corridor and turning area are still validated.
Inland waters, obstacles, occupied footprints and dock limits remain enforced.

The browser shows the actual snapped platform, pier and reserved berth before
confirmation, using the same placement function as the server. Its small preview
cache clears on every received state. Saves retain canonical deployment geometry
and the original click separately so retries, including after restart, return the
same dock without another charge. Existing docks and terrain are not moved.
The initial selector finds a nearby shoreline once, rather than repeating the
neighbourhood search for every tile. Confirmed selections frame the complete dock
and berth clear of the phone sheet. The catalogue specification column no longer
changes tray height on hover, which could move the dock card out from under a click.

Regression coverage includes beach and water clicks, stepped coasts in all four
orientations, invalid and blocked sites, unchanged legacy geometry, actual HTTP
admission, retry and restart. Desktop and phone naval checks use a shore click
through the real deployment panel before building and restoring a carrier.
Local checks passed: targeted dock/ship/support regressions, both supplied
invariants, TypeScript, and browser checks at 1920 x 1080 and 390 x 844. Inspected
both placement screenshots; localhost serves the current build. No deployment
or Fly performance claim is made by these checks.

## Iowa silhouette, 24 October 2026

Following the author's hull sketch and an overhead USS Iowa reference photo, the
gunship body was redrawn in `public/battleship-art.js` for both legacy 2 x 4 and
large 4 x 12 hulls. After reviewing the first pass, the author asked for a slimmer
hull and a longer bow, and chose to move the secondaries inboard.

- Drawn beam is 80% of the saved width (3.2 tiles on large hulls, about 3.75:1).
  Collision, docks, berths, damage and navigation keep the saved 4 x 12 / 2 x 4
  rectangles. The art is therefore slightly narrower than what physically blocks.
- Large hulls have a long, fine bow with a concave entry that reaches full beam
  near turret two, with a faint knuckle line. Legacy hulls keep a fuller bow so
  their larger turrets stay on deck. Both close with a rounded cruiser stern.
- Teak deck with fore-and-aft planking; anchor chains and wildcats; a V
  breakwater ahead of turret one (large); fantail crane and bitts.
- U-shaped 01-level deckhouse carrying the six inboard twin secondaries (see
  [Ship armament](SHIP_ARMAMENT.md)). Armored conning tower, fire-control tower
  with rangefinder director, masts, aft director (large), two oval funnels with
  black caps and paired pipes, and boats (large).
- Main turrets: three triple mounts at their saved positions, redrawn from the
  author's Iowa turret sketch (see the follow-up below). Transport, carrier and
  submarine art (including the transport's twin turret) is unchanged.

Local validation: art study (`.local/check-battleship-art.mjs`) at three zooms
beside the fleet; TypeScript; 348 of 351 naval-related domain tests pass. The three
failures are a Bulwark rail-HE damage expectation and two campaign sentry-receipt
and stream tests that do not involve ships. Ship armament, handling, naval scale
and dock replacement browser specs pass at desktop and phone sizes (8 runs). Live
1920x1080 and 390x844 screenshots inspected under `.local/battleship-live/`. Not
committed, deployed or playtested by the author yet.

Turret follow-up (same day): the author supplied an Iowa main-turret sketch.
`drawIowaTurret` draws a wide face with chamfered corners and sides that taper
aft, with rangefinder ears near the rear, a haze-grey roof plate and sighting
hoods. Three tapered barrels emerge from canvas blast bags, and the barbette
shows as a dark ring in front of the face. Muzzle tips stay at the shared salvo
geometry (0.13 lateral spacing, 0.8 forward in turret units), and recoil slides
the barrels into the bags. Legacy hulls keep ammunition-coloured muzzle bands.
Checks: TypeScript; art study close-up; dock replacement, naval scale and ship
handling pass at both sizes. Ship armament passed on desktop and phone in
separate runs, but several other runs ended in the native test-worker crash
(`0xC0000005`) already seen in 22 October logs. Live screenshots are under
`.local/battleship-live-turret/`.

Secondary follow-up (same day): from the author's 5"/38 sketch, `drawTwinMount`
draws each of the six twin secondaries with a squared front, a light sloped face
plate and straight sides closing in a rounded rear with an access door. Two
barrels pass through hatched gun-port shields. Muzzles stay on the shared battery
geometry (0.055 lateral, tips 0.43 forward in mount units), and recoil slides
each barrel under its shield. Carrier and transport single side guns are unchanged.
Checks: TypeScript; art study close-up; ship armament, naval scale, dock
replacement and ship handling all pass at desktop and phone sizes in one run
(8/8, no worker crash). Live screenshots are under `.local/battleship-live-secondary/`.

Transport (same day): redrawn as an LCU-style landing ship with a bow ramp, which
supersedes the stern loading described above. See
[Armored transport](ARMORED_TRANSPORT.md).

Carrier (same day): redrawn after the Ford class, and its deck now operates a
bomber and an attack jet. See [Aircraft carrier](AIRCRAFT_CARRIER.md).

Submarine (same day): redrawn after the Ohio class, with 24 animated silo lids on
large hulls. See [Submarine](SUBMARINE.md).

## Large fleet and docks, 24 October 2026

Implemented locally following the author's four sketches and confirmed dock
dimensions. This stage supersedes the earlier art-only proposal below.

- New docks have seven shore tiles and a 7 x 12 offshore pier. Select water eight
  tiles from a straight, clear shore. Placement reserves an 8 x 14 berth alongside
  the pier and checks departure water and a turning area for the carrier.
- Manual docking uses a 1.5-tile centre tolerance at the large docks; legacy docks
  retain 0.8 tiles. All still require stopped engines, settled rotation, a surfaced
  hull and alignment within 22.5 degrees (either facing). Remote return retains
  its precise approach path. No hull or saved position is moved by this change.
- Disembarking tries clear dock tiles if the usual shore exit is occupied; a fully
  blocked dock still rejects exit. Carrier systems explicitly display DOCKED and
  E ashore. Sunken wrecks remain nonblocking and keep their salvage balance.
- Regression evidence: reproduced the saved carrier's 0.874-tile offset, checked
  legacy tolerance, moving/angled/distant rejection, wreck overlap and alternate
  exits. Desktop/phone browser checks use a second player blocking the normal
  exit and verify successful disembarkation and reload.
- New hulls at these docks: gunship 4 x 12, transport 4.5 x 10, carrier 6 x 12,
  submarine 2.5 x 12 tiles. Collision, weapon origins, wakes, construction, damage
  indicators, wrecks and remote docking use the same saved dimensions.
- Gunship: two forward triple turrets and one aft, six secondary mounts, central
  superstructure and funnels. Transport: forward bridge and open stern vehicle
  deck; large transports load through a stern ramp, including remote shore orders.
- Carrier: angled flight deck, starboard island, catapult lanes and elevators.
  Submarine: long narrow capsule, forward sail and 24 visible silo lids. Its current
  six-missile salvo remains unchanged; additional lids are visual reserve capacity.
- Existing docks and vessels keep their original dimensions. New ships at older
  docks remain smaller. Replacing a ruined dock retains that site's geometry;
  choose a fresh coastal site to build the large version. No save reset or terrain
  regeneration is required. Costs, fleet caps, weapon damage and speeds are unchanged.

The map stays 512 x 384 for this pass. A generated-terrain flood-fill audit found
80,596 of 80,607 water centers with conservative 15 x 15 clearance in one connected
region. This supports keeping the current ocean; it is not a guarantee that every
authored inlet or obstructed route admits every hull. Narrow coves can exclude
large ships. Any future map expansion should widen useful passages as well as
adding area, without moving existing saved coordinates.

Validation covers all four hulls sailing and remotely returning, stern loading,
actual weapon/hull coordinates, legacy saves, real generated shores and HTTP
ordering. Desktop and phone browser checks place a large dock, order a carrier,
inspect its assembly and restore it from a disposable save. The fleet artwork was
inspected together at the same tile scale as a railway cannon. Evidence is under
`.local/naval-scale-*` and `.local/naval-large-*`; no deployment is included.
Final validation: 126 tests across 13 domain/HTTP files, both browser sizes,
TypeScript and coursework evidence checks pass locally.

Empty-dock retirement follow-up: retiring the vessel does not remove robots or
vehicles standing on the pier. The shipyard now shows the blocking unit and tile
coordinates inline, and disables dismantling until the offshore flooring is clear.
Walk onto land, reopen the shipyard and dismantle. UI and server share the same
validation. The follow-up passes 36 domain/HTTP checks, TypeScript and desktop/
phone browser checks that walk ashore and successfully remove the empty dock.

The author asked to review ship size relative to aircraft, while retaining the
current runway footprint. First complete bridge underpasses, then review scale
in playable stages.

1. **Bridge passage:** allow all vessel types beneath completed water spans;
   retain ground traffic above, existing artwork and saved bridge geometry.
2. **Carrier artwork:** compare the current carrier with a modest 10–20% visual
   enlargement and its parked aircraft. Inspect at a dock, a bridge and a narrow
   inlet before choosing the final scale. This is a proposal, not a balance change.
3. **Other vessels:** review gunship and transport proportions alongside the
   carrier; keep each silhouette distinct. Review the submarine only if needed.
4. **Playtest:** check boarding, shore ramps, vehicle loading, deck aircraft,
   weapon mounts and desktop/phone views. Enlarged art must not misleadingly
   suggest it collides with a bank or another hull when navigation says it clears.

Initial scope is artwork. Changing physical hull dimensions would need a separate
dock/berth, bridge-channel and transport-access review, including old saves. Do not
silently enlarge collision footprints or shrink runways as part of the art pass.

## Battleship presentation, 22 October

The author chose to remodel the existing gunship first, with the actual nine-shell
salvo as a later gameplay step. The supplied triple-barrel turret sketch is the
reference; this is an Iowa-inspired overhead interpretation, not a scale replica.

Initial visual pass (the main battery is now functional; see the follow-up below):

- Three visible triple-barrel turrets: two forward and one aft. The added forward
  mount follows the existing forward bearing; it has no separate weapon/reload yet.
  Existing live muzzle positions and recoil attribution are retained. The original
  four-shell salvo and two independent reloads remain unchanged.
- Six visible twin secondary mounts, three per side. They follow the existing
  side bearings. Only the original two side firing groups are active; the additional
  mounts and barrels are presentation for the later battery stage.
- Angular armored turret roofs, circular barbettes, deck planking, bridge fittings,
  two funnels and restrained exhaust while the engine is working.
- Speed-driven bow waves and stern propeller foam on surface vessels. Reversing
  shifts the pressure wave and shortens the propeller wash; stopped hulls produce
  no moving wake. Submerged submarines produce no surface wake or exhaust.
- Carrier arresting wires, deck-edge fittings and funnel exhaust; transport keeps
  its open cargo deck and single main turret. No extra carrier main guns.
- Reduced effects disables exhaust and animated foam, retaining a few static water
  marks while moving. All marks are bounded canvas drawing, not network particles,
  saved simulation objects or physical waves.

Hull dimensions, collision, docks, aircraft scale, names, costs and controls are
unchanged. The visual enlargement proposal remains a later comparison: detail gives
the carrier scale in this pass without making its deck overhang existing berths.

### Main-battery follow-up, 22 October

Now implemented locally in [Ship armament](SHIP_ARMAMENT.md): the raised turret
and all nine barrels fire, traverse and reload through shared server/canvas
geometry. Artillery/naval admission permits 12 incoming shells; Fire/Gas allow
nine of one type while keeping total and area limits. The original proposed
requirements below are retained as historical context.

### Secondary-battery follow-up, 23 October

All six twin secondary mounts now aim and fire independently through the shared
geometry. Each broadside cycles one pair every 180ms, with five damage per barrel
to preserve the former maximum damage rate. The target has a dispersion circle;
each barrel has its own muzzle flash and recoil. Carrier/transport side weapons,
hull dimensions and docking are unchanged. See [Ship armament](SHIP_ARMAMENT.md)
for arcs, persistence, limits and local validation. The brief below records the
original proposal; both battery stages are now implemented locally.

### Original armament-stage brief

Use three independent turret reloads with three rounds each. Single click selects
one ready turret; double click fires all ready turrets. Update saved legacy reloads,
HUD readiness and all nine predicted impacts together. Today's eight-heavy-shell
limit cannot admit nine rounds, so capacity must be explicitly revised and checked;
Fire/Gas field reservations also need a decision before permitting a full salvo.
Keep failed volleys atomic and preserve accepted shells across loss/restart.

Recommended secondary battery: six twin mounts, three per side, firing in a staggered
sequence into a visible dispersion circle. Only mounts with an outward firing arc
and valid range may fire. Agree total damage rate first; adding six firing mounts
must not silently multiply current damage by six. Keep existing friendly immunity
and bounded projectile capacity. This is a proposal, not current firing behavior.

Local validation: TypeScript and diff checks pass. Desktop and phone browser
checks pass existing volley/salvo, side fire, release/blur, keyboard controls,
resize and replacement-dock boarding (four final cases). Bridge-underpass checks
also passed at both sizes. Inspected the four-vessel art study and live gunship
screenshots at 1920x1080 and 390x844. This establishes local presentation and
interaction checks, not a Fly performance measurement. Not committed or deployed.

## Wakes and dive water, 24 October 2026

The author asked for more realistic ship wakes, with modest cost, and bubbles when
submarines dive and surface. `public/ship-water-effects.js` keeps a short
browser-only trail per ship: at most 24 poses, one every 0.3 tiles, dropped after
7 s. Trails are reset after a jump of more than 3 tiles, and entries unseen for
20 s are pruned. Nothing is saved, sent or simulated.

- **Foam path:** a translucent strip behind the stern, about the beam wide,
  widens and fades with age. It follows the real course through turns and lingers
  briefly after the ship stops. It is filled in four-point chunks, with thin
  streaks along its edges.
- **Kelvin arms:** from the last 14 bow positions, spreading at the 19.47 degree
  Kelvin angle (capped at 1.6 beams) with short feathered crests. They are faint.
- **Kept:** the bow wave and the propeller churn.
- **Reduced effects:** larger foam chunks, no edge streaks and no feathers.
- **Cost:** a few dozen canvas calls per moving ship.

Submarine dive water is driven by the saved depth countdown, plus a browser-side
note of the last depth change:
- **Dive:** deck vent spray in the first 40% of the dive, then rising bubbles
  that pop into rings. A fading boil persists for 3 s after submerging.
- **Surface:** building froth, then a foam ring around the hull, then water
  shedding off it for 1.8 s.
- **Reduced effects:** six static bubbles and no streaks.

Local validation:
- Wake study (`.local/check-wake-art.mjs`): about 9 s of frames for a turning
  gunship, a straight carrier and a turning transport, plus five dive/surface
  stages.
- Browser specs pass at desktop and phone sizes: ship handling, carrier (zero page
  errors) and submarine operations.
- The live surfacing frame shows the foam path, arms and shedding ring.
- Not measured on Fly or under sustained combat.

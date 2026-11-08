# Colony polish: shuttle flight, printed construction, parcels, the reel fight and the bench

8 November 2026. The first refinement pass after the author closed the colony's
function set. The author's brief, in their words and sketches, follows each
heading. This record holds the stage as built; it follows
`docs/COLONY_COMPANION_STAGE.md`. Numbers are provisional until the author's
playtest.

## 1. The shuttle launches and lands (`public/colony-shuttle-art.js`)

"It can ignite, and carry the cargo up to the sky, vanish in the view, and then
get back with materials. The take off process is like still, and bottom
propeller, and then take off, nose to the air, and back propeller ignited. Very
classic!" Three sketches: at rest; belly flames lifting it straight up; nose
pitched up with a big rear flame.

- The flight is drawn from the saved shipment only: the fraction
  `(duration - remaining) / duration`, predicted at most 0.35 s ahead like
  every colony countdown. Old 8 s shipments in saves play the same sequence,
  compressed. Reduced motion keeps the shuttle parked on the pad.
- A parcel trip now lasts 14 s (was 8) so the launch and the landing have room.
  The reward still lands as crates at the end of the trip.
- The sequence, as fractions of the trip (`SHUTTLE_PHASES`; a few overlap on
  purpose):

| Phase | Fraction |
| --- | --- |
| Morrow's loader lifts the cargo crate into the bay | 0 to .11 |
| Belly glow and heat shimmer, then belly flames with pad dust | .065 to .15 |
| Vertical lift on the belly thrusters to about 3.3 tiles; legs retract | .15 to .33 |
| Nose up to 60 degrees while hovering; the main engine ignites with a flash | .27 to .38 |
| Climb along the nose with a contrail, out of view toward the upper right | .335 to .53 |
| Away: an empty pad, the pennant stays, the contrail fades | .53 to .57 |
| Return from the upper left; the main engine cuts and it flares nose-up to 34 degrees | .57 to .75 |
| Hover over the pad, then descend on the belly thrusters; legs extend | .75 to .925 |
| Touchdown dust, a small settle bounce, thrusters spool down; Morrow's crate comes back down | .925 to 1 |

- Every world now flies the same route (the old Morrow drift up-left is gone).
  The parked shuttle matches the old sprite, plus a small windscreen on the
  nose. While it flies the renderer draws it even when the pad is off screen.

## 2. Every build is printed (`public/colony-print-art.js`)

"From a wooden base, and after a timestamp then directly finished. Kind of
abrupt ... I plan to use maybe a way of 3D printing, and like a drone, or a
droppod lands here, and expand with a crate, and the animation will be some
arms to move left right, back and forth, but we can keep this crate the same,
and after expansion, we have the completed facilities, including the
decorations."

- One rig for everything, scaled to the footprint: a white-and-gold pod falls
  from the sky on retro flames and lands on the site; its walls sink into its
  foot ring while four corner posts slide out to the footprint's corners and
  rise into an open crate frame; its nose becomes the print head on a gantry
  beam. The beam steps back and forth while the head sweeps left and right and
  the nozzle follows the edge of the reveal, with a glow and sparks. The
  finished object (decorations included) appears from the ground up under that
  edge. Then the frame folds back into the pod, which lifts away.
- Timing (`printTimeline`): folding starts at the earlier of the ready time
  and 74% of the timeline. On the 5 s timeline the object is fully printed at
  about 3.6 s; on a furnishing's 8 s delivery at about 5.85 s, before it
  becomes usable at 6 s.
- Reduced motion: no pod flight, no arm sweep and no sparks; the open frame
  fades in, the object is revealed by progress, and the frame fades out.
- The clock is shared and saved. Beds, sprinklers, campfires, the cinema and
  every industry machine record `builtAt` (room time) when they are built and
  print for 5 s; they work from the first moment, the print is only a picture.
  Furnishings keep their saved delivery (8 s, ready at 6 s): the print fills
  that delivery instead of the old cargo shuttle and the pale "wooden" base.
  Queued furnishings wait as a dashed footprint until their pod arrives.
- Saves from before this stage have no `builtAt`, so nothing old reprints.

## 3. The orbital post sends a parcel

"Add a function of input number, or, just select parcel, and we set the
default sending is the all of them. For I find here we only send one
Moonberry on the shuttle, inconvenient."

| Rule | Value |
| --- | --- |
| Default | Everything in the reserve: every crop and every provision |
| Choice | One number per cargo, 0 to all of it; the button shows the item count and the reward |
| Reward | 8 materials per crop, 12 per provision (two crops still make the old 16-material sample box) |
| Trip | 14 s; one parcel at a time; the reward lands as crates |
| Old clients | `ship` with `crop` still sends two of that crop; `ship-provisions` still sends two provisions |
| Refusals | Unknown cargo, negative or fractional amounts, more than stored, or an empty parcel change nothing |

## 4. Fishing: a real cast, a fight and alien fish (`public/colony-fish.js`)

"We need to show the fishing rod, and the animation to throw it in to the
water, and maybe add a mechanism like fish will struggle, and we need to
balance the moving bar into a region and for some times, and express as a
progress bar, if outside of this region it will drop. And if we can like
design some fishes? ... make it various, like combination of fish's features,
for they are alien. And they will be sent into the warehouse. After it will
show like screenshot 3, a future window with gold background color, and a red
bound to show this fish, You caught a [XXX]!"

- The cast (`public/colony-robot.js`, from each cast's saved `since`): the rod
  swings back over the shoulder, whips forward, the float flies out on an arc
  and lands at about 1 s with a dip, two splash rings and droplets, and the
  line settles slack. Every recast throws again. During a fight the rod bends
  hard toward the fish with small jerks, the line runs taut into the water,
  and the fish churns the surface with spray and a flash of its tail in its own
  colours. Reduced motion draws the resting rod, a still bent rod in a fight
  and no particles.
- The pictures (`public/colony-fish-art.js`): one side-view drawing per
  genome, used at card size, in the Camp gallery and as the fight-meter icon;
  small sizes drop fin rays and highlights so the silhouette stays clean.
- The bite is unchanged (a deterministic 4 to 9 s wait, a 3 s window). E on a
  bite now hooks the fish and opens the fight meter.
- The fight: a fish darts up and down a water track; holding E or Space (or
  the Hold to reel button on a phone) lifts a catch ring that gravity pulls
  down. Progress starts at 30%, fills while the fish is inside the ring and
  drains outside it; full lands the fish, empty or 30 s loses it and the line
  recasts. Harder fish move more, dart more and get a smaller ring.
- Server authority: the browser records only when the hold changed. On
  `land` the server replays that recording through the same deterministic
  fight (`simulateStruggle`, arithmetic only, so every engine agrees) and
  decides the catch. A recording longer than the room clock allows (plus 1.5 s)
  is a lost fish; malformed recordings are refused; an unanswered fight ends
  on its own 5 s after the limit.
- The fish: every catch is a seeded combination of body (glider, darter, disc,
  puff, ribbon), fins (sail, frill, spine, wing), tail (fork, fan, whip, twin),
  eyes (pair, single, triple, stalk), pattern (plain, stripes, spots, glowline),
  a rare glow, and a colour from the expedition's own water (Morrow, Nacre and
  Aurelia each have five). The name is the species, for example "Amber
  Sailglider" or "Three-eyed Lantern Rose Spine-darter"; rarer features make a
  Common, Uncommon, Rare or Legendary fish and a harder fight.
- The catch card: gold rays, a red jagged burst around the fish, "You caught a
  [name]!", its length and rarity. E, Enter, Esc or the button closes it, and
  it closes itself after 7 s.
- The warehouse: a landed fish goes to the shared warehouse (the saved
  `fishing.treats` count, shown among the warehouse's product boxes). The
  companion is fed from it. With 99 fish stored a new catch swims free; the
  journal still records it. Camp shows the fish count, the kinds caught, the
  longest three and pictures of the last six catches.

## 5. The bench

"The Robot sits at back side of the bench, but facing us, quite weird!"

- The cause was a rendering defect, not the pose: the browser's smoothed copy
  of each worker took its activity only when the worker first appeared, so a
  worker that sat down (or charged, brewed or fished) after arriving kept
  drawing as a standing robot. Standing on the seat's tile, it sorted behind
  the bench, which then faded over it. Every packet now carries the activity
  across (`public/colony-motion.js`), with a unit test.
- The seated worker draws after its seat and sits on it: lifted to the seat
  height, rear track pods on the seat, front pods over its front edge. A
  furnishing in use no longer fades for the worker using it.
- A turned bench seats its worker facing away from the turned backrest (before,
  every seat faced south whatever the bench's direction).

## 6. Second pass: machines that move, a named spider (same day)

The author's reply after looking: "Thx, perfect! ... we add animations, for
food processor, or the bio plant, and sprinkler, and the harvestor! Those can
move ... some with the wheels, some are arms, just perform some loop
animations are good! And add one small function, the renaming for our cute
spider!" They also asked why the shuttle "still has no animation here", with
a screenshot of the colony page saying the room was closed.

- The room message: their server had restarted at 1:34 PM with the new code, and
  the open page then fails the room check ("This room is closed or your visit
  has ended") until the expedition is entered again from the campaigns page.
  That is the existing lifecycle, not a fault of this stage; the flight itself
  played in every browser run.
- Reduced effects now fade the parked shuttle out as it would lift off
  (fractions .15 to .33) and back in as it would land (.75 to .93), with no
  movement. Before, it simply never left the pad.
- Machine loops (`public/colony-industry-art.js`, and the sprinkler in
  `public/colony-art.js`), drawn in the motion layer only:

| Machine | Working | Idle, enabled | Disabled or reduced |
| --- | --- | --- | --- |
| Food processor | Mixer blades turn, conveyor slats run, a press stamps about once a second | Mixer creeps | Still |
| Bio plant (generator) | Roof fan, a flywheel driving a crank and piston into a finned cylinder, faster bubbles | Fan idles, bubbles drift | Still |
| Harvest outlet | The arm reaches into the bed, the claw closes on the crop and drops it in the hopper | The arm sweeps the bed and dips, the claw flexes, a sensor spot tracks the soil | Rest pose |
| Sprinkler | The head turns with the watering angle; a drive arm kicks | The head sweeps slowly; the arm rocks | Settled |

- Parts that move were taken out of the cached base drawings. Starts and stops
  ease through a small browser-only speed memory per machine (never saved or
  sent), because the saved work clock advances in quarter-second steps and a
  geared-up fan would stutter. A harvest blends in and out of the sweep without
  a jump.
- Naming the companion: Camp has a name field and a Rename button. Any crew
  member may rename the shared spider from anywhere. The name is cleaned
  (control and invisible characters removed, spaces collapsed, trimmed), must
  keep 1 to 18 characters, and is saved with the companion; it shows under the
  spider and in its messages. It grants nothing. A half-typed name survives
  panel refreshes.

## 7. Still machines and a fading shuttle in the author's browser (same day)

The author then reported that the food processor, bio plant and harvester
were "still not moving" and asked whether the shuttle animation "only faded
out". That fade is drawn only with reduced animation, so their browser had it
on. Windows reported animations on (`SPI_GETCLIENTAREAANIMATION` = 1), so the
source was the header switch (two bars beside the recentre button), saved as
pressed in that browser. Its pressed state was a faint tint that looked the
same as off. A recording with full animation showed every machine moving
(3 to 4% of the pixels around each changed within 0.4 s) and none with
reduced animation, so the loops themselves were working.

- The author then asked for full animation as the default. The colony page
  no longer reads the system's reduced-motion setting at all: it opens in full
  animation, and only the switch reduces it, saved per browser. The switch
  also stills the interface's own transitions and the catch card's pop-in
  (a root class), which had followed the system setting. Before this, a
  system request to reduce motion also could not be overridden after a reload.
- When on, the switch is gold with a dark outline, and its tooltip says that
  machines rest and the shuttle fades. Each press says what changed: "Full
  animation: machines run and the shuttle flies." or "Reduced animation:
  machines rest and the shuttle fades away instead of flying."
- Reduced animation still stills the machines and keeps the shuttle on the
  pad; that rule stands.

## 8. Transitions through black, and a descent in the garden's light (same day)

The author asked for a transition instead of an abrupt return to the menu, a
fade instead of the white page shown after a long idle, and why the colony's
descent stays bright over a dark planet when the war zone's seemed to follow
the darkness. Asked how the descent should be lit, they chose to match the
garden's own time of day.

Findings. Both descents drew the same evenly lit ground on purpose (the war
zone's record: "lit evenly so the dive shows land even when the ship is over
the night side"). The colony's also laid a pale veil (47% white) over it. The
war zone ends its dive in black and its game fades in from black; the colony
ended in black, flashed its pale "Preparing the clearing" page, then popped
the garden in. The white page after an idle was the same screen, shown when
the room closed (for example on a server restart), waiting on a link.

- Descent light (`arrivalLight` in `public/colony-ambience.js`): a colony
  admission reply now carries the garden's daylight, dusk warmth, cloud and
  rain from its saved timeline, nothing else about the save. The menu's
  descent grades itself by it (`descentGrade` and `gradeColonyDescent` in
  `public/colony-entry-ship.js`): moonlit deep blue by night, the shuttle
  included; gold at dawn and dusk, where warmth holds back the night tint
  because the garden's daylight is only about 0.2 then; greyer under cloud;
  rain streaks when it rains; a thinner mint veil (about 30%) by day. A reply
  without the light (an older server, or the war zone) keeps the original
  daylit veil. The war-zone dive is unchanged.
- Arrival: the colony page's cover is black with no words for three seconds
  (the war zone's rule), errors readable at once; the garden then fades in
  from black over 1.2 s through a layer that never catches input.
- Save and return to menu: the camera rises (the view zooms out by about a
  third) while the garden fades to black over 1.2 s, then the menu opens.
  Leaving by choice shows no reason. The host's own departure also ends its
  stream, possibly before the reply, so that event is ignored while leaving.
- A room that ends while the page is open (the host closed it, a server
  restart, an expired visit) fades the garden away over 2.2 s, then says why
  on black ("Your garden will be waiting." and the reason) and returns to the
  Continue menu after about four seconds, or at once on a click or key. The
  menu keeps the reason. A hidden tab waits until it is looked at again, so
  the farewell is never played unseen. Opening a closed garden's page shows
  the same card and returns as well.
- Reduced animation keeps all of this but without movement: no fade-in, an
  immediate black on leaving, the card at once.
- A fishing defect found by this pass's suite: a fight's recording ends at the
  simulation step that landed or lost the fish, but a hold changed between
  that step and the frame that noticed it was still sent, after the end, so
  the server refused the whole recording ("That reel was not recorded
  properly"). Such a hold cannot change the result; `finishedRecording` in
  `public/colony-fish.js` now leaves it out.

## Validation

8 November 2026, disposable saves and servers only.

- `pnpm typecheck` passes.
- Vitest, every colony file (19 files): 163 passed. New or changed:
  `spec/colony-pet-fishing.test.ts` (seeded fish per world; the fight is
  deterministic, a steady angler lands at least 9 of 12 fish and an idle one
  loses all; hook, replayed landing, idle and too-fast recordings lost, the
  fight times out, a full warehouse releases the fish), `spec/colonization.test.ts`
  (the parcel: everything by default, chosen amounts, every invalid order
  refused without change), `spec/colony-motion.test.ts` (a rendered worker
  takes each new activity), `spec/colony-rest.test.ts` (a turned bench's
  facing) and `spec/colonization-runtime.test.ts` (a real hook, recorded
  fight and landing through the server, retried on the odd lost fish).
- Playwright, every colony spec pinned to the E-cores: 56 passed on the first
  run. `tests/browser/colony-polish.spec.js` prints a bed and a lamp, opens
  the orbital post with every cargo at all of it, lowers one, launches and
  films the lift, the climb and the landing on desktop and phone.
  `tests/browser/colony-companion.spec.js` now plays the fight through the
  real controls (E on desktop, the reel button on a phone) and closes the
  catch card. An earlier run of the whole set failed only the companion spec,
  on the old "fish to share" wording and a real defect (Camp named new catches
  "Fish"); both were fixed before the run above.

- Second pass, after the machine loops, renaming and reduced-effects fade:
  typecheck passes; vitest, all 19 colony files, 164 passed (including
  renaming: cleaned names, any crew member, empty or long names refused
  without change); Playwright, every colony spec on the E-cores, 57 passed
  on the first run, including renaming through Camp and a reduced-effects
  trip whose pad is empty mid-flight ([reduced](testing/evidence/2026-11-08/colony-shuttle-away-reduced.png)).

- Third note, the switch: the first version (the system setting as the
  starting point) passed typecheck and every colony browser spec on the
  E-cores, 58 on the first run. After the author made full animation the
  default: typecheck passes, and the switch test now asks the browser for
  reduced motion and still finds the processor, bio plant, harvest outlet and
  sprinkler each moving (over 1% of their pixels within 0.4 s), presses the
  switch and finds them still, keeps that across a reload, then presses it
  again and finds them moving
  ([switch on](testing/evidence/2026-11-08/colony-reduced-switch-on.png)).
  Reduced-motion specs now press the switch through their fixture (a saved
  choice set before the first load). Every colony browser spec on the
  E-cores: 58 passed on the first run.

- Transitions pass: typecheck passes. Vitest over the colony, campaign and
  entry files: 227 of 228 passed; the one failure,
  `spec/campaign-mode.test.ts` "retains the shared save limit", predates this
  pass: it still expects the old shared limit, while the per-mode limit
  recorded on 8 November accepts a third peaceful expedition beside a war-zone
  save. It was left for its owner. New unit tests: the garden's arrival light
  and the descent grade (`spec/colony-ambience.test.ts`), the admission reply
  carrying it (`spec/colonization-runtime.test.ts`), and a hold after a
  fight's end left out (`spec/colony-pet-fishing.test.ts`). New browser spec
  `tests/browser/colony-transitions.spec.js`: the black cover and fade-in,
  Save and return fading out while the view zooms out with no reason kept,
  a room closed elsewhere fading away, naming its reason and returning to a
  menu that shows it (desktop and phone), a closed garden's page doing the
  same, and the descent measured mid-dive: a night garden's frame under 55%
  of a day garden's brightness and blue-leaning. Its first run had one
  failure at cleanup, not in an assertion: another Playwright run on this
  machine cleared `test-results` mid-run; with a private output folder all
  four passed. The first full colony and entry run (82) had three failures:
  the arrival spec counted the night grade's full-frame blended fill as a new
  frame and lost the shuttle (its frame start now requires a plain fill, as
  in the voyage spec), and the fishing defect above. After both fixes the
  affected specs passed 16 of 16. The second full colony and entry run: 81 of 82
  passed; the failure was flaky, not an assertion: Playwright's own fetch of
  `colony-art.js` during the switch test's reload was reset (ECONNRESET). That
  spec passed in both earlier runs and passed 4 of 4 when run again.
  ([night descent](testing/evidence/2026-11-08/colony-descent-night.png),
  [day descent](testing/evidence/2026-11-08/colony-descent-day.png),
  [room closed, phone](testing/evidence/2026-11-08/colony-room-closed-phone.png)).

Evidence: [print](testing/evidence/2026-11-08/colony-print-desktop.png),
[print, phone](testing/evidence/2026-11-08/colony-print-phone.png),
[parcel](testing/evidence/2026-11-08/colony-parcel-desktop.png),
[parcel, phone](testing/evidence/2026-11-08/colony-parcel-phone.png),
[lift](testing/evidence/2026-11-08/colony-shuttle-lift-desktop.png),
[climb](testing/evidence/2026-11-08/colony-shuttle-climb-desktop.png),
[landing, phone](testing/evidence/2026-11-08/colony-shuttle-landing-phone.png),
[fight](testing/evidence/2026-11-08/colony-fish-fight-desktop.png),
[catch card, phone](testing/evidence/2026-11-08/colony-catch-card-phone.png),
[seated, desktop](testing/evidence/2026-11-08/colony-rest-sit-desktop.png).

Known limits: fight tuning (ring size, fill and drain rates, the 30 s limit)
is provisional; a refreshed page mid-fight usually loses that fish; a paused
room during a fight makes the recording longer than the room clock, so the
fish is lost; fish cannot be shipped; the shuttle still flies one route on
every world; nothing here changes maps per planet, which remains for the
next refinement pass.

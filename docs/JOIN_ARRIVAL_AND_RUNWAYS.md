# Join arrival, room closure, dock visits and double runways

Stage record, 2 November 2026. Built locally from the author's requests of that day;
not deployed. This supersedes the older rules that Join plays no dive, that a dock
only returns its own ship, and that a new airbase is one 6 x 10 runway.

## What the author asked for

After the 2 November deploy the author asked for two berths per dock, two runways
per airbase and a 6 x 3 helipad, each still producing one vehicle, with R rotating
the long footprints. I recommended against the extra berth and the double helipad;
the author kept the double runway as necessary. The author then asked that Join
detect the host's planet, zoom in, bring the ship in from beyond the window as a
line that expands into the hull, and drop the pod from the top-down view of the new
design sheet with a flame ring (their sketch: gold inside red around a square marked
"top"). They also reported that when a host quits, a guest leaves without notice.

The same day the author checked the deployed site themselves and reported that even
the fastest bomber and Remote feel real time. That is the author's own judgement of
play on Fly, not a measurement of Fly capacity.

## Join arrival

`POST /api/campaigns/join` already admits the guest, so its reply now also carries
the room's planet template. No world data is read and the invitation stays
single-use. The scene then:

1. swings the host's world to the front (1.3 s; `view: arrival`);
2. brings a 3-pixel line in along the ship's heading from just beyond the frame edge,
   worked out from the actual viewport so it is visible for its whole 0.5 s run;
3. contracts it into the hull over 0.7 s with the nose fixed, so the ship ends exactly
   on the hover pose, and holds 0.3 s;
4. continues into the ordinary zoom, release and dive, already accepted.

Any input skips it and paused or reduced motion enters directly, as for the dive. It
adds 2.8 s, for 9.8 s in all. Joins to colony rooms keep their direct entry.

## Top-down pod

`public/assets/entry/cuculidae-pod-top.png` is the TOP view of the author's design
sheet, cut to its alpha bounds and scaled to 320 x 320; provenance is in
`cuculidae-pod-manifest.json`. Every dive now uses it, looking straight down. Two
rings of opaque tongues start on the square's edge, gold inside red. Opaque tongues
keep their colour over bright cloud, where additive flames washed out to salmon, and
the slow outline swells keep it a ring rather than a starburst. Embers run outward
with the air lines. The heat shield, comet tail and side view are gone.

## Room closure

The server already sent a `room-ended` event with a reason; the client ignored it and
jumped to the lobby. A player whose room closes now sees the reason in a dialog, with
Back to lobby and an 8 s timeout, and the lobby keeps the reason on screen until their
next action. An input that reaches the closed room first shows the server's general
message, and the event replaces it. Leaving by choice shows nothing. Unregistered
guests now get the same reason as members instead of "Guest visit ended". The 30 s
owner reconnect toast is unchanged. Colony rooms have their own handling.

### Leaving through black (9 November 2026)

The author asked whether the war zone could leave with the colony's zoom-out. Save
and leave room used to jump straight to the lobby. Now the camera rises (the view
zooms out by about a third) while the battlefield fades to black over 1.2 s, and the
lobby opens once the screen is fully black, with a fallback timer. Leaving by choice
still shows nothing. When a room closes under a player, the dialog with its reason
appears at once, as before. Behind it the battlefield zooms out and fades to black
over 2.2 s. That dialog's dim was lightened from 77% to 25% so the fade can be seen.
Back to lobby or the 8 s timeout then opens the lobby, which still keeps the reason.
The black layer sits above the battlefield and every notice. Only dialogs stay above
it. Reduced effects go straight to black, and a hidden tab leaves at once. Movement
input stops for the fade, and the room menu does not ask a closed room to unpause.

Checks: `tests/browser/room-arrival.spec.js` gained a test. The host's page
records every frame it draws while leaving, so a slow frame cannot hide the fade
between two polls. The test then asserts that the fade passes through mid-grey, that
the zoom drops, that the fade finished before the lobby opened, and that no reason is
kept. The guest, on a phone, must see the dialog and the battlefield fully black
behind it. On the E-cores the war-zone page drew about seven frames a second here.
The fade then reached only about 80% before a fixed timer opened the lobby, which is
why the lobby now waits for the fade to finish. The first version of the test sampled
opacity across separate calls and failed twice. First the host's window sat behind
the guest's and drew no frames, so the pages are now brought forward in turn. Then
it failed once more with no fade seen between polls, cause not captured, and the
per-frame record replaced the polls. Three repeated runs then passed, and all 23 tests in the 10 spec files that leave or close
a war-zone room passed in one run with no retries.
([leaving, desktop](testing/evidence/2026-11-09/war-zone-leave-desktop.png),
[room closed, phone](testing/evidence/2026-11-09/war-zone-room-closed-phone.png)).
The author has not played it yet.

## Dock visits

RMB in Remote on a dock or its berth now moors there, and the map cursor reads MOOR.
Touch does the same in Move mode. The server admits any intact, finished friendly
dock whose berth is free, and refuses one a ship is already sailing to. Large hulls
cannot use legacy berths. Saved orders follow the dock they were given, and a visit
changes no assignment: R still returns home. Dock services already worked for any
moored ship. No new key, dock shape or save field beyond the existing order.

## Double runway

A new airbase saves `runways: 2`, and `turned`/`angle` if R turned it. It is 6 x 20,
or 20 x 6 turned, two whole strips end to end, each with its hangar. Older bases have
neither field and are unchanged in every coordinate.

- The second strip is a landing field, built the way a carrier's second deck is:
  `airfields()` yields it with the id `<base>:2`, and aircraft reach it through their
  existing movable `baseId`.
- One base still supplies one aircraft. `fleetCapacity` skips the spare strip, and
  delivery refuses it. Clicking anywhere on a base orders onto the first strip.
- The strips share one health pool. One 2 x 13 damage box runs through both hangars,
  so a blast between them hits the base once, and destruction closes both.
- A landing aircraft takes the nearest free strip. A visitor on the first strip blocks
  new aircraft there until it leaves, with the existing message.
- An orbital crate opens only its two long walls, 18 x 20 and 360 tiles. Four walls
  would need a clear cross 60 tiles long against 30 before.
- R, or the Turn button for touch, turns the placement; the choice stays for the next
  base. Local builds need the whole footprint within the 24-tile support circle.

Helipads stay 3 x 3: helicopters can already land on clear ground and eight pads are
allowed, so the author accepted waiting until the double airbase has been played.

## Checks and limits

Nothing here has been played by the author yet. The two-wall crate and the 2.8 s warp
are provisional.

Fit was measured, not assumed. On freshly generated planets, sampling every third
tile for an orbital delivery with no player construction:

| Planet | Old 6 x 10 | New upright | New turned | New, either way |
| --- | --- | --- | --- | --- |
| Caldera | 3,795 | 3,638 | 3,661 | 4,313 |
| Vesper | 405 | 325 | 306 | 476 |
| Sirocco | 2,359 | 2,505 | 2,569 | 3,496 |

The base is longer, but the smaller crate and R together leave more valid sites than
before on all three planets. Local builds inside the 24-tile support circle were not
measured, and a real campaign has less free land than a fresh planet.

The full browser suite ran once on the E-cores with no retries, colony specs
excluded: 288 of 307 passed. Seventeen of the 19 failures were this stage's own. Four
tests expected Join to enter directly, and 13 expected the lobby straight after a host
left. Both behaviours changed on purpose, so those tests now pass through
`tests/browser/room-helper.js`, which skips the arrival once the server has admitted
the guest and dismisses the room notice. That asserts the notice appears, which the old
redirect check could not. All 17 then passed, as did the three new room tests and the
42 colony tests. The full suite was not repeated, since only test files changed.

The other two failures are `tests/browser/entry.spec.js` "the pod waits for admission",
and this stage did not cause them: a clean export of the deployed commit fails the same
way. Frames stop once just after the black cover starts to lift, with no JavaScript
running and no long task reported. Chrome was on the real GPU, so this is not software
drawing. The gap follows CPU speed: 570 to 660 ms in a real window on all cores, about
1 to 1.2 s on the E-cores. The test needs one opacity sample between 25% and 75%, and on
the E-cores the gap can cover that whole stretch. It failed 12 of 12 repeated alone
there, yet passed 2 of 2 inside a mixed run. On all cores it passed all 4 runs that
reached it. A fifth died before the test began, to the machine's known Node worker
crash, and a sixth did not run. What the work is remains unknown, and frame gaps do not
show what reached the screen, so whether a player sees a stutter in the fade is
unmeasured. The test was left as it is, so a full E-core run should be expected to
report these two.

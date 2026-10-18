# Planet expansion and campaign globe

18 October 2026. Implemented locally. The author selected a larger seamless
battlefield plus a globe overview first; spherical travel remains a later stage.

## Player experience

The saved battlefield is now **512 by 384 tiles**, sixteen times the area of the
128 by 96 field. Every original terrain cell remains at its existing coordinate.
New continents, islands, broad building plains and open sea give airfields,
shipyards, carriers and remote bases room to operate. New regions are expansion
space; this stage does not distribute more hostile sites across the planet or
increase any population, facility, vehicle or player cap.

Press **N** or **PLANET** for the actual campaign globe. Drag to rotate, use the
arrow buttons/keys, or choose a named region. Click/tap its surface or choose
View surface to move the ground camera there. **C** returns to the player and
**M** retains the flat tactical overview. The globe uses saved terrain with
surveyed hostile sites, conquered sites, friendly bases and crew markers.
There is a shaded limb and atmosphere, with no automatic spinning.

Opening the globe stops local firing/movement input; its arrows do not steer
the player's vehicle. Multiplayer simulation and committed attacks continue.
The globe moves the camera only: it never teleports units or changes ownership.
Ground combat stays overhead 2D. **Map edges remain closed.** The spherical
projection is an overview, not an implementation of spherical navigation.

Orbital strike planning opens a readable 128 by 96 regional view around the
current camera (or an accepted strike), rather than shrinking every target to
a planet-wide pixel. Changing payload keeps that view. Pan/zoom or inspect a
distant region on the globe before opening strikes. First-strike timing retains
the original map's starting reference; accepted strike delays are untouched.

## Save and runtime boundaries

- `public/planet-world.js` adds deterministic v2-to-v3 terrain expansion after
  the existing v1-to-v2 extension. Existing coordinates, fronts and structures
  are preserved. Loading v3 again does nothing.
- Before migration, SQLite makes a full `backups/before-planet-v3-*.sqlite`
  backup. The terrain update and `logistics.floors` index conversion commit in
  one transaction. Original metadata is also kept in `world-before-expansion-v3`.
  A named campaign migrates when its runtime next opens. No world reset is needed.
- Floor indices use the saved old row width and the new 512-tile row width.
  Balances, conquest/checkpoint data, buildings and equipment are not regenerated.
- Static terrain arrives at initial load. Live SSE still contains dynamic state,
  with no terrain array. Existing visible 16-by-16 terrain chunks stay bounded
  to 32 cached chunks; the low-resolution whole-map canvas supports distant zoom.
- The globe uses a bounded 320-by-320 software texture and 640-by-640 overlay
  canvas. Rendering happens on interaction, with live marker refresh at most
  twice a second. Ground painting pauses behind the modal; server simulation
  does not. No new server-side visual effects or geographic simulation.
- Lobby planet art previews the expanded template. The in-game globe reads the
  current campaign, including saved progress, rather than that lobby template.

## Verification

Automated coverage includes old terrain preservation, repeat loading, complete
backup contents, reclaimed floor conversion, unchanged construction and saved
checkpoint records, projection/picking across hemispheres, new airbase plains,
usable shipyard coast, and the original causeway's path connectivity.

A named-room integration case builds on two distant continents, checks both
clients receive both buildings through terrain-free SSE, and reopens the save.
Browser cases exercise desktop 1920 by 1080, phone 390 by 844, resize, keyboard,
drag rotation, touch picking, escape and camera-only navigation. Screenshots are
inspected locally; deployment pricing and all four orbital payloads are checked
alongside the map changes. Browser probes return dynamic state instead of copying
the full enlarged terrain into every Playwright trace polling result.

Local Node 26.5.1 / Windows measurements (single samples, not capacity guarantees):

| Probe | Previous field | Expanded field |
| --- | ---: | ---: |
| Terrain generation | 3.92 ms | 85.46 ms |
| Serialized base-world metadata | 25,158 bytes | 394,321 bytes |
| Original 54-step causeway route | 6.45 ms | 4.25 ms |

A failed route between disconnected new continents took 31.19 ms in the same
terrain-only probe. A separate fresh server with four idle connected clients
started in 126 ms and used about 103 MiB RSS; its initial response was 397,341
bytes and its live snapshot 2,591 bytes, with zero logged >100 ms simulation
ticks during a three-second sample. This is an idle smoke check, **not** a
populated combat benchmark or proof that all campaigns fit on Fly. The Fly
configuration remains one shared CPU / 256 MB. Profile simultaneous populated
fronts before expanding entity caps or changing that configuration.

## Next boundary

Populate and balance additional fronts separately. Before allowing travel
across map edges, explicitly define topology, poles, distance/range rules,
heading, collision, saved seats and incoming attacks at seams. East/west wrapping
alone is not a complete spherical world. No continuous spherical travel,
planet-wide victory condition, extra hostile roster or deployment is part of
this stage.

Final local checks: `pnpm typecheck` passed; `pnpm test` passed all 425 tests
across 63 files. Eleven planet/orbital browser cases and two deployment-funding
cases passed; the two planet cases were rerun after the final control changes.
Desktop and phone screenshots were visually inspected. No commit, push or Fly
deployment was performed for this stage.

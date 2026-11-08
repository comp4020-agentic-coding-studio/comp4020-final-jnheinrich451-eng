# Colonization activity audio

Implemented locally on 9 November 2026 from the author's 52 ElevenLabs WAVs.
The source prompts and variation inventory live in the single
[generation record](../soundeffect/GENERATION.md#colonization-effects-9-november-2026).
Original WAVs and existing War Zone exports are preserved.

## Playback

The colony has 24 cue types. Spider footsteps alternate 01/02; nine four-take
groups choose randomly without immediately repeating a take. Selection happens
only when a voice actually starts, so discarded distant or muted events do not
skip audible footsteps. Eight continuous beds each use one supplied loop.

| Activity | Timing |
| --- | --- |
| Spider | Actual moving strides, new curious/happy/purr reactions, and a feeding counter increase; feeding chooses eating instead of stacking reactions |
| Fishing | Accepted cast/recast and new bite; reel while held; catch/escape after the local server-confirmed landing result |
| Construction | Printer loop during printing, then one cue at the visual reveal; no change to when a building becomes usable |
| Facilities | Useful processing, harvesting machinery, bio-generation and active irrigation; idle/blocked work stays quiet |
| Collection | Confirmed local harvest or manual crate collection |
| Warehouse drone | Hover during outbound/return flight, latch when a crate attaches, unload when carried cargo is deposited; empty returns have no cargo cue |
| Shuttle | Ignition once, belly/main-engine loops following their respective flight intensities, touchdown once at pad contact |

State observation uses active room seconds. Initial snapshots, reconnects,
region changes and stale gaps establish a baseline without replaying old events.
Pause, disconnect, hidden tabs, departure and mute stop voices. Continuous world
sounds expire if snapshots stop advancing. Each browser mixes nearby sources
around its camera, with horizontal stereo positioning; the local fishing bite,
reel and result remain clear and centered.

The Crew menu has effects mute/volume and the view toolbar has a quick toggle.
They share `frontier-sound` preferences with War Zone. Music and cinema retain
their own controls. Audio starts after a browser gesture. A failed Ogg request
or decode retries the corresponding PCM WAV; a remaining error identifies the
file and can be retried by toggling effects off/on. The mixer connects through
its limiter to the actual audio destination.

At most four continuous layers and sixteen total sources play together, with
quiet machinery below reactions. One-shots keep their natural tails, subject to
the bounded source budget and per-emitter limits. This initial balance still
needs the author's listening review.

## Assets and checks

`public/colony-sound-catalog.js` contains roles and variant selection;
`public/colony-sound-events.js` observes state transitions; `public/colony-sound.js`
loads and mixes the colony palette. `public/colony-app.js` supplies snapshots
and accepted local actions; `public/colony-fishing-ui.js` exposes held reel state.
Run `node scripts/prepare-sound-effects.mjs --colony` to rebuild only the colony
exports. `public/audio/effects/colony/manifest.json` records hashes, durations,
loop preparation and encoder information. No save migration is involved.

Validation on 9 November 2026:

- 53 focused tests passed across colony event/variant, pet/fishing, crate,
  combat/world-audio and invariant suites. TypeScript and process-evidence checks
  passed. Source/export comparison confirmed 259 prior files unchanged; all
  existing generation prompt rows and the original supplied text are unchanged.
- Two native mixer browser tests passed: all 52 Oggs decoded on desktop and
  deliberately invalid Oggs recovered through all 52 PCM fallbacks on phone.
  Speaker-path peaks were 0.19808 and 0.03653. Checks covered alternating steps,
  random non-repetition, loop output after a complete period without restarting,
  spatial movement, four-layer/sixteen-source limits and lifecycle cleanup,
  including held reeling with a frozen snapshot clock.
- Two real-app browser tests passed on their first run at 1920 x 1080 and
  390 x 844. Actual UI actions covered manual collection, fishing cast/bite,
  held/released reel and confirmed outcome, pet feeding/purring, walking strides,
  warehouse flight, mute/music independence and persisted volume. Speaker-path
  peaks were 0.02623 and 0.02357. No page errors occurred. Inspected
  [desktop](testing/evidence/2026-11-09/colony-audio-desktop.png) and
  [phone](testing/evidence/2026-11-09/colony-audio-phone.png) captures show the Crew
  controls contained in their viewports.

The initial mixer desktop test had a flaky gain comparison: it measured the
baseline during fade-in and compared it with a later steady level. The check
now samples after a full loop period. The unused default test server also hung
during teardown; the successful focused browser runs omitted that extra server
because each fixture already owns an isolated one. No user save or running
game server was changed. Logs: `.local/colony-sound-domain.log`,
`.local/colony-sound-mixer-browser-fixed.log`, and
`.local/colony-sound-app-browser.log`. The real-app PowerShell wrapper reported
a redirected Node color-warning error, while Playwright's summary and result
JSON both recorded two passed tests with no failures.

These checks verify playback routing and behavior. Subjective loudness, timbre
and the author's own browser playback remain listening-review work.

# Colony atmosphere, campfires and cinema

2 November 2026. The author asks for animation on irrigators, bonfires, rain and
other colony visuals, and supplies `video/BigBuckBunny_320x180.mp4` for the outdoor
screen. After the inspection/design pass, the author approved implementation
so they can see the result and refine it through play. This record now describes
that first local visual stage. Industry, fishing, ponds, a cabin, terrain editing
and progression remain deferred to the broader colony plan.

## Implemented stage

The Camp tool places up to four campfires and one cinema for no materials in
this visual playtest stage. Placement checks the clear footprint, workers,
existing equipment and essential route access. Campfires can be lit or put out;
decorations can be removed. Existing terrain and saved garden layouts remain
intact; no camp is silently inserted into a developer save.

Daylight follows a 24-minute cycle; seeded natural weather uses six-minute
slots and smooth transitions. The authoritative expedition time drives both.
Host and guests see the same time/weather, including on late entry and reconnect.
The host can select Natural, Sunrise, Day, Sunset or Night, and Natural, Clear,
Cloudy or Rain, to inspect the visuals without waiting through a complete cycle.
These presets change atmosphere only: they do not advance growth, shipments or
movie playback. Rain is visual in this stage and does not yet water crops.

The renderer adds gradual lighting, clouds/rain, animated fire with light,
embers/smoke, cinema frames and improved irrigation arcs/splashes. Reduced
animation keeps shared conditions while simplifying particles and flicker;
robot movement remains smooth. The new equipment retains the colony's white
mechanical framing and warm illustrated surroundings.

The movie screen uses shared server play/pause/restart state on the active
expedition clock. The film stops at its actual end, keeping the complete credits.
Each viewer begins muted and can enable personal sound. The client loads one
decoder on demand, pauses it when hidden, offscreen or disconnected, and seeks
to the shared position on return. Room pause freezes the common timeline.

Local checks passed: 41 focused domain/runtime/media/projection/invariant tests,
TypeScript and nine integrated Chrome browser tests. These include desktop and
phone Camp controls, shared atmosphere/movie state, host reconnect, smooth
movement and the existing plant/water/harvest/ship loop. No real saves were used
or reset. This stage has not been deployed.

To review it, open a colony and choose **Camp** on the bottom toolbar. Place a
bonfire or screen on clear ground. **Atmosphere** lets the host preview light and
weather immediately; choose Natural to resume the ordinary cycle. **Play film**
is shared, while **Sound on** affects only the current viewer.

## Existing animation

The current irrigator in `public/colony-art.js` already rotates its two arms and
draws moving water droplets. Plants sway, the shuttle animates during orbital
deliveries, harvests have short visual bursts, and the tracked worker has rolling
treads and light suspension. The animation setting simplifies cosmetics while
worker movement remains smooth.

The broader plan is in `COLONY_INDUSTRY_PROPOSAL.md`. The table below distinguishes
the current visual stage from future fishing/industry animation.

## Animation vocabulary

| Element | Visible motion | State and accessibility |
| --- | --- | --- |
| Irrigator | Sweeping nozzle, water arcs and small ground splashes | Refines the existing animation without changing irrigation reach. |
| Bonfire | Layered changing flame shapes, gentle warm glow, a few rising embers and soft smoke | Local bounded effects around a shared placed campfire. Reduced mode keeps a steady flame and glow. No spreading fire. |
| Rain | Short slanted streaks, occasional water ripples and a softer scene palette | Shared weather/intensity controls whether rain exists. Individual particles are cosmetic. Reduced mode keeps the rain tint/state but greatly reduces or removes streaks. |
| Day/night | Gradual sunrise and sunset color, readable blue night, warm windows and lamps | Follow the expedition's saved server timeline; never a separate guest/device clock. UI readability does not follow scene darkness. |
| Pond and fishing — deferred | Water glints, float bobbing, a bite ripple, casting and reeling | Future server-decided bite/catch; cosmetic motion must not award fish. |
| Industry — deferred | Moving belts/crates, a small processor mechanism and working lights | Future actual transport/processing controls the animation. |
| Outdoor screen | Actual decoded movie frames and a restrained light spill near the screen | Shared playback position, personal audio/mute, and on-demand loading. Credits remain part of the film. |

Animation should communicate what a machine is doing and make leisure spaces
pleasant. Avoid making every decorative piece move constantly. Keep machinery
bases and scenery cached; animate only the changing parts. Limit particle counts
and visible light sources, draw only visible effects, and stop unnecessary media
decoding for hidden/offscreen views. A returning viewer seeks to the shared
playback position rather than slowing the room's movie to match their device.

The host's expedition server owns weather, daylight, activity states and movie
playback timing. Clients interpolate visuals between updates; droplets, flames
and embers do not require per-particle network traffic. On reconnect, current
authoritative state replaces stale guest state. Preserve the existing reduced
animation preference and smooth movement.

## Supplied movie

The author confirmed the source as Blender's official
[movie directory](https://download.blender.org/peach/bigbuckbunny_movies/).
The original local file has not been edited or moved.

| Property | Inspected value |
| --- | --- |
| File | `video/BigBuckBunny_320x180.mp4` |
| Resolution | 320 x 180, 16:9 |
| Duration | 596.458333 seconds, approximately 9 minutes 56 seconds |
| Size | 64,657,027 bytes, approximately 64.7 MB |
| Video | H.264, `avc1.42c00d` |
| Audio | AAC-LC, `mp4a.40.2`, stereo, 48 kHz |
| Browser check | Local Chrome played and sought successfully with no page/media errors |
| Samples | 5, 45, 400, 560 and 590 seconds; credits observed at 560 seconds |

The film is now copied byte-for-byte to
`public/assets/colony-cinema/big-buck-bunny.mp4`, which is included by the existing
Docker public-assets copy. The original remains in `video/`, which stays excluded
from the build context. The opening page does not load the movie. Its MP4 index
follows the payload; the server now streams MP4 byte ranges instead of reading
the full file into memory. HEAD, suffix/open-ended/clamped ranges, invalid-range
responses and disconnect cleanup are covered by the focused media test.

The source hash, codec details, attribution and validation scope are retained
in [the asset record](../video/BigBuckBunny_320x180.asset.json). Test helpers and
sample frames are local under `.local/colony-movie-check/`; no real saves were
used. This was a sampled technical check, not full viewing or hosted/browser-wide
compatibility certification.

## Credits

Blender's [project license page](https://peach.blender.org/about/) identifies
the movie under [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/).
Its full-film screening instruction retains the entire ending credits. The
screen shows title/creator/license information in its inspector and lets the
film finish its existing credits. Runtime asset credits and the license notice
are included alongside the copied movie.

Suggested credit:

> Big Buck Bunny — Copyright 2008, Blender Foundation / www.bigbuckbunny.org.
> Licensed under Creative Commons Attribution 3.0.

Link the creator/source and license with that credit. If a later derived copy
is remuxed, compressed or excerpted, record the change and keep the original
source. This stage makes a local runtime copy and adds media serving/control;
it has not been deployed or published.

## Media validation

- The focused `spec/colony-media.test.ts` HTTP check passed: HEAD with no body,
  bounded exact/suffix/open-ended/clamped ranges and matching bytes, rejected
  invalid/multiple ranges, aborted full request and a subsequent successful
  request, and accessible credits.
- A local real-Chrome controller check passed: no download while offscreen or
  inactive; muted playback; shared pause position; offscreen pause; return seek;
  personal audio toggle; credit-frame decoding; and disposal. No page/media errors.
- The runtime copy's SHA-256 matches the inspected source. TypeScript passed
  at the media-check checkpoint. Only disposable fixtures were used.

[Controller evidence](testing/evidence/2026-11-02/colony-cinema-validation.json),
[decoded credits](testing/evidence/2026-11-02/colony-cinema-credits.png).
These are local media results, not hosted capacity measurements.

## Integrated validation

- `spec/colony-ambience.test.ts`, `spec/colonization.test.ts`,
  `spec/colonization-runtime.test.ts` and `spec/colony-motion.test.ts`: 35 passed.
  Coverage includes deterministic weather variety, read-only legacy defaults,
  placement/route/worker checks, limits, stale commands, host-only atmosphere,
  movie ending, durable state and late joining.
- `spec/invariants.test.ts`, `spec/colony-media.test.ts` and
  `spec/colony-view.test.ts`: six passed. TypeScript passed afterward.
- `tests/browser/colony-ambience.spec.js`, `colony-motion.spec.js`,
  `colony-view.spec.js` and `colony.spec.js`: nine passed in local Chrome. The
  new tests exercise actual Camp placement and controls, personal sound,
  synchronized play/pause, host absence/reconnect and a narrow reduced-motion
  viewport. Existing tests cover smooth local/peer movement, Esc, projected
  placement, mobile input and a complete crop/delivery cycle.
- Desktop/phone screenshots were inspected. Fixed reduced-motion renderer
  frames match. Localhost serves the updated Camp page and range-capable film.

The synthetic maximum-garden renderer comparison includes 16 beds, eight
sprinklers, four workers, four fires and a cinema in night/rain. Desktop mean
draw time changed from 3.02 to 3.21 ms (p95 4.0 to 4.3); phone-sized emulation
changed from 2.57 to 2.72 ms (p95 3.6 to 3.7). This is a local renderer comparison,
excluding video decoding/networking, not a real-phone FPS or hosted capacity claim.

[Integrated evidence](testing/evidence/2026-11-02/colony-ambience-integration.json),
[night cinema](testing/evidence/2026-11-02/colony-ambience-gameplay-night-rain.png),
[phone Camp controls](testing/evidence/2026-11-02/colony-ambience-gameplay-phone-controls.png),
[renderer comparison](testing/evidence/2026-11-02/colony-render-ambience-current.json).

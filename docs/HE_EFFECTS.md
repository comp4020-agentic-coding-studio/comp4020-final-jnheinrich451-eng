# HE impact and crawler feedback

Date: 2026-10-01. Scope: the user approved the first HE/monster feedback step and
asked what visual weight is possible under the resource budget. This is an
implementation record, not the author's personal playtesting reflection.

## Implemented behavior

- Both player cannons and sentries now fire HE. One impact produces one radial
  damage event. Radius: 2.1 tiles; damage: 75 inside 0.65 tiles, falling to 12 at
  the edge. Crawlers have 60 health. The aiming circle previews the radius.
  These are first-pass tuning values, not a settled balance specification.
- Rocks stop the projectile; this first blast model has no terrain occlusion.
  Only hostile entities receive blast damage. Friendly structures/scouts and
  the landing-pad objective are excluded from weapon damage.
- The temporary enemy is a procedural red, two-headed, six-limbed crawler with
  an animated stride. Speed increased from 0.65 to 1.1 tiles/second. It still
  attacks the pad; personal health/death is a subsequent stage.
- Browser feedback: muzzle flash, barrel recoil, short pressure ring, hot flash,
  ballistic debris, softer dust/smoke, near-hit reaction, purple flecks and a
  collapsing death trace. Optional local camera shake is capped at three pixels.
- Follow-up visual refinement: angular gold/orange/red hot shards, short trails
  and cooling colors replace part of the existing debris allocation. Particle
  caps and server behavior are unchanged; there is no separate fragment damage.
- Craters and remains are cosmetic and bounded to 48 combined marks per server
  session. They are shared in snapshots, including on reload, but are not written
  into SQLite. Existing world terrain, positions and buildings remain intact.
- Reduced effects uses fewer particles and weaker flashes and disables shake.
  It defaults on when the OS requests reduced motion. Explicit effects and shake
  preferences are saved in browser storage when available. No audio is added.

## Resource design

The server computes trajectories, a single blast, and deaths. It sends small
shot/impact records; browsers synthesize particles and shading from them.
Repeated snapshots are deduplicated so one blast cannot create fresh particles
on every network update. A server-session identifier clears old client event IDs
after restart. Presentation does not determine damage.

- Maximum 64 live shells, 64 recent shot records and 64 recent impact records.
- 48 cosmetic marks shared across craters and remains.
- Full client mode: at most ten active bursts with 24 debris/dust particles each.
  Reduced mode: four bursts with ten particles each. Flashes and hit flecks are
  separately bounded by these burst counts; these numbers are not a total draw
  call count. Burst lifetime is 1.6 seconds; muzzle lifetime is 0.25 seconds.
- Small reusable canvas sprites supply smoke gradients and crater textures.
  No new downloads, runtime packages, generated image assets or sound files.

This creates weight through timing, motion and contrast. It remains stylized 2D
art, not photorealistic fire or a physically simulated explosion.

## Validation

- `pnpm check`: TypeScript and nine tests in four files pass. New checks cover
  lethal-center/falloff behavior, a non-contact blast hit, no repeated damage,
  bounded cosmetic marks, unmodified terrain and expiry of transient events.
- `pnpm test:browser`: four Chrome tests pass, including shared shell/damage,
  construction/reload, keyboard/touch, screen sizing, effect deduplication and
  persisted reduced-effect preferences. The tests use isolated saves.
- Actual browser captures: [impact](previews/he-impact.png),
  [dust](previews/he-dust.png), [crater](previews/he-crater.png),
  [phone](previews/he-mobile.png). Screenshots were visually inspected.
- Docker image builds with Node 24.21.0. Resource results are recorded below.

## Resource measurement

The script `scripts/check-he-runtime.mjs` requires `ISOLATED_TEST=1`; never point it at a user's world. It
creates four guests, moves them and fires repeatedly while restarting the small
drill. It measures local HTTP timings and received SSE bytes, not visual frame
rate or internet end-to-end latency.

The 60.01-second run used a fresh Docker container with no user-save mount:
256 MiB memory, no extra swap, CPU quota 5000 microseconds per 80000 microseconds.
Four simulated guests sent 1,575 action requests, fired 300 shells and restarted
75 short three-crawler drills. All 300 blasts were observed. Median action HTTP
response: 32.86 ms; p95: 79.27 ms. The largest SSE snapshot was 7,417 bytes, with
25,237,028 bytes received across all four streams. Marks reached the cap of 48.

The container cgroup reported memory.peak=33,841,152 bytes (32.27 MiB) against
memory.max=268,435,456 bytes. OOMKilled=false. CPU counters after the run reported
76 throttled periods and 4,917,914 microseconds throttled. These counters include
startup and the short inspection period, not solely the timed workload.

This is a bounded, short-wave combat measurement, not proof of larger battles,
Fly internet latency or phone frame rate. Container memory excludes browser
graphics and the VM's full operating-system overhead. The shared CPU quota is
a local approximation; it does not reproduce Fly's burst balance or neighbours.
The previous exploration memory sample used a different measurement method and
should not be subtracted from this cgroup peak to estimate the cost of effects.

## Next review

Try a direct hit, a near miss, a crowded approach and empty-ground bombardment.
Assess whether the flash-to-dust sequence and monster reaction read clearly at
the normal zoom. Sound, authored enemy art, player survival, incendiary and gas
can then be developed as separate steps. Do not infer large-battle capacity from
this bounded first drill.

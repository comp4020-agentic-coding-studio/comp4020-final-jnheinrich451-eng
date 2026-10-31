# Air-only sentry and co-op rehearsal — 31 October 2026

The author approved completing the stationary AA sentry and a co-op combat
playtest in one stage, with one explicit balance correction: this sentry must
never attack ground enemies. The earlier suggestion of a ground fallback is
superseded. Its two barrels follow the mobile AA's visual and firing language.

## Playable behavior

- Deploy **AA sentry / G-05** from **B → Ground** (fifth card).
- **80 ORB** for orbital delivery, or **20 GND** for 60-second local construction
  inside completed friendly support. A one-tile mount uses the ordinary sentry's
  five-tile unfolded orbital pod; local construction occupies the mount only.
- **140 HP**, **26-tile range**, automatic airborne target tracking with actual
  turret traverse and movement lead. Mountains block fire; low cover does not.
- Two 35 mm barrels alternate **one 20-damage round every 125 ms**, sharing the
  existing 64-projectile/charge budget. No ground acquisition, ground damage,
  secondary weapon, manual firing or mode conversion is offered.
- Construction and destroyed mounts cannot fire. A released round continues
  independently; destroyed targets cannot receive duplicate hits on restart.
- Existing APCR/fuel sentries and core guns retain their own roles. Ground
  enemies can damage the AA sentry, so it benefits from ground-defense cover.
  Mantas still target robots/ground vehicles, not actual facilities or aircraft.

The fixed AA protects nearby ground crews. The mobile AA still has mobility,
200 HP and a ground machine gun. The robot laser remains a basic air counter.
These initial prices and stats are a playable starting point, not an established
balance conclusion from the author's own play.

## Saves, controls and presentation

Placement, payment, construction job and fixed AA equipment save in one SQLite
transaction. Existing building rows keep their schema; equipment identifies the
AA subtype, and snapshots expose `kind: aa-sentry`. Old sentries are unchanged.
The server rejects weapon changes for AA sentries and rejects AA35 conversion
requests on ordinary sentries. The placement preview includes ground occupants.

The saved mount stores its turret bearing, target, next barrel and reload
deadline. Transient stream continuity is not restored: pause, restart or a long
tick never produces an accumulated burst. The 100 ms simulation tick schedules
125 ms shots with at most two rounds caught up per tick. Sentry fire appears in
the existing automatic-weapon activity logs with cause `aa_sentry_targeting`.

Ground construction and orbital unfolding use their existing effects. The
renderer adds a fixed mounting pad, radar and two long independently recoiling
barrels. Muzzle flashes and clipped tracers reuse the bounded mobile-AA effects.
Selecting the finished structure identifies its air-only role; its weapon
selector is hidden. Destruction uses the existing sentry ruin and returns half
the actual paid amount as raw salvage (40 after ORB, 10 after GND construction).

## Verification and playtest scope

Local validation on 31 October 2026:

- `pnpm check`: TypeScript and **1,049 tests in 131 files passed**. Focused AA
  cases cover air-only collision/targeting, mountains, construction, destruction,
  alternating fire, shared projectile limits, payment, salvage and persistence.
- `tests/browser/aa-coop.spec.js` passed with separate authenticated desktop
  (1920 x 1080) and emulated touch-phone (390 x 844) identities in a disposable
  named campaign. The commander deployed G-05 through the real catalogue while
  the peer drove and fired mobile AA. Both clients received matching damage,
  shots and remains: **89 matching snapshots**, **19 observed sentry shot IDs,
  all air-only**, and zero browser errors. Two nearby ground enemies remained at
  60 HP before manual vehicle fire. Four distinct manta warnings and seven bile
  projectiles were observed with normal unit HP/damage.
- Same-island pressure recorded **1.7x for two players**. Closing the firing
  player's tab stopped held fire; returning did not replay it. Owner departure
  paused the room, and reopening the local server/campaign preserved the AA
  sentry identity and fixed weapon. Existing pressure and multiplayer lifecycle
  browser cases also passed (2/2).
- Build click to the peer's snapshot was **179 ms in one local sample**. This
  is not a latency guarantee. Initial contacts/terrain were staged, so this test
  does not establish natural encounter frequency or human gameplay balance.

The load probe ran eight generated Caldera/Vesper scenarios: 1, 2 and 4 players
on a shared island, plus 2 on separate islands, for 180 simulated seconds each
after 10 seconds of warmup. Every tick retained 24 enemies including four mantas,
with eight AA sentries and one firing AA vehicle per player. Enemy HP was boosted
and defenders replenished to sustain that load. On the local i9-14900K:

| Measurement | Observed across eight scenarios |
| --- | --- |
| Combat tick p95 | 2.397–5.409 ms |
| Worst combat tick | 9.902 ms |
| Maximum active projectile count | 22 of the shared 64 cap |
| Snapshot creation p95 | At most 1.788 ms |
| Snapshot JSON encoding p95 | At most 0.919 ms |
| Sampled process RSS peak | At most 259.266 MiB |

Timing excludes HTTP/SSE, browser rendering, database and disk writes; snapshot
and checkpoint work were measured separately. This synthetic probe is not a
Fly capacity result or a memory leak test. In particular, its process RSS cannot
establish headroom on Fly's 256 MB machine. Local Chrome animation intervals
include loading/screenshots and are not physical-phone FPS measurements.

Reproduce the load probe with
`node --expose-gc scripts/aa-combat-benchmark.mjs --output .local/aa-combat-load.json`.
The automated browser test uses disposable data; it never resets a player save.

Evidence: [co-op observations](testing/evidence/2026-10-31/aa-coop.json),
[load measurements and scope](testing/evidence/2026-10-31/aa-combat-load.json),
[placement preview](testing/evidence/2026-10-31/aa-sentry-placement-desktop.png),
[desktop combat](testing/evidence/2026-10-31/aa-coop-desktop.png) and
[phone combat](testing/evidence/2026-10-31/aa-coop-phone.png).

The Fly deployment checked during this stage does not contain the mobile-AA,
skimmer or new AA-sentry modules (all three module requests returned 404).
These results are local automated checks, not independent human playtesting or
deployed Fly results. Release and a live AA rehearsal remain separate steps.

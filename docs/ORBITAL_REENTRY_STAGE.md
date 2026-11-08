# Re-entry from orbit

## Brief: author's request, 9 November 2026

The author asked for the descent trails of orbital strikes and drop pods to look
more real, for both facilities and the robot. Agreed decisions:

- **Retro burn:** apply it only if it looks good.
- **Smoke:** use the realistic long linger.
- **Menu entry dive:** stays out of this stage.

This is presentation only. It was built and checked locally. The author has not
yet playtested it, and it is not deployed.

## What was there before

- **Descent curves:** each of the eight arrival sites had its own copy of one
  falling curve, accelerating into a hard impact. The sites are core and tank
  pods, facility crates, rail crates, construction capsules, aircraft capsules,
  dock pods and the robot replacement pod.
- **Directions:** cores came from the upper right and the robot pod from the
  upper left.
- **Trails:** only some sites drew one, a short fixed streak. Facility crates
  drew none.
- **Strike shells:** a thin cream line, visible for the last 1.1 s.

## What the player sees now

**One orbit per planet.** Every arrival and every strike shell comes in along
the same ground track for a given planet. The track is fixed per world, going
east or west within 40 degrees. Height reads as an upward screen offset, as
everywhere else on this battlefield. A barrage is a set of parallel streaks
from one direction.

**Capsules brake.** This covers cores, tank pods, facility and rail crates,
construction and aircraft capsules, dock pods and the robot replacement pod.

1. A capsule enters wrapped in plasma: a white-hot leading glow, an
   orange-pink sheath and a broad glowing wake.
2. The plasma dies as it slows, leaving a grey smoke trail.
3. From 80% of the descent its retro rockets fire. From above, the flame is
   mostly hidden beneath the body, as it would be. What shows is its light on
   the ground and a ring of dust blown outward just before contact.
4. Contact is soft, but the existing impact dust, unfolding and camera shake
   still play at their saved times.

**Shells don't brake.** Strike shells (HE, incendiary, gas, heavy, barrage and
cluster) stay hypersonic all the way down:

- **Plasma:** stays on to the ground and brightens in the denser air near it.
- **Ground light:** the approaching fire lights the ground under it.
- **Heavy bomb:** a larger sheath, visible for 3 s instead of 2.
- **Cluster:** the casing opens at altitude 0.55 s before its own impact, with a
  flash. The bomblets fan out on thin trails and reach their saved points at
  their saved times.

**Smoke lingers.** A descent leaves smoke along its whole path, including the
stretch above the screen that it crossed before coming into view. The smoke
stays for 14 s (20 s for the heavy bomb). As it ages it:

- **Spreads:** it widens as it ages.
- **Drifts:** it moves downwind in the shared cosmetic wind (`wind.js`), more
  strongly higher up.
- **Twists:** shear bends it, as real re-entry trails do.

It is drawn under every pod, facility and unit, so the battlefield stays
readable.

**The cutting beam** is invisible in vacuum. Its column comes down the same
orbital track and brightens toward the ground, where air scatters it. The cut
boils off puffs of smoke that drift downwind and fade over 16 s.

## Physics and art direction

Modelled from reality:

- A steep final entry along a shared orbital ground track.
- Plasma heating that follows speed: capsules lose it as they brake, shells keep
  it and heat further in denser air.
- Retro-rocket braking with dust thrown before contact.
- The hot body lighting the ground.
- Persistent trails that spread, drift with the wind and are twisted by shear.
- A beam visible only through atmospheric scattering.

Art direction:

- **Compressed time:** all timings are the saved countdowns, about 1.35–3 s
  rather than minutes.
- **Chosen numbers:** colours, sizes, the lean of the track and the linger
  times.
- **Smoke tone:** one smoke colour for every planet.

## Rules kept

- **Saved timing and landing:** every pose comes from the object's own saved
  countdown and lands exactly on its saved ground point at its saved impact
  time. Nothing moves a hit, a landing point, a timer or a warning ring.
- **Browser-only smoke:** keyed by object id, timed on the server clock
  (`combat.time` plus the snapshot's age, frozen while the room is paused), and
  capped at 48 trails. A world change clears it. Old descents are not replayed
  on reload.
- **Layering:** the dashed warning rings and the draw order of every site are
  unchanged.
- **Reduced effects:** no plasma, retro light or smoke. The earlier simple
  shell line stays for strikes, and every site keeps its earlier reduced-effects
  behaviour.

## Implementation

`public/reentry-art.js` holds:

- the track;
- the altitude curves (`pod` braking, `shell` constant speed);
- poses, the plasma head, the retro burn and ground light;
- the smoke registry and its drawing (filled ribbons with along-trail
  gradients, plus puffs along a beam cut).

The eight capsule sites call `capsuleDescent` with their drawn body size and
perspective scale, so the plasma wraps the body instead of hiding under it.
`orbital-ui.js` draws strike shells, cluster bomblets and the beam column.
`app.js` sets the clock once per frame and draws the smoke under the pods,
skipping trails that are off screen.

## Validation

All validation is local, on the author's workstation (Chrome 155, NVIDIA GPU).

- **Unit tests:** 6 new tests cover:
  - exact landing at the saved point and time;
  - a soft capsule contact and a constant shell speed;
  - one track per planet, always from above;
  - the heat and retro profiles;
  - one trail per descent, linger, pruning and the cap;
  - bounded drawing with no pixel reads, off-screen culling, nothing with
    reduced effects, and plasma sized to the body.

  39 related unit tests also passed, and TypeScript passed.
- **Browser checks:** 33 passed on the first run with no retries: orbital,
  orbital panels, deployment flow, starting core, survival, world sound and
  GPU reset.
- **In-game captures:** taken at 1920 × 1080 and 390 × 844 with disposable
  worlds. They cover a core landing, the robot replacement pod, a facility
  crate, and HE, heavy, cluster, barrage and beam strikes, including the aged
  smoke.
- **Frame cost:** measured in the worst case seen, a sustained 31-shell
  barrage, with Chrome CPU throttling at 10× as a proxy for a slow device. The
  re-entry drawing cost about 3.8 ms per frame (56 against 71.5 fps without it),
  roughly 0.4 ms unthrottled on this machine. Trimming gradient stops and
  samples and culling off-screen trails brought it down from 6.3 ms. Phones and
  low-end hardware were not measured.

The [validation record](testing/evidence/2026-11-09/reentry-validation.json)
holds the source hashes and measurements. Captures:

- [core](testing/evidence/2026-11-09/reentry-core-desktop.jpg)
- [crate](testing/evidence/2026-11-09/reentry-crate-desktop.jpg)
- [HE](testing/evidence/2026-11-09/reentry-he-desktop.jpg)
- [HE smoke lingering](testing/evidence/2026-11-09/reentry-he-linger-desktop.jpg)
- [heavy](testing/evidence/2026-11-09/reentry-heavy-desktop.jpg)
- [cluster](testing/evidence/2026-11-09/reentry-cluster-desktop.jpg)
- [barrage](testing/evidence/2026-11-09/reentry-barrage-desktop.jpg)
- [beam](testing/evidence/2026-11-09/reentry-beam-desktop.jpg)
- [beam smoke](testing/evidence/2026-11-09/reentry-beam-smoke-desktop.jpg)
- [HE on a phone](testing/evidence/2026-11-09/reentry-he-phone.jpg)

## Open for the author's playtest

- **Retro burn:** whether to keep it. It was kept because it reads well and
  separates friendly arrivals, which brake, from strikes, which do not.
- **Smoke:** whether 14 s (20 s for the heavy bomb) is too long or too dense
  during a barrage.
- **Smoke on Sirocco:** the light smoke has low contrast against the desert's
  sand; a darker variant may be needed there.

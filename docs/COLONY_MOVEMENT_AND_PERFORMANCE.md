# Colony menu, smooth movement and worker animation

2 November 2026. The author pauses opening-scene work and reports a sharp loss
of smoothness in the garden. They request Esc for the menu and ask whether the
four-foot worker can walk before considering a tracked redesign.

The later [tracked-worker follow-up](#tracked-worker-follow-up) below supersedes
the foot appearance; the menu and movement fixes still apply.

## Findings

The server simulates motion every 50 ms but broadcasts garden state about every
250 ms (roughly 260–310 ms delivery intervals in the local captures). The old
client eased toward each fixed position, slowing almost to a stop before the
next packet. Worse, the Reduce animation setting replaced that smoothing with
instant position changes. The camera also followed the unsmoothed server pose.
These produced visible movement hitches independently of rendering frame rate.

In the recorded baseline, normal walking's 90th-percentile frame speed was
36.24 times its 10th-percentile speed. With reduced animation enabled, position
changed on only 3.49% of sampled frames. These are presentation measurements,
not claims that the authoritative simulation ran at those speeds.

Rendering had separate avoidable costs: all fixed machinery was redrawn as
vector paths each frame, including machines outside the view, and scenery
selection repeatedly scanned the visible terrain. Terrain itself was already
cached. A four-leg animation already existed, but its small reach/lift was hard
to see and its movement flag depended directly on packet-derived velocity.

## Implemented behavior

- Esc closes help or Crew, cancels placement, or closes the inspector first.
  From clear play it opens Crew, which contains invitations, pause/resume and
  Save and return. It works while the invitation field has focus and clears
  held movement. Opening this menu does not automatically pause co-op.
- `colony-motion.js` smooths presentation independently of the effects toggle.
  It bridges snapshots with up to 250 ms of speed-capped, collision-checked
  extrapolation using the existing movement rules. The camera follows that
  rendered worker. Duplicate revisions do not erase estimated velocity;
  runtime changes and teleports reset it, and stale motion remains bounded.
- Four feet alternate diagonal pairs with a visible planted/swinging stride.
  Phase follows rendered distance; stride strength settles to the standing pose
  when motion stops. Reduced animation keeps the limbs still without making
  translation jerky. The supplied design sheet and robot anatomy are retained.
- Fixed hub, bed, pad, parked shuttle and sprinkler parts are rasterized once
  per zoom/DPR and relevant visual state. Sparse scenery is indexed once and
  offscreen objects are culled. Crops, spray, flying shuttles, occlusion fades
  and depth order remain dynamic. Pausing freezes the cosmetic scene clock.

These changes do not increase network frequency, change server speed/collision,
alter farming balances, migrate saves or edit the combat renderer.

## Local validation

All checks use disposable fixtures or a renderer-only in-memory garden. No real
developer saves were opened or changed, and this stage was not deployed.

- Eleven focused movement, projection and runtime tests passed, followed by
  TypeScript. Tests cover sparse packets, shoreline collision, stale updates,
  negative snapshot age, pause reconciliation and reset/departure handling.
- Four new browser cases passed: Esc precedence/input focus, normal motion,
  reduced-animation motion and a second player's movement. A later batch passed
  three cases: the Esc check again, existing zoom/pan/placement/direction coverage
  and the existing phone gardening/touch/irrigation flow.
- In live local browser measurements, normal and reduced movement changed on
  every sampled frame. The frame-speed percentile ratio fell to about 1.08 in
  both modes. Movement remained bounded to authoritative positions; pause and
  loss of focus stopped it. See the [baseline](testing/evidence/2026-11-02/colony-motion-baseline.json)
  and [browser validation](testing/evidence/2026-11-02/colony-motion-validation.json).
- Robot pose checks passed for four directions, explicit walking phase, stopped
  poses and reduced animation, with no extra drawing primitives. The
  [review sheet](testing/evidence/2026-11-02/colony-worker-walk-review.png) shows
  enlarged directions and the actual 45-pixel-per-tile walking scale.

The paired renderer-only probe uses 16 beds and four workers for its busy
scenes. Mean JavaScript draw time in its final local run:

| Scene | Before | After |
| --- | ---: | ---: |
| Busy desktop | 10.76 ms | 6.46 ms |
| Desktop panning | 10.65 ms | 6.45 ms |
| Zoomed out | 11.36 ms | 7.25 ms |
| Busy phone | 9.60 ms | 5.51 ms |

Desktop stroke calls dropped from 3,981 to 1,887 per frame. Headless timing
varied across runs; these figures demonstrate less local rendering work, not a
guaranteed FPS on the author's device. The probe deliberately excludes network
and UI work. Native-resolution sprite caching can slightly change edge
antialiasing; desktop/phone comparisons retained the scene's shapes and details.

[Probe](../scripts/colony-render-probe.mjs),
[before results](testing/evidence/2026-11-02/colony-render-baseline.json),
[after results](testing/evidence/2026-11-02/colony-render-current.json),
[Crew menu](testing/evidence/2026-11-02/colony-menu-escape-desktop.png),
[phone garden](testing/evidence/2026-11-02/colony-motion-gardening-phone.png).

## Tracked-worker follow-up

The author reviewed the smoother movement but still perceived the feet as
sliding. They explicitly selected four compact tracks with rolling belts and
light suspension instead. No replacement design sheet is required: the worker
is drawn from code-native shapes in `public/colony-robot.js`.

Four separate chamfered track pods replace the feet and lower leg assemblies.
Each has a dark belt, three visible side rollers, moving transverse cleats and
a short white mudguard. Short suspension links connect to the existing pelvis.
The chassis bobs slightly and the suspension compresses while travelling; track
bottoms remain on the ground. The four arms, visor, backpack and white/violet
upper body retain their design, with gentler arm sway appropriate to rolling.

The existing rendered-distance phase drives the belts; no new network fields,
simulation steps or stored state are needed. A stopped worker settles, while
Reduce animation freezes cosmetics and keeps smooth translation. Controls,
speed, collision, terrain access and farming rules are unchanged. Static track
profiles and wheel geometry are shared, and tread marks use one batched stroke
per pod.

Local validation used disposable fixtures and an isolated canvas; developer
saves were untouched. No deployment was performed.

- Eleven movement/projection/runtime tests and TypeScript passed.
- Four existing browser cases passed: normal movement, reduced-animation
  movement, zoom/pan/placement/four headings, and phone gardening. Both movement
  modes changed position on every sampled frame; frame-speed percentile ratios
  were 1.097 and 1.082 respectively in this local run.
- Actual canvas pixels differ between moving phases and remain identical across
  stopped/reduced-motion samples. All four headings are distinct and finite;
  no browser errors. Direction and native-scale review found no clipping or
  floating track contact.
- Across the four cardinal poses combined, path count stayed at 904; fills
  decreased from 624 to 616 and strokes from 843 to 803. Line vertices increased
  from 2,621 to 2,885 due to the rollers and cleats. This is a drawing-complexity
  comparison against the immediately preceding foot design, not an FPS claim.

[Track review sheet](testing/evidence/2026-11-02/colony-worker-tracks-review.png),
[canvas checks](testing/evidence/2026-11-02/colony-worker-tracks-checks.json),
[browser checks](testing/evidence/2026-11-02/colony-tracks-browser-validation.json),
[desktop](testing/evidence/2026-11-02/colony-tracks-desktop.png),
[phone](testing/evidence/2026-11-02/colony-tracks-phone.png).

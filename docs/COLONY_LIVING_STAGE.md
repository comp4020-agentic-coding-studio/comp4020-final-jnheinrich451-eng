# Colony living: a settlement in two parts and a robot that sits, charges and brews

8 November 2026. The author's brief, in their words: the core has two parts,
"first is about the production, here we grow plants, and then the basic
industrial components; and the place for living. Robot does not need to sleep,
but it can like add sitting, charging, brewing something haha. Those with life
pace stuffs"; and, on the proposal, "for 2 and 3 I agree, and add one in the
plan, the animation. We will finetune them later." This record holds the stage
as built. It follows the colony card stage (`docs/COLONY_INDUSTRY_STAGE.md`)
and keeps the rule that the colony has no ending: resting grants nothing and
costs nothing, it is a reason to linger.

## Two parts, by habit rather than by rule

Production is the Garden, Bed, Sprinkler and Industry tabs; living is Camp
and Furnish. The author's split is expressed by where things live in the dock
and in the catalogue, not by a zoning rule: nothing already placed became
invalid, and a kettle beside a generator is allowed. The Furnish catalogue
gains a **Living** category holding the garden bench, the robot rest pad and
the two new pieces below; the other categories are unchanged.

## Rules (runtime-held, shared with the client)

Resting lives in `public/colony-rest.js`. It is a state of the person, kept by
the colony runtime beside position and heading, never part of the colony save.

| Rule | Value |
| --- | --- |
| Furnishings | Garden bench and robot rest pad: sit. Charging post (4 materials, 1 x 1, solid): charge. Brew kettle (3 materials, 1 x 1, solid): brew. Only a furnishing whose status is ready counts |
| Reach | `rest` needs the worker within 1.6 tiles of the nearest cell of the furnishing, in the home district |
| Spot | A seat puts the worker at the centre of its footprint facing south. A post or kettle puts it one tile in front (south of the footprint) facing north; that tile must be clear, or the order is refused with "Clear the space in front of it first." |
| Standing | Any movement input stands the worker up, as does `stand` (E again) or losing the furnishing (stored or moved under a seated worker, ended on the next tick). The worker returns to where it entered the seat if that is still clear, otherwise to the nearest clear tile within three, so nobody is left inside a solid bench |
| Return point | Changing seat without standing keeps the first return point |
| Record | Other players and the local client see `activity: { kind, itemId, since }`; the private return point never leaves the server. The record persists with the person, so a seated worker is still seated after leaving and a restart |
| Garden | Resting changes nothing: no revision, no materials, no crop effect |

## Presentation (browser-only; reduced motion settles)

- The prompt above the field reads Sit, Charge or Brew with the E key, and
  Stand up while resting. Crates keep precedence; a bed's E actions come after
  resting. Phones tap the same button.
- Worker poses (`public/colony-robot.js`): sitting lowers the body and rests
  the arms with a slow breathing bob; charging faces the post with a cable
  from the pack to the hook, a light pulse running along it once a second and
  the visor breathing; brewing holds a cup beside the shoulder with three
  rising steam puffs and a gentle sway. Tracks stay still. Arms settle into
  each pose over half a second.
- Furnishings (`public/colony-settlement-art.js`): the charging post is a
  white post with a graphite head, cable hook, violet band and cyan standby
  lamp that pulses while in use and lights the ground at night; the kettle
  is a white stand with a timber tray, kettle and two cups that steams while
  in use. `drawSettlementMotion` takes a sixth `inUse` argument, true when any
  player's activity names the furnishing.

## Validation (8 November 2026, disposable saves and servers)

- `pnpm typecheck` passes.
- Vitest, nine colony files against a disposable server: 111 passed.
  `spec/colony-rest.test.ts` holds five rule tests: spots and facing;
  nearest-in-reach and arriving furnishings; reach, readiness, region and
  idempotence with the colony save untouched; the clear-front rule and the
  kept return point; the ring search when seat and return point are blocked,
  and the end of an activity when its furnishing goes. The runtime test seats
  a worker on a delivered rest pad through the API, stands it up on movement
  and when the pad is stored, and finds it still seated after a restart.
- Playwright `tests/browser/colony-rest.spec.js`, pinned to the E-cores: a
  seeded bench, kettle, post and lamp; E (desktop) or the button (phone)
  seats the worker with the toast, the garden is unchanged, movement stands
  it up, and on desktop the worker walks to the kettle, brews, and two frames
  of the brewing worker differ. The first runs failed because a held key kept
  the worker moving between polls and it overshot the kettle by two tiles;
  the walk now uses short taps and goes round the solid bench. Also run
  pinned after the Living category was added: Morrow settlement 3, combat
  settlement 2 and colony motion 4 passed, once the catalogue walk in the
  Morrow settlement spec learned the new tab and the two new pieces.

Evidence: [sitting, desktop](testing/evidence/2026-11-08/colony-rest-sit-desktop.png),
[sitting, phone](testing/evidence/2026-11-08/colony-rest-sit-phone.png),
[brewing, desktop](testing/evidence/2026-11-08/colony-rest-brew-desktop.png).

Known limits: a seated worker's visor faces south on a bench but north at a
post or kettle, so the visor glow while charging is mostly hidden by the head
and the cable is the visible cue; there is no sound; nothing yet draws other
crew members' prompts or a seat's occupancy before you walk up. The author
asked to fine-tune later, so poses, timings and the catalogue prices are
provisional.

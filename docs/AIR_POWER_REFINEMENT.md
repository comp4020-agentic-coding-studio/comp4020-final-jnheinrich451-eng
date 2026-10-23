# Fixed-wing weapons and presentation

23 October 2026. Implemented locally after the gunship secondary-battery stage.
The author requested stronger, repeatable air support, a compact flight HUD,
distinct aircraft silhouettes, and an AC-130-style gunship as the next proposal.

## Player loop

Bombers and attack jets have unlimited ammunition. Existing zero-ammunition saves
can fire again; helicopter ammunition and servicing stay unchanged. Fixed-wing
landing still provides transport, disembarkation and existing hull repairs, but
does not require an ammunition-refill wait. Campaign repairs retain their ground
or carrier supply costs. Fleet capacity, airfield reservations, aircraft loss,
flak damage and compatible landing destinations retain their existing rules.

The bomber has one shared, saved cooldown. Changing payload does not bypass it.
Time advances only with the active simulation, including while parked. Failed
orders consume no cooldown. Returning to base does not clear an active cooldown.

| Key | Payload | Footprint | Cooldown from acceptance |
| --- | --- | --- | --- |
| 1 | HE carpet | Two rows of six; 2-tile radius per bomb | 8 seconds |
| 2 | Heavy HE | One bomb; 10-tile radius, 600 central damage | 14 seconds |
| 3 | Incendiary | Two rows of six; existing 18-second burning sectors | 12 seconds |
| 4 | Gas | Two rows of six; 18 shared kills | 12 seconds |

Carpets release a pair every 0.5 seconds over 2.5 seconds. Each row is twice the
old strip length at the same speed; rows are 2.4 tiles apart. The aircraft holds
course during release. Heavy HE doubles the former radius and damage, including
its inner radius and edge damage; ground area is four times larger. Its cosmetic
crater diameter is 24 tiles. Friendly immunity and enemy armor rules still apply.
These are deliberately powerful initial playtest values, not final balance.

The complete blast footprint must fit the map. Two simultaneous bombardments and
the existing hazard count/area budgets remain; a large occupied fire/gas budget
can reject a new carpet. Bomber hazards reserve the sum of twelve
sector areas (overlaps still count twice), avoiding a direction-dependent charge
for empty bounding-box corners. Old fields retain their prior area reservation.
Accepted attacks retain their original profiles, targets
and release schedule through saves. Old in-flight attacks keep their old size.
Automatic missions use the new pattern, retain one release per order, and return
or resume cruise according to the existing order. Cruise aircraft can be ordered
again after cooling without an ammunition-return trip.

## Attack jet

LMB retains the forward HE autocannon (28 central damage, 120 ms cadence).
RMB/J adds a 30 mm gun: three small HE impacts per accepted 150 ms batch, eight
central damage each, 0.4-tile radius and 0.55-tile cosmetic craters. Both weapons
are unlimited and have separate saved cooldowns. Steering aims them; arbitrary
client target coordinates cannot redirect them. Release, blur, disconnect and
control changes stop requesting fire.

The rapid gun's accepted impacts resolve after 40 ms, without trajectory drawing
or per-bullet physics. All three impact positions must be valid and all three
slots available before admission. They share the existing 16-slot air projectile
budget with other aircraft. A shot record drives the nose flash; cosmetic marks,
flashes and impact particles retain their existing caps. Twenty impacts/second
is the theoretical per-jet ceiling, not a measured Fly throughput claim. Network
requests and simulation cadence may reduce it. No Fly resource configuration was
changed; sustained multiplayer performance remains to be measured on Fly.

## Flight presentation and controls

The bottom bar has four bomber payload buttons (1–4) and LMB release at right.
The jet has LMB/RMB buttons. Accepted firing flashes the appropriate button.
The green instrument panel shows indexed airspeed, compass heading, bank angle,
hull health and readiness; it does not invent altitude or pitch simulation.
U / Find airbase locates the assigned destination. C restores camera following.
The large controls remain for parked aircraft and helicopters, not routine
fixed-wing flight. WASD continues to control flight.

Original canvas artwork uses a white, long-nosed delta bomber with canards,
twin fins and six exhaust ports; the attack jet has straight wings, twin rear
engine nacelles and a prominent nose gun. References are the
[NASA XB-70 description](https://www.nasa.gov/aeronautics/xb-70-valkyrie/) and
[USAF A-10 fact sheet](https://www.af.mil/About-Us/Fact-Sheet-Display/Article/104490/a-10c-thunderbolt-ii/).
These are stylized game aircraft, not scale replicas or additional licensed art.
Exhaust varies with speed, condensation follows banking, and takeoff raises dust.
Effects are bounded canvas drawing; reduced effects suppresses animated dust,
condensation and exhaust flicker. Runway size, collision and flight handling stay
the same. No new audio is included in this stage.

## Next proposal: side-firing gunship

The first manual stage is now implemented in [AC130_GUNSHIP.md](AC130_GUNSHIP.md).
The paragraph below records the original proposal; automatic orbit remains next.

An AC-130-inspired, slower aircraft would orbit a target while firing from one
fixed side. Proposed roles: 25 mm sustained light suppression, 40 mm medium-area
bursts, and a slower 105 mm explosive cannon against heavy targets. Each caliber
would have a separate cadence and visible aim region; accepted shots must remain
immutable. Start with manual flight and a clear side arc, then consider an
automatic orbit order. Flak exposure, turn radius, landing footprint, damage,
cost and supply requirements need a separate design/playtest stage. This aircraft
is recorded only; it is not implemented by this refinement.

## Validation

Domain tests cover empty legacy loads, shared cooldowns, reload persistence,
paired geometry at all headings/speeds, atomic rejection, friendly immunity,
rapid-fire batches and unchanged helicopter reserves. Existing mission tests
cover cruise reordering, exact remaining automatic burst counts, recovery and
accepted impacts surviving restart. Browser tests use disposable worlds and two
viewers at 1920×1080 and 390×844, plus landscape resize, payload keys, held fire,
release/blur and U/C controls. Screenshots and logs are under `.local/air-power-*`.
Local evidence does not establish Fly capacity or deployment.

Validation results: the broad run passed 650 of 653 checks; its three failures
were corrected, and the affected six-file regression then passed all 32 checks.
Additional final hazard/geometry checks passed 26 tests, and the logging check
passed seven. TypeScript, diff and coursework evidence checks pass. All four
new aircraft/viewport browser cases passed; subsequent actual mouse/J/blur tests
passed on desktop and phone, plus the two existing flight-handling cases. The
blur fixture explicitly restores focus before testing movement. Inspected normal
and reduced fire/gas artwork at ten seconds after release, and the landscape HUD
after moving its instrument panel clear of the map toolbar. No commit or deploy
was performed in this stage.

Reconnect follow-up: refreshing a paused solo campaign retained the server pause
but discarded the Resume dialog, silently blocking movement and weapons. Startup
now restores that dialog; Return to battle or Escape resumes normally. Actual
session expiry, signing back in, and menu leave/rejoin restored the saved pilot's
steering and firing in four bomber/attack-jet browser cases across desktop and
phone. The exact reported expiry-only freeze was not reproduced. Two relevant
campaign pause/recovery HTTP tests and TypeScript also passed. Tests used
disposable saves; the player's campaign was not reset. Evidence is in
`.local/flight-rejoin-*`; this follow-up is local and uncommitted.

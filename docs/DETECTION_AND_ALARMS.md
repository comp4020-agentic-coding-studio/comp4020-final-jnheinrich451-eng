# Detection, tracking and alien alerts

10 October 2026. **First scanner stage implemented locally**, following the
author's approval to implement and test the recommendations. General noise and
ordinary enemy sharing remain proposals. No Fly deployment or capacity claim.

11 October update: [defensive sectors](DEFENSIVE_SECTORS.md) now share bounded
attack reports. Hits in hostile territory alert nearby facilities/defenders to
the impact location. General movement noise and recursive sharing remain deferred.

## Play this stage

Open a named campaign, use **Locate alert station**, and approach with a robot
or tank. The amber ring searches; a pink fan confirms tracking, while amber fan
means the station is turning toward or investigating its last observation.
The HUD shows DETECTED, then an eight-second countdown after contact is lost.
Move behind rocks/solid structures or beyond beam range, and keep moving away
from the remembered position. A teammate can approach while the beam is occupied.
Cracks warn for 2.2 seconds before defenders emerge. HE still destroys the crown
permanently; survivors and existing marks do not disappear instantly.

Current tuning: 12-tile radial pulse every three simulation seconds; 24-tile,
24-degree tracking fan turning at 90 degrees/second; eight-second mark memory;
28-tile marked home leash versus the ordinary 20 tiles. These are playtest values.
Three initial guards, two per reinforcement call, 12-second cadence, eight per
station and 24 total remain. Pending calls reserve global population capacity.

The server stores pulse phase, last observations, marks and pending calls in the
existing combat checkpoint. Old saves initialize the additive sensor fields;
terrain and completed sites are preserved. Paused/offline time does not advance
them. State transitions and arrival outcomes use existing structured logs after
named-world checkpoints; individual sensing ticks are not logged.

Contacts are active, unprotected physical participants, keyed by pilot ID with
their current robot/vehicle target ID. Observed boarding updates that same mark.
Fully submerged submarines are excluded; diving/surfacing remain detectable.
Air/sea contacts can be marked but do not call ground-only reinforcements.
Unoccupied parked vehicles still obey existing alien attack rules, but do not
independently trigger this station's scanner. Sensor geometry currently uses
contact centers; swept motion catches fast center crossings between ticks.
Physical footprint sensing is a possible later refinement.

Defenders follow fresh reports or investigate a fixed last-known location, then
return home when memory expires. Local sensing and existing attacks continue;
fire avoidance, gas attraction and burning panic retain priority. No new speed,
damage, water crossing or anti-air attack is granted. Arrival positions recheck
terrain, fire, structures, participants, parked vehicles and existing enemies.

Implemented code: `public/sensors.js`, `public/conquest.js`, `public/combat.js`,
`public/conquest-effects.js` and the existing game HUD. The remaining sections
preserve the design discussion; this implementation record takes precedence.

Local verification on 10 October: `pnpm check` passed typechecking and 206 tests
across 37 files. The scanner/conquest suites also passed after the final arrival
clearance adjustment. Five selected browser checks passed across the conquest,
multiplayer-latency and scanner suites: desktop/phone conquest and saved ruins;
two/four-player shared updates; desktop/phone scanner tracking, cover escape and
countdown, with reduced effects on phone. The scanner browser fixture disables
reinforcements to isolate escape; simulation tests exercise pursuit, reservations,
unsafe arrivals and save/reload during a pending call. These checks do not prove
sustained Fly capacity, final balance or every vehicle encounter.

## Player story and requested direction

Approach an alien sensory crown, see its circular search pulse, and choose whether
to evade it, distract it or attack. On detection the organ focuses a longer,
narrower tracking fan on the contact. The detected unit gains a visible status
that makes nearby defenders pursue farther. Reinforcements visibly burrow out
of the ground and investigate/chase the intrusion. Destroying the station remains
permanent conquest. Sound should reinforce warnings when available.

The author also proposes circular local alien sensing, movement/weapon noise,
and alerts shared between nearby enemies. These must be gameplay state calculated
by the server, independent of camera, rendering and audio playback.

## Baseline before this stage

`public/conquest.js` uses a 12-tile presence radius and a 4-second alarm grace,
with 12-second reinforcement intervals, two defenders per call, eight living
defenders per station and 24 total enemies. Three initial guards are separate
from reinforcement calls. Arrival warnings last 2.2 seconds and recheck clear
ground and nearby players before spawning. These are current tuning values.

`public/combat.js` gives ground enemies roughly six-tile acquisition and eight-tile
target retention, with a 20-tile home bound for station defenders. The station
does not supply an investigation destination. Consequently the site can be
alerted while its defenders do not yet pursue the triggering player.

There is no shared noise-event system, focused scanner or detected status. The
existing submarine mechanic loses swimmer tracking only when fully submerged;
diving and surfacing remain vulnerable. The station's current generic presence
check does not itself distinguish depth. A new contact filter must do so explicitly.

## Scanner decisions confirmed by the author

1. Focused tracking stops circular search. One tracking channel creates an opening
   for teammates approaching from another direction.
2. The detected status fades after a short lost-lock countdown; it does not require
   destroying the station. Exact duration remains a tuning choice.
3. Rocks and solid structures block the focused beam, giving cover a role. Alien
   local sensing/noise can still convey a disturbance around cover. The search
   pulse's obstruction rule also needs to be explicit;
   proposed first rule is radial sensing with no shadow, focused tracking blocked.

## Scanner state machine and longer-term refinements

`search -> contact/track -> lost-contact search -> search`

Any intact scanner state can transition to `destroyed`, permanently. Death is
not an alarm cooldown. An ordinary enemy's independent contact can survive the
station's destruction, but the dead station never refreshes marks or calls again.

- **Search:** a periodic expanding 360-degree pulse detects physical units when
  the wave reaches them. Match the drawn wave to the server's simulation phase.
  This creates pulse gaps intentionally; a crossing during a pulse must not be
  missed merely because a fast aircraft skipped a server sample. Test segment/
  wave intersection and unit footprint, not only its latest center coordinate.
- **Contact/track:** retain one eligible contact, turn the narrow fan at a finite
  speed, and refresh the detected timer only while the contact lies in the real
  fan/range and satisfies the chosen obstruction rule. The beam must not snap to
  the target like an unlimited turret. Range is longer than search range.
- **Lost contact:** hold a last-known location briefly, finish a bounded search,
  then resume circular scanning. A remembered target ID never supplies fresh
  coordinates without a new observation. A remembered contact expires in simulation
  time. Repeated boundary crossings must not reset the first-call countdown.
- **Multiplayer:** retain a valid tracked target instead of switching every tick.
  Resolve simultaneous first contacts deterministically, such as distance then
  stable entity ID. The other players are still detectable by individual aliens.

Initial tuning to discuss: retain the 12-tile search radius, try a 24-tile tracking
range, a 24-degree full fan width and an eight-second lost-lock mark countdown.
Pulse period, rotation rate, call delay and pursuit extension need one playable
encounter before being treated as balance. Keep the existing population caps.

## Detected status and enemy response

Display **DETECTED**, its source and a remaining timer. Marking grants better
information and a longer but finite pursuit envelope; it does not silently add
damage, speed or perfect planet-wide tracking. Exact enemy acquisition, retained
contact distance and home leash are separate values. Extending one must not leave
another smaller bound preventing the intended chase.

A station sends nearby eligible defenders an investigation destination. Within
their own sensing range they can acquire and attack a reachable target. Beyond
that range they use only a fresh scanner report or last-known location; after
memory expires, search locally and return. Preserve fire avoidance, burning panic
and gas attraction priority. A mark must not force an alien to ignore lethal fire.

For a first version, independently keyed marks refresh a maximum remaining time;
multiple scanners do not multiply pursuit indefinitely. Destroying a source
removes its ability to refresh; whether its existing mark clears immediately or
decays should be stated alongside the selected mark rule. Recommended: decay,
while pending reinforcement calls from that station cancel immediately.

## Local sensing and later noise propagation

Give ordinary aliens a short circular biological sensing radius, independent of
facing. This is a fictional vibration/chemical sense, not a claim about real radar
or Helldivers' implementation. Detecting, reaching and attacking are separate:
an alien can sense something behind cover but must still find a valid route and
satisfy the existing attack obstruction check.

Proposed server noise events contain origin, source entity, category, intensity,
time and expiry. Movement intensity follows actual travel/speed, not held keys:
a blocked tank does not emit traveling-track events. Robot steps are relatively
quiet; moving tanks/ships louder; airborne engines and heavy launches conspicuous.
Exact ranges are open. Idle engine noise is a separate future choice. An explosion
reveals its impact location; it does not automatically reveal the distant gun.

Nearby listeners investigate an event location, then acquire a target through
their own senses. A directly detecting alien may emit a short alert call that
recruits neighbors. Recommended first propagation rule: one local hop per event,
with deduplication and cooldown. A heard warning does not generate another copy
of the same warning. Later multi-hop propagation would need both a hop limit and
an overall distance/time budget. Otherwise a dense chain can wake the entire map
and keep itself alive after the player has left.

Only alert stations call reinforcements. An alien cry recruits existing enemies;
it does not give every enemy a spawn ability. Forwarded reports do not refresh a
detected status as if the scanner had seen the target again. Noise heard behind
cover reports an uncertain location, not a free tracking beam.

## Cases the stage must handle

| Case | Proposed rule / boundary |
| --- | --- |
| Robots, tanks, surface ships, aircraft | Can be sensor contacts. Detection is separate from ability to attack: ground crawlers cannot cross ocean or strike airborne aircraft. Avoid endless unreachable path searches. |
| Fully submerged submarine | Preserve its escape role: no fresh surface-scanner lock or ordinary ground detection. Previous reports age out; sonar would be a separate future sensor. Diving/surfacing eligibility must follow the existing vulnerable transitions. |
| Orbital survey / landing | A camera or undecided landing cursor is not a physical target. Keep current deployment protection for the first stage; later pod noise can report a landing without allowing attacks during the protected arrival. |
| Remote facility operation | Sense/noise comes from the real robot and firing facility positions, never the operator's camera or cursor. |
| Boarding / exiting | Follow the observed physical entity. Boarding must not erase a still-observed player's mark or duplicate robot-and-vehicle threat; leaving must not teleport the vehicle's known location onto the robot. Define explicit contact handoff. |
| Parked equipment | A parked tank is already an eligible combat target in the current game. Do not treat all owned equipment as extra moving players or silently invent automatic noise from parked vehicles. |
| Long-range bombardment | Hit/impact can alert the station and nearby defenders. Without a source observation, investigate impact rather than knowing the shooter's exact position. |
| Enemy emergence | Warn with cracks/dust/rings before a burrow opens. Revalidate dry walkable ground, obstacles, every player and vehicle at emergence. Defer/reselect if blocked; no spawning inside a core, hull, water or on top of a player. |
| Multiple contacts / calls | Calls belong to the station, not each player or each pulse. Reserve pending wave slots as well as living population. Preserve cap and no duplicate initial guards. |
| Marked aircraft | A scan may alert the site, but do not repeatedly spawn useless melee waves under a plane. Proposed first rule: reinforce only while a reachable ground threat or actionable ground disturbance exists; full air defense remains later. |
| Conquest / blocked paths | Conquest persists, remaining enemies survive, and failed pursuit does not heal/reset them. Use bounded local search/return if a target cannot be reached; no automatic ocean-crossing or despawn shortcut. |
| Pause / reconnect / saved return | Use the room's simulation clock. Retain meaningful contact/call progress with campaign checkpoints; freeze on owner grace/solo pause and do no offline catch-up. Revalidate restored targets before a new lock. |

Ship-to-shore response, airborne threats and terrain-shadow rules are design
choices, not automatic consequences of adding a scanner. Keep depth and medium
eligibility explicit before advertising that it detects 'every form'.

## Computation and feedback

Run contact/noise decisions in the authoritative server simulation, including
off-screen active encounters. Rendering consumes shared sensor state. Camera zoom,
phone resolution, reduced effects, muted sound and browser frame rate change no
awareness rules. Sound playback is optional feedback, not an input to enemy AI.

Use distance/angle filters before any obstruction or route query. Contact checks
may be scheduled less frequently than movement, with swept checks for fast units.
Spatial buckets and capped, coalesced noise queues can limit neighborhood work
when the roster grows. Repath on meaningful destination changes/cooldown, not on
every pulse or animation frame. No full-map all-enemy-to-all-enemy broadcast loop.
These bound the intended work; only representative measurements establish Fly
capacity. No CPU/RAM promise is made by this design.

Show the scanner's search wave, fan direction, contact warning and lost-lock timer.
Keep the red conquest region visually distinct from both sensor ranges. Ground
cracks, dust and emerging silhouettes can reuse the current arrival warnings;
visuals must show the same safe arrival points the server actually accepts.
Later audio can use scan chirps, a distinct lock alarm and burrow impacts. Muting
must preserve every essential warning; repeated contact needs audio cooldowns.

## Implementation order and acceptance

1. Scanner states, one tracked contact, detected status, investigation/pursuit and
   visible burrowing warnings, retaining bounded existing populations. Use the
   three confirmed scanner rules above. First test robot/tank interaction,
   then validate ship/aircraft/submarine contact eligibility without inventing
   new attacks or overriding the existing escape mechanics.
2. Ordinary alien circular sensing and one-hop contact sharing.
3. Movement, launch and impact noise using the same event/listener interface.

For each stage test solo/co-op agreement, simultaneous first contacts, target
handoff, lost-lock expiry, obstacle/camera independence, fast crossings, submerged
escape, unreachable targets, cap exhaustion and canceled/blocked emergence.
Save/reopen during tracking and a pending call; conquest must stop calls forever.
Verify the player can actually escape a marked chase and that forwarded alerts
cannot create a self-sustaining loop. Log state transitions/call outcomes rather
than every sensing tick. Review desktop/phone visibility and reduced effects.

Economy, terrain height, new enemy attack types and full acoustic physics are
outside this stage. README/PROCESS remain checkpoint documents, not per-idea logs.

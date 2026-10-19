# Mobile anti-air lenses — 19 October 2026

Implemented locally. Two ground creatures challenge hovering aircraft and straight
approaches. Ground units can clear them before aircraft enter. Original overhead
canvas silhouettes use red chitin, purple tissue and exposed optical organs:
two small lenses on the hunter, one large lens on the heavy creature.

## Initial tuning

| | Twin lens | Heavy lens |
| --- | --- | --- |
| HP | 140 | 320 |
| Ground speed | 1.4 tiles/s | 0.55 tiles/s |
| Beam range | 18 tiles | 30 tiles |
| Brace / charge | 0.35s / 1.2s | 0.6s / 2s |
| Fire / cooldown | 2s / 4s | 2.5s / 7s |
| Tracking | 15 degrees/s | 5 degrees/s |
| Damage | 24 HP/s | 48 HP/s |

These are playtest values. One full burst cannot destroy a fresh 180-HP aircraft;
several attackers can. Twin lenses alternate every 0.16s, sharing one damage
budget and one target lock. They do not double the damage.

## Combat rules

- Patrol locally, acquire an airborne aircraft, stop, brace, charge, fire, cool
  and reposition. Patrolling stays around the saved home/rally point and checks
  terrain and fire; no unbounded pursuit or new pathfinder.
- A charging lens glows and draws a thin dashed line. Its warning direction is
  held until firing. The firing beam turns at the bounded tracking speed, using
  the same world-angle convention as the lance tower. Lateral flight is a better
  escape than hovering or travelling directly along the beam.
- The server computes actual beam/hull intersection with bounded angular samples.
  Only the nearest intersected airborne hull receives each sample's damage.
  A locked aircraft outside the beam takes none. Another aircraft can cross it.
- Like spore flak, the elevated beam ignores ground cover. Robots, tanks, ships
  and parked aircraft are immune. Takeoff and landing aircraft remain vulnerable.
  No altitude or terrain-height simulation is implied.
- A moved body, lost/out-of-range/landed target, burning panic, gas lure, or death
  cancels the attack. Interrupted attacks must cool before starting again.
  Fire and gas still kill these creatures; normal ground weapons can damage them.
- The two types never receive ground-melee or facility-raid assignments.
- Beam phase, anchor, bearing, target, remaining time and patrol state persist in
  the existing combat checkpoint. Offline time does not advance combat. Hit logs
  are emitted once per affected aircraft per burst, rather than per simulation tick.

## Spawning and cost

The shared cap stays at 24 living/reserved enemies. At most four mobile lens
enemies may be alive. The finite guards in at most six air-defended seeded
compounds trade one unspent Hunter for a lens creature (four twin, two heavy if
all six are eligible). They also wake when an aircraft approaches within 30 tiles.

Migration `mobile-laser-roster-v1` backs up the campaign database and stores the
roster plus migration marker atomically. It does not add facilities, change world
generation, transform living enemies, change pending warnings, refill spent
guards, or reverse conquest. Previously cleared areas remain cleared.

Local **Test frenzy** requests six Hunters, two Breakers, two Bulwarks, one twin
and one heavy lens, subject to clear arrival space and population capacity.
Existing nearby survivors retain their kind and health. The display shows the
actual mix. This remains a local testing tool, not a production event trigger.

Beam geometry and creature animation are client-side. The server sends compact
combat state, not particles. Fixed flak avoidance routing still only plans around
living flak facilities; aircraft do not automatically route around these moving
creatures yet. No additional Fly RAM claim or allocation is made.

## Verification

Focused simulation tests cover warning/brace timing, stationary firing, the
single twin-lens damage budget, lateral helicopter/jet escape, actual intersection,
cancellation, checkpoint continuation, ground immunity, terrain blocking, guard
migration and shared limits. Browser checks exercise live campaign snapshots,
warnings, aircraft damage and refresh on desktop and phone, plus the mixed Test
frenzy. All test worlds are isolated from player campaigns.

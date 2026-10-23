# Aerial gunship

23 October 2026. First manual stage implemented locally. Automatic target orbit
is the next stage, after player review of the flight and gun handling.

## Play loop

Order **Aerial gunship (A-06)** from Deploy → Air onto a completed empty runway
or carrier. Orbital delivery costs **100 ORB**. At an airbase, local drone
assembly costs **25 GND** and takes **60 seconds**. These are the existing
aircraft prices, provisionally retained for this first pass. The first-bomber
free delivery does not apply. Existing fleet slots, payment receipts and 80%
same-pool exchange credit remain in force.

Board with E. W/S adjusts forward speed between **4 and 8 tiles/s**; A/D banks
into a broad turn. Acceleration is 1.2 tiles/s², braking 1.8 tiles/s², with a
slower roll response. Full-bank turn rate is 0.45 radians/s at minimum speed,
decreasing with speed. Release the controls to keep the current throttle.
Existing boundary protection and return-home guidance remain authoritative.

Keep the target to the **left** of the aircraft. Aim inside the highlighted
110-degree sector, 3–18 tiles from the aircraft. Press **1 / 2 / 3** or click
the bottom cards to select a gun; hold **LMB** to fire. Each accepted shot locks
its target at release. Turning or moving the mouse cannot redirect that shot.

| Key | Gun | Damage at center | Radius | Cooldown |
|---|---|---:|---:|---:|
| 1 | 25 mm | 12 | 0.45 tiles | 0.12 s |
| 2 | 40 mm | 48 | 1.2 tiles | 0.5 s |
| 3 | 105 mm | 180 | 2.8 tiles | 3 s |

All three use the existing HE damage rules, with radial falloff, friendly
immunity and cosmetic craters. Ammunition is unlimited; switching guns does not
reset their independent cooldowns. Accepted impacts share the existing limit of
16 air-to-ground projectiles. The 25 mm has impact and muzzle effects without a
drawn trail; the larger guns show short shell trails. These are game balance
values, not claims about real aircraft performance.

Slow to **5 tiles/s or less** near a free runway to land, then E to disembark.
U locates the assigned airbase and C follows the aircraft. Existing supply-funded
hull repairs, destruction, saved seats, cooldowns, return-home recovery and
replacement rules apply. Hull health starts at 180. Anti-air remains a threat.

## Presentation and stages

The original overhead silhouette has broad straight wings, four animated
propellers, a transport fuselage and three left gun ports. Effects remain bounded
canvas work; reduced effects stop propeller animation and simplify gun flashes.
Four blue-white exhaust plumes lengthen with airspeed, with warm engine cores
and subtle flicker. Parked aircraft have no exhaust; reduced effects use shorter,
steady plumes. The display name is Aerial gunship; existing saved aircraft retain
their `air-gunship` identifier and unchanged handling, weapons and prices.

Parked fixed-wing controls now align the weapon strip, service panel and
Disembark/E button to one width. Payload selection lives in the bottom strip;
the duplicate select and fire button are hidden in the parked panel. Helicopter
cannon and rocket controls remain available.

The automatic cruise/strike actions explicitly reject this new type in this
stage. Recovery and recall remain available. Next: choose an orbit center,
validate that the orbit and left-side attack geometry fit the map, handle flak
and runway loss, then add remote orders. Dropped bombs are not part of this
stage; the 105 mm supplies the heavy ground bombardment role.

## Validation

`spec/air-gunship.test.ts` covers speed and turning, landing and recovery,
left-side geometry, rejected requests, independent saved cooldowns, immutable
accepted impacts, friendly immunity and projectile capacity. Facility HTTP
tests cover paid orbital delivery, GND construction, receipts, exchange credit,
foreign requests, replay and restart. Browser tests cover aligned parked bomber
and gunship controls, keyboard selection, sustained fire, all three guns,
rejected targets/weapons, reload, desktop, phone and landscape. Screenshots and
logs are in `.local/ac130-*`. This is local evidence, not a Fly load benchmark.

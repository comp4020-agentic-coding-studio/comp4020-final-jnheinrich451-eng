# Armored transport - vehicle ferry stage

12 October 2026. The author approved completing the bridge and transport pipeline,
then committing and pushing it. A bridge provides a permanent ground route; this
ship carries a vehicle to a coast without a crossing. The existing gunship and
submarine retain their weapons and saved identities.

## Player loop

1. Deploy **N-03 Armored transport** from Deploy (B), Navy. It uses the existing
   unfolding shore dock and requires friendly construction support at that dock.
2. Walk or drive along the completed offshore dock. Its 3 x 5 pier is ground
   flooring once deployment finishes; the surrounding sea remains impassable.
3. Drive a tank, recycler or bridge builder toward the empty transport's marked
   **DRIVE ON** ramp. Crossing the entry point transfers the vehicle to its cargo
   bay and its driver to the helm. A working builder must finish its bridge first.
   Alternatively, board on foot with E anywhere along the pier or at the shore
   point, then K loads a parked, unoccupied vehicle near the shore point.
4. Sail with W/S and A/D. Its one bow turret fires with LMB; RMB operates the
   port/starboard side guns. The bow turret retains HE, Fire and Gas (1/2/3),
   two barrels, six-second reload and the existing 6-40-tile naval range.
5. Stop at a dock, or use **G** to deploy a shore ramp beside clear land. Press
   **K / Drive off** (or the touch button). Control returns directly to the carried
   vehicle at the clear ramp endpoint. WASD drives it away; E exits the vehicle.
6. Return to the ramp to drive aboard again. Retract G before sailing away from
   a temporary shore ramp. E from the helm remains the ordinary robot exit.

The ramp crossing is a short, validated handoff, not free driving around a moving
ship's deck. One player occupies one seat: ground vehicle -> helm -> ground
vehicle, with no intermediate robot. Recyclers retain their salvaged material.
A completed dock deck stays solid during hull replacement and after dock damage;
the damaged dock's services require repair. Recall requires a clear offshore deck.

## Boundaries and balance

- One vehicle slot; tanks and the two utility rovers only. Rail cannons and
  buildings cannot be loaded.
- A player may load their own vehicles or abandoned guest equipment the host
  can manage. Any pilot may drive existing cargo off; ownership never transfers.
- A short, bounded ground search rejects loading through walls or water and
  unloading onto occupied or blocked land. A failed transfer changes no state.
- One transport per owner and the existing four-ship total campaign limit.
- Provisional cost: 200 supplies, or 120 through a supported factory order.
  Transfers cost no supplies. Hull health uses the existing 300-HP naval model;
  the name does not introduce a separate vehicle armor calculation.
- Cargo cannot move, collect, attack or be directly targeted aboard the ship.
  Its ownership/population slot remains reserved, preventing replacement farming.
- A loaded transport cannot be recalled. Its bow turret replaces the gunship's
  aft turret; double-clicking never creates an extra ready mount.

## Saves and loss

The ship embeds the original vehicle record, including ID, owner, health,
weapon choices and recycler cargo. Loading removes the active ground record in
the same database transaction. Utility durability remains in the logistics save.
Completed tank-pod floors are retained. Unloading restores the same record and
clears the bay atomically. Repeated identical transfer requests are no-ops.

Restart preserves the bay and ownership limits. If the transport sinks, the
carried vehicle is destroyed, including any unshipped recycler cargo. A tank
retains its destroyed identity and original pod site for the normal funded
replacement flow; utility vehicles can be deployed again. No cargo is silently
duplicated, automatically delivered or converted into supplies on loss.

The first implementation does not add cargo transfer animations, multiple slots,
passenger seats, aircraft carriers, large transport hull physics or sea salvage.

## Validation

Unit and HTTP tests cover mount counts, ground clearance, occupied vehicles,
ownership, bridge-builder locks, cargo limits, duplicate requests, saved transfers
for all three vehicle types and transport loss. Desktop and phone browser tests
cover catalogue deployment, loading, reload, helm controls, remote shore access,
walking on the offshore dock, driving aboard and returning directly to recycler
controls on another shore. New verification screenshots are local under `.local/`.

Local tests do not prove sustained four-player capacity on the Fly instance.

## 13 October boarding and replacement correction

Playtesting reported difficulty boarding at the dock and replacing destroyed
ships. Two reproducible problems were corrected locally: E previously preferred
a recycler over a nearer ship boarding point, and replacement reused new-dock
placement checks, allowing a robot standing on the existing shore platform to
block the replacement hull.

E now selects the nearest enabled interaction while preserving vehicle exit.
Ship selection prefers available seats; its button names the vessel. The dock
marks the shore boarding point and the transport loading ramp. The author's
clarification also authorizes walkable offshore decks and direct vehicle handoff,
as described above. Ship hulls remain water-only and reject dock flooring.

Deploy -> Navy -> select the destroyed vessel -> Rebuild at dock reuses the
saved berth, charges the normal vessel price and retains the saved dock. No
separate fabricator is required. The 12-second preparation timer and normal hull
arrival animation remain. Clear the water berth; a destroyed dock needs Logistics
(L) repair first. The controls now display the reason when rebuilding is blocked.

Tests cover all three naval types, shore occupancy, repair and berth constraints,
once-only payment, persistence and boarding the replacement. The desktop and phone browser scenarios walk onto the pier, board with E/button,
drive a recycler onto the ramp, sail across the channel and drive off. Additional
HTTP checks retain one driver and one vehicle record through restart for tanks,
recyclers and builders. No new building or resource cost is introduced.

# Armored transport - vehicle ferry stage

12 October 2026. The author approved completing the bridge and transport pipeline,
then committing and pushing it. A bridge provides a permanent ground route; this
ship carries a vehicle to a coast without a crossing. The existing gunship and
submarine retain their weapons and saved identities.

## Player loop

1. Deploy **N-03 Armored transport** from Deploy (B), Navy. It uses the existing
   unfolding shore dock and requires friendly construction support at that dock.
2. Park an unoccupied tank, recycler or bridge builder within four tiles of the
   shore boarding point. Stop any recycler remote orders; a working bridge
   builder must finish its crossing first.
3. Board the transport with E, select the vehicle in its bay controls, then press
   **K / Load vehicle**. The bay visibly contains the selected vehicle.
4. Sail with W/S and A/D. Its one bow turret fires with LMB; RMB operates the
   port/starboard side guns. The bow turret retains HE, Fire and Gas (1/2/3),
   two barrels, six-second reload and the existing 6-40-tile naval range.
5. Stop at a dock, or use **G** to deploy a shore ramp beside clear land. Press
   **K / Unload vehicle**. The server selects a reachable, vehicle-width land
   position beside the shore point, leaving the pilot's exit clear.
6. E disembarks, then E boards the delivered vehicle. Retract G before sailing
   away from a temporary shore ramp.

This is an instantaneous, validated cargo handoff using the ship's shore access,
not autonomous vehicle driving across a new general-purpose walking bridge.
No passengers remain inside the cargo vehicle. Recyclers can carry salvaged
material; "empty vehicle" means unoccupied, not an empty salvage compartment.

## Boundaries and balance

- One vehicle slot; tanks and the two utility rovers only. Rail cannons and
  buildings cannot be loaded.
- A player may load their own vehicles or abandoned guest equipment the host
  can manage. Any pilot may unload existing cargo; ownership never transfers.
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
unloading and boarding the delivered recycler. Previews are in `docs/previews/`.

Local tests do not prove sustained four-player capacity on the Fly instance.

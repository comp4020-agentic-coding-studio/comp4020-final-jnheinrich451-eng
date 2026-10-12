# Orbital reclamation and salvage

12 October 2026. The earlier cosmetic-cleanup idea is now the mobile recycler in
[Construction and logistics](CONSTRUCTION_LOGISTICS.md), with its supplies contract
in [Economy design](ECONOMY_DESIGN.md). Implemented locally.

An orbital pod delivers a remotely commanded recycler. It drives to permanently
conquered hostile structures, collects finite salvage and removes their central
ruin artwork after depletion. Collection preserves the site ID, completed objective,
conquest history and settlement checklist. It never revives sites, changes build
permission, deletes player construction or resets the world.

Collected material is cargo until unloaded at a fixed launch station and sent to
orbit by rocket. The cargo, collection state, depletion flags and shipment progress
are saved. The sender and recycler can be destroyed; unshipped cargo remains
recoverable. No cosmetic cleanup of ordinary bodies or craters is included.

The earlier environment modifier still clears its cosmetic coating on conquest.
That is separate from collecting the ruin's material. Planetary-scale performance,
final materials and sound remain later work.

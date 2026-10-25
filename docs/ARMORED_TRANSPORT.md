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

- Press **K** at the helm or on foot within four tiles of an unoccupied
  transport's loading gate to drive its carried vehicle onto the dock or shore.
  On foot, the **Drive vehicle off / K** button provides the same action.
  A blocked exit rejects the transfer and leaves the vehicle aboard.
- Manual drive-on follows the vehicle's heading: W drives forward, S reverses,
  and A/D steer. Turning alone does not board the transport.
- Sunken hulls and sea salvage markers render below live vessels; their salvage
  remains available even when a replacement ship occupies the same berth.

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

## LCU redesign, 24 October 2026

The author asked for the transport to follow the USAV Coamo / LCU-2000 class,
with the vehicle entrance at the bow (not the stern), and supplied a plan sketch
and turret sketches. The approved decisions were:

- **Bow ramp.** Large transports now land vehicles over a ramp straight ahead of
  the stem (the same 3.5-tile reach and width checks as the old stern ramp).
  Remote **Shore** orders also try bow-facing headings, so they beach bow-first.
  G deploys the ramp at the bow. Legacy 2 x 4 transports keep their side shore ramp.
- **Docked loading: pier side gate.** At a dock the bow faces the sea, so
  vehicles cross a side gate from the pier into the forward well, 0.2 x hull
  length ahead of midships (`TRANSPORT_WELL`). Docking orientation is unchanged.
- **Stern triple turret.** The single main turret moved from the bow to the stern
  (y 1.35 in mount units) and fires three shells per volley, up from two, at the same
  per-shell damage (+50% per volley). Ammunition, reload and range are unchanged.
  It keeps the saved id `fore` and key `turret`, so reloads, in-flight salvos,
  recoil and bearings survive the move; only the HUD label reads STERN.
- **Open side guns.** The two single side guns moved aft beside the turret
  (x ±0.58, y 1.2). Arcs, damage and cadence are unchanged. Carrier side guns keep
  their old positions.

Art (`public/transport-art.js`): a slim hull drawn at 70% of the saved width
(about 3.2:1) inside the saved 4.5 x 10 rectangle (78% for legacy hulls). It has
a blunt bow ramp, anchors, an open vehicle well narrowing with the bow, dashed pier
gate marks, and cargo shown in the well. Behind it are a bridge deckhouse with
wheelhouse, wings, mast and twin exhausts, then the Des Moines style triple turret
and open shielded side guns. Drawn ramps start at the painted hull side.

Save notes: a stern ramp already deployed in a save is no longer a valid loading
point. Retract it (G, or any Move/Shore order) and redeploy at the bow; retraction
is unconditional on the server. No records are migrated or removed.

Local validation:
- TypeScript passes.
- Domain tests: 363 of 366 naval/transport tests pass. The three failures are the
  existing Bulwark rail-HE expectation and two campaign sentry-receipt/stream tests,
  which do not involve ships.
- Updated stern expectations now cover bow landing, side and stern rejection, the
  pier gate and three-shell salvos.
- A new domain test loads and unloads at the pier gate; a new HTTP test boards,
  loads, restarts and unloads a large transport across that gate.
- Browser: naval scale and remote branches pass at desktop and phone sizes.
- The older transport and shore-ramp browser specs fail on stale expectations from
  before this stage: the dock-first transport card, and a "Board ship / E" label
  that now names the vessel. Both need test maintenance (logged in
  `.local/transport-stage-browser.log`).
- Live 1920x1080 and 390x844 screenshots of a moored large transport with the pier
  gate are in `.local/transport-live-*.png`.
- Not committed, deployed or playtested by the author.

### Proposal: longer, slimmer saved transport hull (not authorized)

The author wants the transport physically slimmer and longer than the sketch.
This pass is art-only. A later stage could save a new hull size for new large
transports only (for example 3.6 x 12, inside the 8 x 14 berth), keeping existing
transports at 4.5 x 10. It would need:
- dock/berth clearance and departure-water checks;
- bridge underpass and narrow-inlet routing;
- bow-ramp and pier-gate reach;
- remote shore planning distances;
- wreck, recovery and replacement footprints;
- legacy-save tests.

Costs and capacity are unchanged unless the author decides otherwise.

# Bomber and support network

Design record, 14 October 2026.

The economy and support branch is now implemented locally in
[Shared economy and support network](SUPPORT_NETWORK_STAGE.md), following the
author's later instruction to build it before bomber automation. That stage record
supersedes the unimplemented status of the relevant proposals below. Automatic
bomber missions, new payloads, power simulation and friendly-wreck recycling remain
future work.

Original design record: These are the author's requested direction and
proposed implementation stages, not changes to the running game. Open decisions
below must not become implicit defaults. This record refines the future direction
in AIR_FORCE.md and ECONOMY_DESIGN.md; their implemented rules still run today.

## Bomber role and existing baseline

Reach isolated hostile facilities quickly, deliver destructive support, and return
an expensive aircraft safely. Enemy anti-air makes route and timing matter.

The existing bomber drops six HE bombs per run, with two runs per load. The player
flies it directly and returns to its own airbase to land and rearm. Spore flak
already attacks aircraft. The attack jet is a separate existing aircraft role.
Incendiary/gas bomber loadouts, a single heavy bomb, and automatic strike missions
are not implemented. Ground servicing currently restores hull HP without a SUP
charge; logistics-enabled aircraft replacement already costs SUP.

Keep these choices separate so they can reuse the same bomber:

| Choice | Meaning | Status |
| --- | --- | --- |
| Control | Pilot directly, or order a strike and automatic return | Automatic mission requested |
| Release pattern | Existing carpet, potentially one heavy bomb | Heavy bomb is optional; not a new aircraft type |
| Warhead | HE, potentially incendiary or gas | HE exists; other loadouts remain the earlier proposed extension |

The earlier suggestion of additional bomber weapons did not require another jet
type. Do not build every combination in the first mission stage.

## Requested bomber card

- **Role:** fast support against isolated enemy facilities; mark an area, dispatch
  the bomber from its base, bomb it, and return automatically.
- **Support:** an operational airbase now; aircraft carriers later. Hull servicing
  should charge shared ground supplies for actual HP restored, independently of rearming.
- **Weakness:** hostile anti-air, aircraft loss, and loss of its support base.
  Automatic flight receives the same damage and obeys the same flight limits as
  manual flight. An order is not a guaranteed hit or guaranteed safe return.
- **Cost and limits:** confirmed one free bomber delivered to an existing airbase,
  once per campaign. This does not include a free airbase or a per-player grant.
  Subsequent deliveries use the shared deployment rules below. Persist redemption
  with successful delivery admission; rejected orders must not consume it, and
  reconnecting, rebuilding a base or changing accounts must not renew it. Existing
  campaigns need an explicit migration rule because bases currently include aircraft.
- **Persistence:** aircraft loss leaves a wreck. Paid drone reconstruction restores
  the aircraft at a valid base; the old crash trace remains independently. Salvage
  and reconstruction must never duplicate a hull, cargo, or resource reward.

## Recommended first playable stage: an automatic HE sortie

Player story: remain with the ground force, mark a dangerous isolated position,
and watch an available bomber fly a real attack and return. Reuse the existing
six-bomb HE pattern first. Preview its footprint and approach bearing.

Proposed states:

`ready -> assigned -> takeoff -> approach -> release -> return -> landing -> service -> ready`

Aircraft destruction terminates the mission and leaves loss/recovery state.
Reject orders for occupied, destroyed, assembling, servicing or already assigned
aircraft. One accepted mission per aircraft; reserve the aircraft atomically so
two teammates cannot dispatch it together. No infinite mission queue. The caller
keeps their robot/vehicle; do not create a second pilot body.

Use a fixed accepted target, not a homing guarantee against moving enemies. Choose
a legal approach and release path within the map before admission. Aborting before
release should return the aircraft; already released bombs keep their accepted
effects. Success means the sortie and recovery completed, not necessarily that the
target was destroyed. Expose approaching, releasing, returning and lost feedback
to the room; automatic attacks must remain understandable to other players.

Save mission identity, target, phase, aircraft pose, ammunition and service costs.
Reconnect must not dispatch again; restart must not duplicate a release or refund
spent bombs. Reuse the campaign's established projectile persistence policy.
Pause and owner disconnect follow room lifecycle rules; no offline sortie progress.

Before coding, settle failure recovery when the home base is destroyed or its
landing approach is blocked. A compatible alternate base requires the later
aircraft/base separation; do not silently teleport or circle forever. The first
stage can stay tied to one base, with an explicit bounded failure/recovery rule.

Acceptance: one dispatch shared across two clients; actual flak damage; legal map
edge approaches; no duplicate release after reconnect/restart; successful landing;
visible rejection of competing/manual boarding orders; loss and base-loss recovery.
Measure active missions with existing projectile/entity caps before expanding the
roster. No claim of four-player Fly performance follows from this design record.

## Shared deployment and servicing direction

| System | Current behavior | Requested direction |
| --- | --- | --- |
| Orbital placement | Large infrastructure needs a core/factory construction circle | Global delivery without that support-circle requirement |
| Local construction | 60% of orbital cost, 20 seconds | 25% of orbital cost, 60 seconds as the proposed baseline |
| Arrival time | Existing per-type timers | Heavier equipment takes longer; exact classes/timers remain open |
| Aircraft hull repair | Full health restored during free rearming | Ground supplies charged in proportion to actual HP restored |
| Core salvage reception | Recycler unloads at rocket launch stations | Add receivers to cores and the proposed support outpost |

Global orbital deployment still needs legal land/water, clear footprints, valid
runway approaches, ownership, SUP and capacity. Conquest does not gate placement.
Blue circles would describe local construction support only. Orbital delivery is
the faster, more expensive method; local drones are the slower, cheaper method.
Resolve whether weight changes local construction too before applying the one-minute
baseline globally. Keep timers authoritative on the server; drones are cosmetic.

Recommended repair reuse: charge only for HP actually restored, stop at full HP or
insufficient SUP, and checkpoint health with payment. Exact aircraft rates remain
untuned. Preserve ammunition and ordinary revival rules unless changed separately.
Keep emergency core/HE-tank recovery so poor spending cannot end the campaign.

The author mentioned broadcasting both deployment methods to everyone. Proposed
interpretation: all room members see accepted orders, delivery/assembly progress,
completion and failure. This is not a separate free grant to each connected player;
the meaning still needs confirmation.

## Core receiver and small support outpost

Confirmed: a 2-by-2 support outpost with a power/core module, a recycler receiver
and two supporting-machinery tiles. It also allows robot respawn and provides
local construction support. Exact artwork, support radius and respawn exit remain
to be specified. Reuse shared friendly respawn selection; a destroyed or unfinished
outpost must not be selectable, and its exit must have a safe clear position.
Energy generation is a new design branch: capacity, consumers, connections
and outage behavior are undefined. Do not introduce upkeep or disable existing
equipment based on a placeholder power value.

Add a receiver by replacing one internal cell of the first drop pod's support
core. Recommended: preserve its existing sentry, robot exit, outer footprint and
unfolding panels; select an ordinary internal module. Final layout remains open.
Migrate existing cores without resetting progress or overwriting adjacent objects.

Currently the recycler transports raw salvage. It becomes shared spendable SUP
only after rocket shipment. The author refined this into two processing branches:
local recycling with a cheaper construction cost, and rocket shipment to orbit.
The mobile recycler remains the collector/carrier; the local receiver/processor
and rocket station are destinations, not additional vehicle types. Exact local
processor price and conversion yield remain untuned.

**Confirmed by the author: separate ground and orbital supplies.** Both balances
are shared by the campaign, continuing the existing cooperative ownership model.
This replaces the proposed single-pool alternative, but is not yet implemented.

| Balance | Earned through | Spent on |
| --- | --- | --- |
| Ground supplies | Local processing of collected salvage | Local construction and repairs, including dock/airbase hull servicing |
| Orbital supplies | Cargo delivered to orbit by rocket | Orbital deliveries |

Raw salvage remains cargo until processed or shipped; it is not a third spendable
currency. The player chooses which branch receives a batch. No batch may be
processed locally and also shipped for a second reward. A ground repair can service
an orbitally delivered vehicle; spending follows the action, not the vehicle's origin.
The 25% local-build price is a proposed numerical comparison to the orbital price,
not an exchange rate between balances. Costs and conversion yields need playtesting.

Implementation must define initial balances, caps, the existing passive reserve's
destination and old-save migration. Never copy the full old SUP balance into both
new balances, or grant starting resources again on reconnect. Also map outstanding
construction payments, cancellation refunds and shipments to the correct balance;
refunds should preserve the currency actually paid. Keep emergency core/HE-tank
recovery possible even if one balance is empty. Direct currency exchange is outside
the confirmed design. These remaining details do not reopen the agreed split.

## Reusable cargo rocket

Requested: a return/landing animation and a cooldown limiting shipment frequency,
with **two minutes** suggested by the author as provisional tuning. This concerns
the logistics cargo rocket, not the missile battery. The returned rocket is reused
at its launch site; avoid implying a new purchased rocket on every shipment.

Recommended first interpretation: a 120-second minimum launch-to-launch cycle
per station, including ascent, unloading in orbit, return, landing and readiness.
Show the remaining time; return should not add an unexplained second cooldown.
Exact phase lengths remain open. Suggested states:

`ready -> launching -> delivered -> returning -> landing -> ready`

Consume stored cargo once at launch admission and credit orbital supplies
once at delivery. Landing credits nothing. Save rocket phase, remaining cycle time,
shipment identity and credit status together; pause/offline time must not advance
shipments or readiness. Keep the existing finite storage limit and reject launch
while the previous rocket is away. Recommend allowing truck unloading during the
cycle while storage has room; feedback must distinguish stored and in-flight cargo.

Before implementation, define station loss while a rocket is away: retain already
delivered rewards, never also drop that delivered cargo, and never land on a deleted
station. Pending cargo loss/recovery and a rocket with no surviving pad need explicit
rules. Rebuilding/dismantling must not reset an active shipment into a duplicate
credit or bypass its saved cooldown. Multiple stations may increase throughput;
keep existing facility caps and assess that trade-off rather than assuming a global
two-minute limit. These are proposed safeguards, not new runtime behavior.

## Wrecks and recycling

The author wants destroyed facilities to be recyclable too. Existing conquered
hostile facilities already provide finite salvage; do not pay again for conquest.
Friendly equipment salvage is a separate extension, not implemented by this note.

Recommended rules: recover only a fraction of actual paid cost, not the full
orbital catalogue price of a discounted build. Free recovery equipment must not
generate a profitable build/destroy loop. Reclaimable carried cargo and hull value
are separate. Use saved once-only wreck/depletion IDs, bounded wreck counts and
atomic collection. Salvaging a repairable wreck must explicitly retire or consume
that wreck's rebuild entitlement; never recover and recycle the same object twice.
Exact yields, airborne crash placement and ocean wreck accessibility remain open.

## Open decisions and stage order

1. Define local conversion yields, initial balances/caps, passive income and old-save
   migration for the confirmed ground/orbital split without duplicating supplies.
2. Confirm the rocket's provisional 120-second cycle interpretation and station-loss
   recovery before implementing shipments. Tune processor price/yield separately.
3. Define outpost support/respawn geometry, energy consumers and the existing-save
   rule for the confirmed once-per-campaign free bomber.
4. Confirm deployment broadcast meaning, weight timings and the first mission's
   base-loss/blocked-landing recovery before their respective implementations.

Recommended order: automatic HE sortie on the existing bomber; paid aircraft
servicing and explicit wreck/rebuild recovery; global orbital versus local build
rules; receiver/outpost and salvage extension; then extra bomber loadouts, alternate
airfields and carrier support. Reassess each through playtesting. This records the
whole network without treating all its branches as one implementation batch.

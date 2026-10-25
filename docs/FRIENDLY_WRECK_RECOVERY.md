# Friendly wreck recovery

Implemented locally, 23 October 2026. This is stage 3 of the vehicle polish plan.

## Playing

- On land, drive a recycler within two tiles of a friendly wreck and release
  movement. After the usual stationary half-second, it collects automatically.
  Logistics also lists land wrecks for remote collection orders.
- At sea, carry a recycler in an armored transport, approach within two tiles of
  a sea wreck and select Stop. Once speed and turning settle, collection begins.
  A bridge builder or tank in the bay cannot recover salvage. Moving pauses work.
- Recovery fills the recycler's existing 180-unit hold at 20 units/second.
  Sea work commits in half-second batches. The transport panel shows progress
  and HOLD FULL. Drive the recycler off at a dock/ramp to use normal unloading.
- A core/outpost processes raw salvage into GND. A launch station ships it to
  orbit for ORB, retaining its existing launch timer and cooldown.

## Value and saved state

The user approved **50% of the actual payment as raw salvage**, regardless of
whether the purchase used GND or ORB. Fractional halves are retained. Local
discounts, exchange credits and free deliveries affect the amount actually paid;
the catalogue price is never substituted. Free assets and old assets without a
known receipt yield no hull salvage. Stored cargo remains recoverable separately.

Every new recyclable purchase records its payment in the same transaction as the
asset. A separate logistics receipt map supports legacy tables with fixed columns.
Existing ship/aircraft receipts are usable; unknown older prices are not guessed.
Each wreck has one saved remaining balance. Exhausted entries remain as tombstones,
and repeat destruction handling or restart cannot refill them. Purchase identities
distinguish successive aircraft delivered into a reused aircraft slot. Legacy
bundled ship payments do not also grant a second dock refund.

Land balances and recycler cargo save together in logistics. Sea transfers save
the ship's carried cargo and the wreck balance in one checkpoint; failed commits
restore both amounts. Two collectors draw from the same authoritative balance.
Sunk transport cargo is recorded at the sinking location, including its stored
salvage, rather than returning a tank wreck to its original drop site. Helicopter
cargo lost over water can now also be recovered by sea. Existing land cargo
crates retain their normal handling. Cancelled construction keeps its existing
refund and does not additionally create wreck salvage.

## Presentation and boundaries

Destroyed land vehicles use scorched, cracked metal plates and exposed frames
matching the facility ruins. Labels show remaining salvage; nearby overlapping
losses share a label. Exhausting salvage leaves the ruin and loss history intact.
This does not restore units, reverse conquest, consume a live facility slot, or
change the existing construction/placement rules. Sea hull wreck artwork remains.

Focused tests cover paid/free/unknown purchases, fractional local prices,
simultaneous collectors, partial collection, restart, remote orders, supply
processing, sea stopping/capacity, rollback, cargo transport and repeated aircraft
deliveries. Desktop (1920 x 1080) and phone (390 x 844) browser checks cover wreck
rendering, the logistics list, carried cargo updates and reload; screenshots were
inspected. No Fly load-capacity claim is made by these checks.

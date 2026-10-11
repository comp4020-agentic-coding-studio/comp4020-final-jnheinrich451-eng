# Economy — first-stage design

10 October 2026. The author has reopened economy design after the first conquest
encounter. The 9 October deferral is superseded for design work; the game still
has no active economy. Ownership, sources and the first spending scope are awaiting
answers. Do not turn the recommendations below into implemented rules prematurely.

## Purpose requested by the author

Let players enjoy heavy military equipment, learn to balance their forces, and
feel a meaningful consequence for unsuitable operation. Economy should support
the combat/conquest loop and provide recovery after mistakes. The goal is not
maximum scarcity or long waits before using the interesting equipment.

## Recommended small first version — awaiting decisions

Use one abstract supply resource before adding fuel, metal, ammunition or supply
transport. Prefer a shared campaign stockpile, matching shared conquest and saves.
Everyone's spending would be visible to the room; personal balances and spending
permissions would need a separate decision if desired.

Proposed sources: an initial reserve, modest income during running simulation,
and a once-only conquest award. No income during solo pause, owner reconnect
freeze, room closure or offline time. Do not multiply income by the number of
players, reconnects or newly created cores. A storage cap could later prevent
unlimited idle accumulation; its necessity and value are still open.

Proposed spending: equipment deployment and replacement first. Ordinary shots
and robot recovery remain free. Keep an initial core/recovery route available,
so a player cannot spend the campaign into an unrecoverable state. Expensive
equipment should produce a substantial, visible benefit in its intended role.
Per-shot costs, upkeep, repairs, salvage and dismantling refunds remain later
decisions, not default behaviors.

Do not simply add a price to an existing permanent ownership cap: first establish
which destroyed objects can be replaced, what remains of their footprint, and
whether replacement removes or reuses an old record. Tanks, ships, aircraft and
static facilities currently have different destruction/recovery coverage. Charging
for loss is meaningful only where loss and replacement actually work.

## Three decisions requested

1. Shared campaign supplies or separate player supplies?
2. Equipment deployment/replacement costs first, or ammunition costs as well?
3. Starting reserve + active income + conquest awards, or reserve + conquest only?

Exact costs, income, rewards, storage cap and existing-save starting credit remain
untuned. Existing equipment should not be silently deleted or retroactively charged
when introducing economy. Agree the migration credit and starter loadout before
enabling spending on real saved campaigns.

## How to learn balance from the first version

Measure a few combat decisions rather than choosing every price independently:

- Time until the player can use their first heavy weapon.
- Which useful loadouts the starting reserve affords, including one eligible HE
  platform for the station. There must be no conquest/equipment funding deadlock.
- Income and expenditure per completed assault; time to recover from losing a tank.
- Whether a cheaper mixed force can solve a problem that mass heavy weapons cannot.
- Whether passive waiting is more rewarding than advancing; adjust that incentive.
- Whether a new teammate helps without granting duplicate starter money or
  immediately consuming the room's only recovery path.

Tune one variable at a time through comparable solo and cooperative encounters.
Keep technical entity caps separate from prices; enough money does not authorize
an unbounded server workload. Permanent conquered sites never reset to farm rewards.

## Current behavior

Deployments have no resource price. Existing terrain, footprint, ownership,
population and facility caps still apply. Those caps control gameplay/runtime
cost; they are not a currency or a completed economy. Campaign creation and
planet selection do not grant, spend or display an invented balance.

## Decisions to fill in later

- Purpose: what useful combat choice should scarcity create?
- Resources: what, if anything, is collected or produced?
- Ownership: shared campaign stock, personal stock, or another model?
- Sources: objectives, enemies, time, production, or a combination?
- Spending: construction, ammunition, repairs, replacement, or something else?
- Recovery: how does a player continue after losing equipment or all cores?
- Joining/leaving: what happens to a teammate's resources?
- Persistence: which balances and transactions survive a session/restart?

Earlier passive income and support-resource ideas remain proposals. No values,
prices, unlocks or resource types are settled by this placeholder. Permanent
conquest and globally available deployment remain the agreed boundaries.

## Future integration boundary

When authorized, economy belongs to the server-owned campaign state, with a
versioned save migration. Deployment should validate the action and its cost
before changing either balance or world; both changes must commit together.
Objective rewards need a saved, once-only award so reconnect/retry cannot pay
twice. Clients present balances and requests; they do not decide affordability
or grant rewards. Choose the actual schema/API after the rules above are agreed.

Future checks should cover insufficient funds without partial placement, failed
placement without a charge, simultaneous spending, reward retries, saved return,
campaign isolation and recovery from an exhausted economy. No runtime stub or
empty balance widget is needed for this stage.

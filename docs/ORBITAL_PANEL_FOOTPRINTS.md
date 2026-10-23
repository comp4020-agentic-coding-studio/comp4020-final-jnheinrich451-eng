# Orbital crates and permanent panels

22 October 2026. The author requested shorter tank pods, payload-sized metal
walls for orbital facilities, staged dock unfolding and heavy panel impacts.
They confirmed permanent walkable flooring with the entire placement preview,
and keeping the runway's current gameplay dimensions for this stage.

## Player loop and placement

Select ORB, inspect the full cross, choose clear land, then watch the crate land
and unfold. One central payload rectangle and four equally sized wall rectangles
form the cross. A 3×3 helipad therefore needs 45 tiles; a 4×4 missile battery
needs 80. A 6×10 airbase remains 6×10 operationally, but its orbital crate needs
300 clear tiles. Local GND construction remains the compact, slower alternative
inside friendly support, with its existing drone bay and worker animation.

Tanks now use a 1×1 centre and four 1×1 walls: five tiles instead of seventeen.
The tank rolls one tile onto the east panel before becoming available. Preview,
admission, collision, local support checks, flooring and art use the same short
cross. Existing tank positions and loadouts are not moved; their pod art and
footprint use the shortened cross. The original core retains its authored
57-tile landing and robot-exit layout.

New orbital sentries, artillery, missile batteries, airbases, helipads, logistics
facilities and logistics vehicles save a separate crate descriptor. This uses
the payload's full footprint, not its damage hitbox. All four walls must fit on
clear land, away from units and existing infrastructure. Errors identify the
blocked wall tile. The accepted cross blocks movement and competing placement
while unfolding. Once ready, it becomes reusable metal flooring; the facility's
own normal collision still applies. Raw terrain is retained beneath the floor.

Existing facilities receive no retroactive walls: adding them could overlap
buildings that were valid when placed. New orbital deliveries get the new
layout. Aircraft delivered onto an existing runway or carrier keep their compact
delivery apron, now with four opening caps; they do not pave over the runway or
sea. Ship replacement remains local drone assembly at the shipyard.

## Dock and impact presentation

The dock retains a 3×1 shore platform and a 3×5 pier, with the ship beside it.
The capsule first spreads its short ends to make the shore strip. The pier then
opens in three groups: the shore-side wall (one row), roof leaves (three rows),
and the outer ocean-side wall (one row). This preserves boarding and navigation
geometry while making the crate's parts visible during assembly.

Metal panels have visible tile seams, hinges, a brief settling motion and dust
at contact. Cargo, aircraft and dock impacts add nearby camera shake, respecting
both reduced effects and the existing shake toggle. Combined camera offsets are
capped. These are client effects; no physical worker or debris entities are
added to the server. Completed crate drawing is culled outside the viewport.

## State and verification

Supply debit, accepted cargo geometry and purchase remain one transaction.
Remaining time is saved and follows the room's simulation clock. Compact cargo
still lands at 1.35s, unfolds from 1.75–2.6s, and deploys during the following
second. Native core/tank/dock/aircraft timings remain unchanged. On completion,
the saved floor indices are added once. Reopening a campaign preserves both
in-progress reservations and completed floors. No save reset is needed.

Checks cover exact cross geometry, blocked walls, units and map edges, concurrent
admission, restart during deployment, permanent floors, tank rollout, and the
unchanged local build path. Browser checks exercise helipad preview and deployment
on desktop and phone, plus deterministic panel/dock artwork and shake settings.
The images were visually inspected. This stage is local until separately shipped.

Validation on 22 October: typecheck, all 612 tests across 87 files, three browser
checks, process-evidence validation and whitespace checks passed.

## Orbital coverage clarification, 22 October

ORB delivery requires no blue-circle construction support. Clear terrain, full
unfolding-wall clearance, supplies and existing facility limits still apply.
GND construction alone requires friendly support. ORB needs no blue circle.
The later permanent-loss rule in [FACILITY_LIFECYCLE.md](FACILITY_LIFECYCLE.md)
supersedes the original four-pad cap and proposed repair-slot reservation:
eight active or incoming helipads; destroyed pads release their slots and
cannot be repaired. The placement panel reports the cap separately from coverage.

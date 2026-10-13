# Construction feedback and reusable shipyards

13 October 2026. This record separates the first local implementation from the
agreed direction for later playable stages.

## Player story

Deploy support equipment, see it arrive and become usable, then recover from a
lost ship without mistaking an ownership cap for insufficient supplies. Construction
should feel physical while keeping the server's work bounded.

> The dock-first refinement below supersedes the earlier menu and per-type fleet rules.

## Stage 1: construction presentation and naval actions (local)

- Launch stations and factories arrive in capsules and assemble from the ground
  upward. Up to three cosmetic drones fly from the nearest completed friendly
  core/factory, work around the site, and return as assembly finishes. If that
  source disappears, presentation can use the delivery point instead.
- Recyclers and bridge builders arrive in small opening capsules before their
  vehicle artwork becomes fully visible. They remain separate vehicle deployments.
- Existing server countdowns remain authoritative: eight active seconds for
  logistics buildings and 4.5 seconds for these utility vehicles. The client
  derives the animation from saved remaining time, interpolates at most 0.1 seconds,
  and cannot make equipment ready. Pause/disconnect stops that interpolation.
- Drones have no server entities, collision, health or pathfinding. Reduced
  effects retain phase labels and progress, use one worker, and omit the falling
  motion, dust and sparks. Existing fog still conceals the rendering beneath it.
- Naval cards now say Deploy, Manage existing or Rebuild at dock. Selecting an
  owned vessel opens its existing controls rather than leaving its card disabled.
  A lost gunship costs 240 supplies to replace; 423 is sufficient provided the
  other existing gates permit it. The server still checks the berth, dock,
  cooldown, robot state and funds, and charges only once.

Stage 1 alone changes no prices, caps, save format, damage rules or placement rules.
The current fleet still permits one vessel of each type per owner and four total.
Owning a live vessel does not allow buying a second of that type. The batch below extends hull replacement to independent shipyards.

### Review and evidence

`tests/browser/construction-presentation.spec.js` checks desktop and phone access
to a seeded lost gunship with 423 supplies, paid replacement without a duplicate
hull, and the live-vessel management action. It renders saved construction phases
through the actual renderer, checks stationary paused frames and server-owned
completion, and exercises reduced effects. Local screenshots are under `.local/`.
Type checking and repository evidence validation also passed.

These checks establish local behavior, not Fly deployment or multiplayer capacity.
Playtest whether the arrival and working drones are legible at normal zoom, and
whether the replacement controls explain why an action is unavailable.

## Stage 2: reusable shipyards (implemented locally in this batch)

The author approved implementing the remaining batch and deploying it on 13 October.
Permanent docks now have independent saved identities. Migration backs up populated
naval saves before copying existing dock geometry and durability references; it
neither moves equipment nor charges for those records. Ships retain compatibility
fields linked to their shipyard.

- Deploy > Naval > Shipyards can deploy an empty yard for 120 supplies. The initial
  orbital ship-and-dock packages retain their existing prices. A yard builds or
  rebuilds a gunship for 240, submarine for 280, or transport for 200 supplies.
  These are provisional prices, intentionally preserving the established ship
  quotes while adding an optional forward replacement base.
- One hull is assigned to each yard. The existing one-vessel-per-type-per-owner
  and four-vessel campaign caps remain; separate yard limits are four per owner
  and eight per campaign. Owning more yards does not bypass the fleet cap.
- New hulls at a completed yard take 12 active seconds to assemble, with cosmetic
  workers arriving from its dock and a progressively revealed hull. Construction
  reserves the water berth; the hull is unavailable until the saved timer completes.
- A destroyed vessel can be rebuilt at its original yard or another empty owned
  yard. The destruction cooldown still applies. Admission validates ownership,
  supplies, capacity and berth clearance; retried accepted orders do not charge twice.
- If a yard is destroyed, assembly pauses. An eight-second, 90-supply Logistics
  repair resumes it. Ships already at sea survive dock loss. No ongoing core
  presence, simulated worker pathfinding or additional upkeep is required.
- Retire vessel / keep shipyard requires disembarking at its home berth (or a
  destroyed hull), no cargo and clear deck access. It pays no refund. An empty
  completed yard can be dismantled separately once its deck and berth are clear.
  In-progress hull assembly must finish before voluntary retirement.
- Sinking leaves a saved cosmetic wreck at the loss position, even after replacement.
  Only the latest 24 traces remain. They neither block navigation nor award salvage.
  Hull loss, trace creation and pilot/cargo consequences share the checkpoint.

## Stage 3: defensive shore ramp (implemented locally in this batch)

Deploying the ship's existing G shore ramp also deploys its built-in sentry;
retracting G folds both away. It acquires ground enemies and swimmers within ten
tiles (ordinary APCR sentries acquire within seven), turns using the existing
sentry mount speed, checks cover and fires ordinary APCR projectiles at most once
per 0.3 seconds. Shared projectile caps and friendly immunity still apply.

The sentry has 140 HP and armor 2, can receive the existing facility attacks, and
retains damage, bearing and reload state across folding and restart. It does not
fire while folded, destroyed, submerged or on an unfinished/lost ship. A 25-supply
service at an intact dock restores it: surface, dock and disembark first. A paid
replacement hull also includes a fresh sentry. Permanent yards do not gain a free
sentry; shore defenses remain separately deployed equipment.

These values need playtesting. Enemy swimmers still attack the hull; the shore
sentry is a ground-facility target for enemies able to reach it. This update does
not claim to extend every hostile weapon to every facility type.

## Batch validation and review

Local validation: pnpm check passed 54 files / 332 tests; desktop and phone
construction/shipyard browser checks passed, with screenshots inspected. Type
checking, whitespace checks and repository evidence validation passed. Deployment
status is reported after the GitHub workflow finishes; these are local results.

The added shipyard tests exercise legacy migration/backup, paid empty-yard orders,
idempotent admission, replacement at another yard, damaged-yard interruption,
repair/resumption, retirement without dock deletion, saved return, bounded wreck
geometry, real projectile hits on swimmers/crawlers, and folded/destroyed sentry
behavior. Existing replacement tests now wait for the new 12-second construction.
Desktop/phone browser scenarios exercise the 423-supply case, empty-yard placement,
insufficient-funds feedback and the construction renderer. They capture screenshots
in the ignored .local directory for visual inspection.

Check online after deployment: whether building feels clear, whether the sentry
provides enough time to load or leave a ship, and whether shipyard prices make
forward recovery worthwhile. Resource capacity for larger armies remains unmeasured.

## Dock-first refinement (13 October, local)

The author found Build type and Selected vessel confusing. The current interface
has one shipyard panel: Deploy > Naval keeps the three ship cards, but choosing a
card opens a dock's controls. Deploy shipyard places the empty 120-SUP dock first.
Standing on an owned completed dock and pressing E (or its touch button) opens the
same panel. An empty/lost slot shows the three direct build choices; an occupied
slot shows its assigned ship, health, boarding and management actions. With several
docks, one selector chooses the dock. Each unavailable hull choice shows its reason.
Opening the panel stops held movement and firing; Escape closes it.

Each dock reserves one assigned vessel, including while that vessel is at sea or
under construction. The server checks that individual slot, rather than comparing
worldwide totals that could accidentally unlock a different occupied dock. Different
docks can build the same ship type. The campaign cap remains four active ships;
lost hull records do not consume that active cap. Yard limits remain four per owner
and eight per campaign. This supersedes the older one-per-type rule. Replacement
can choose a different type, charges that type's price, preserves the wreck, and
retains the twelve-second construction and destruction cooldown gates. Existing
ship-and-dock API orders remain compatible with older clients; the new UI uses
separate dock and hull orders. No existing save or vessel is removed.

Retiring a vessel keeps its dock, so standing on that retained deck is safe. Cargo
must still be unloaded and the crew must disembark. Dismantling the empty dock
continues to require a clear deck and berth. Both actions pay no refund.

The author confirmed automatic, supply-funded dockside repairs. Hull repairs use provisional tuning: 10 HP per active second at 0.2 SUP
per HP actually restored. A ship must be operational, surfaced, stationary and
aligned at a completed intact dock (including a teammate's); a shore ramp does not
qualify. Recent damage delays repair for five seconds. Repair stops when sailing,
submerging, losing the dock, exhausting supplies or reaching 300 HP. It creates no
immunity. Health and the supply charge checkpoint together in half-second batches;
unused/paused rooms gain no offline repairs. Up to three cosmetic workers reuse the
construction renderer, one in reduced effects mode. No worker simulation is added.
Ramp-sentry repair remains the separate 25-SUP service.

Validation covers slot occupancy while at sea, owner checks, active fleet limits,
same-type ships at separate docks, retry charging, missing-health/funds caps, damage
cooldown, invalid repair states and health/payment persistence. Browser coverage
uses keyboard and touch, the 423-SUP replacement case, readable failure reasons,
retiring/dismantling, submarine controls and direct transport boarding.

SMTP status is separate from game changes: on 13 October the author reported Brevo
reactivation. Connection, required TLS and authentication were verified from Fly
using its deployed configuration, without sending an email. Actual delivery still
needs an author-requested registration or password-reset test.

A visiting friendly ship remains boardable from the dock panel without taking over
the dock's assigned production slot. This preserves access for teammate transports.
Local review passed the 54-file / 341-test full check, the expanded focused shipyard
checks, and desktop/phone naval UI scenarios. Screenshots were inspected; a repair
label overlap was corrected. Deployment is verified separately after the release push.

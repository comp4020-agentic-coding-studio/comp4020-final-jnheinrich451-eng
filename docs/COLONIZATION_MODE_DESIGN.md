# Frontier colonization mode design

1 November 2026. The author confirmed a separate peaceful mode set after military
conquest. A later expedition arrives aboard another ship, operated by preserved
human heads with AI assistance, to adapt the planet and connect it to human
society. Agriculture belongs to that expedition, outside the combat campaign.

This records the agreed setting and longer-term design. The author subsequently
approved implementation with a warm, cute appearance. The bounded standalone
first stage is implemented locally; [the stage record](COLONIZATION_STAGE.md)
describes its actual rules and validation. Details below beyond that stage remain
proposals, including automatic tending, wider settlement and a combat-save handoff.

The later [industry and completion proposal](COLONY_INDUSTRY_PROPOSAL.md)
explores conveyors, processing, bio-power, charging and recoverable pressure
after the author's 2 November review. It is a proposal, not implemented rules.
Current civilian destinations are Morrow, Nacre and Aurelia; the original planet
table below is historical and superseded by the HUD/planets stage.

## Confirmed direction

- The military expedition has already secured the planet. A different ship and
  batch of human operators undertake its development.
- Players control robots and machinery with assistance from the ship's AI.
- Farming is a casual activity within a larger mission to establish a productive
  human presence and connect the world to humanity's network.
- Orbital delivery, facilities, vehicles and remote operation can carry into
  this setting where they serve cultivation and settlement.
- This is separate from fighting. The earlier suggestion of gardens alongside
  active battles, enemy-damaged watering machines and farming rewards feeding
  the war economy is superseded.

The premise develops the agriculture and industry expedition already described
in [the original game ideas](../GAME_IDEAS.md). Combat retains its own campaign
and definitive conquest ending.

## Proposed experience

The player arrives above a quiet, secured world. The new ship surveys landing
sites, delivers a compact cultivation hub and transfers control to a ground
robot. The first job is modest: prepare a bed, plant seeds, water them and collect
the first harvest. Soil changes color when watered; leaves unfold and fruit
becomes visible as plants mature.

An orbital shuttle collects a packed sample shipment. Its return brings new
seed stock or equipment for the next project. The player gradually chooses how
their settlement develops: colorful gardens, a larger farm, automated growing
stations or several outposts connected by transport.

The recurring loop is:

**Survey -> establish a growing site -> plant and care -> harvest -> pack and
export -> receive equipment and seeds -> expand or personalize the settlement.**

Relaxation comes from visible improvement, self-chosen projects and machines
doing useful work. Progress does not require hunger, thirst, combat readiness or
daily attendance. The human operators remain supported aboard the ship; farming
is the expedition's mission rather than a recurring life-support emergency.

## Entry and campaign separation

Two entry routes fit the setting; standalone entry ships first:

| Route | Proposed behavior |
| --- | --- |
| Standalone Colonization (first stage) | Choose a planet whose conquest happened before this expedition. Start a new peaceful save without having to finish a combat campaign personally. |
| After a combat campaign | An optional expedition handoff creates a separate colonization save based on the secured world's geography. The completed combat save remains available. |

Build standalone entry first, then evaluate the handoff once the
peaceful loop works. Neither route switches an active multiplayer battle into
another mode. Invitations identify a particular save and mode; teammates join
that expedition together.

For a later handoff, CONQUERED alone is insufficient: today's combat ending can
leave survivors and committed attacks. Define eligibility as conquest plus
resolved survivor cleanup and no pending damaging effects, then take a stable
snapshot. Preserve the source save. Carrying over former roads, docks, bases or
ruins needs an explicit allowlist; do not inherit armed AI, ammunition orders,
military balances or ongoing combat timers.

Colonization gets its own objectives, resource ledger and room state. Existing
save limits remain unchanged in the first stage: three owned slots shared across
both modes and all planets. No existing save is converted, regenerated or charged.

## Crops and relaxed care

Start with three readable crop behaviors: a quick single harvest, a shrub that
regrows fruit, and a slower large plant with a more substantial harvest. Exact
species and timings follow a short playtest. A first harvest should arrive within
the opening session, with activities to do while it grows.

Dry plants pause instead of dying. Mature plants wait for collection; stored
produce does not rot. Watering covers a useful growing interval, and fertilizer
offers a bonus rather than being necessary for ordinary success. Basic seeds
are renewable. Seasonal loss, pests, mandatory crop rotation and expiring orders
are outside the first version.

Use active campaign time initially: pause or close the room and growth pauses
safely. Offline growth is a separate possible feature, with its own storage and
automation rules; it is not implied by the casual setting.

Planet identity changes plant art and opportunities before adding difficulty:

| Planet | Proposed cultivation character |
| --- | --- |
| Caldera | Broad-leaf crops, bright fruit and flowering gardens on temperate land. |
| Vesper | Reeds, branching fungi and terraces near lakes and mountain passages. |
| Sirocco | Succulents, oasis palms and sheltered growing beds supplied by condensers. |

All three must offer a viable starter location. Atmospheric water collection
avoids making a river or oasis mandatory. Later greenhouses can support crops
from other climates without changing the saved terrain's navigation rules.

## Facilities and automation

| Facility | Purpose and satisfying visible behavior |
| --- | --- |
| Cultivation hub | Seed library, shared produce storage, tool selection and a clear list of current projects. |
| Growing bed | Holds the selected crop; shows wet soil, growth stages and a ripe harvest. |
| Condenser and sprinkler | Collects moisture and waters nearby beds with rotating spray heads. |
| Nutrient processor | Turns a limited set of plant byproducts into optional fertilizer. |
| Tending station | Assigns a helper robot to harvest and replant selected beds. Full storage safely stops collection. |
| Packing depot and orbital pad | Prepares an export and loads it into a visible shuttle; receives the next delivery. |

The first automation should be easy to understand and install. A sprinkler must
not require a long chain of factories or a detailed pipe-pressure simulation.
Later helper robots can make repeated tasks convenient while players choose
layouts, varieties and larger projects. Local robots may be animated workers
without every movement requiring server pathfinding.

The AI assistant presents actionable information such as which beds need water,
which machine is blocked and what a shipment contains. Players choose the jobs
it repeats and can stop them. Scripted assistance is sufficient; no external
language-model service or autonomous spending system is required.

## The ship and the human network

The orbital ship provides survey views, nursery stocks, equipment delivery,
remote coordination and a route to settlements elsewhere. Reusable drop pods
and shuttles give existing orbital imagery a civilian purpose. Ground logistics
can later reuse rover movement, bridges, cargo transport and helicopters for
outposts too far apart to tend on foot.

Proposed progression milestones make the larger mission concrete:

1. **First cultivation:** grow and register the initial plant varieties.
2. **First exchange:** pack and send a shipment, then receive its promised reward.
3. **Established outpost:** maintain useful automation and complete a varied set
   of cultivation and infrastructure projects.
4. **Network connection:** commission a communications and freight link, marking
   the planet as an established member of the human network.

These are untimed goals. Network connection provides a completion moment while
allowing continued gardening, decoration and expansion. It does not require a
simulated civilian population, a real player market or live links between saves.
Those would be separate features.

Harvests support farming equipment, seed discoveries, decorations and export
projects. Early orders should guarantee their displayed reward and remain
available until fulfilled or freely replaced. Supply terminology, prices and
whether to use trade credits are still open; do not copy combat ORB/GND refill
rules or create a way to transfer farm output into military saves.

Planet adaptation should be visible around cultivated sites: prepared soil,
irrigation, vegetation and new infrastructure. Begin with saved local overlays
and completed projects. Global atmosphere simulation, changing coastlines and
rewriting the planet's terrain are outside the first stage.

## Cooperation and shared progress

Teammates share the expedition's garden, storage and project progress. One can
arrange beds while another tends crops or prepares the shuttle. No permanent job
classes or assigned gardener are required. Helping does not require constant
simultaneous attendance.

The server decides planting costs, growth, harvests and shipments. Two players
harvesting a bed receive one shared yield, and repeated requests cannot duplicate
it. Retain room isolation, owner-controlled lifecycle and durable accepted
actions. Destructive rearrangement should have clear permissions and reversible
behavior appropriate to a peaceful shared settlement.

## Proposed implementation stages

1. **Peaceful expedition:** separate mode and save identity, landing hub, small
   beds, three crops, manual watering, one sprinkler, shared storage and one
   complete sample shipment with a useful reward. Verify saved return and co-op.
2. **Useful automation:** nutrient processing, tending robots, replanting,
   packing and bounded queues. Add projects and decorative rewards.
3. **Planet development:** more species, climate shelters, transport between
   outposts and the network-connection milestone. Evaluate optional handoff from
   a completed combat campaign separately.

The first stage succeeds if a player can see growth, enjoy a harvest and use its
reward to improve the next cycle, with no need to fight or maintain a daily
schedule. Check desktop and phone controls, concurrent harvests, full storage,
restart, pause, mode isolation and a predictable runtime budget before expanding
the machinery roster. The stage record distinguishes what is implemented and
tested from this longer-term design.

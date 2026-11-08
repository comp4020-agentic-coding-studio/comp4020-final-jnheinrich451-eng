# Colony field companion: furry mechanical spider

2 November 2026. Recorded at the author's request for later design. This is a
future in-game colony companion, not an implemented feature or a change to the
current world. Conveyors, food processing and bio-power take priority now.

## Author's direction

A small, furry mechanical spider that feels intelligent and notices its
surroundings. It should be pleasant to pet and spend time with. The colony world
needs more places and environmental interactions to support its behavior;
design those together in a later stage.

## Proposed behavior to explore

Keep Frontier's visible mechanical construction under soft panels or a fuzzy
outer covering, with expressive sensors and small articulated legs. Aim for a
curious companion rather than a production machine or mandatory upkeep chore.
Its appearance, size, name, number of sensors and customization remain open.

A small readable behavior loop could be **follow → notice → investigate →
signal → return**. Petting, staying and recall would provide direct interaction.
Start with authored reactions to plants, water, machines, weather and landmarks;
later discoveries could support a journal. These are design candidates, not
promised rewards or autonomous actions on the player's resources.

## World work needed first

- More meaningful places to explore: paths, groves, shorelines, clearings and
  identifiable landmarks, with safe routes back to the settlement.
- Explicit things the pet can sense: interesting plants, sounds, footprints,
  functioning or blocked machinery, and other world events. Define those
  signals before implementing behavior that pretends to perceive them.
- A larger exploration space or additional connected zones, introduced through
  additive saved world data. Preserve established gardens and terrain; do not
  regenerate existing expeditions to make room for the pet.
- Shared navigation and interaction rules for obstacles, water, machines and
  players. Follow/recall must recover when a route changes or the pet is stuck.
- Bounded authoritative decisions, with animation on clients. Co-op players
  should see the same companion, target and discoveries; reconnects restore
  that state without rerolling rewards.

Before implementation, decide ownership (one per expedition or per player),
how it is obtained, which discoveries are useful, the exploration scale, and
how much of its behavior the player directs. Review a movement/interaction
prototype before committing to world expansion or a full asset sheet.

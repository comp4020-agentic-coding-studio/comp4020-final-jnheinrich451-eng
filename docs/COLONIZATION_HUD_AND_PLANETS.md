# Colonization: cohesive HUD and three destinations

1 November 2026. The author found the separate white interface boxes too large
on phone and too scattered on desktop. They requested a more refined white
interface, followed by three colony planets in both the opening and the game.
This stage implements those requests locally.

## Interface

The controls now form two groups: a slim translucent ivory header containing
identity, supplies, crew, progress and view controls; and a bottom tool dock
with its contextual panel attached directly above it. Muted separators and
shared edges replace the collection of detached white cards. The handwritten
heading accent and compact readable body type remain.

The phone crop panel is approximately 180 pixels high. Its small crop symbol,
growth progress and water status share one row; Water and Gather retain 40-pixel
targets. Secondary sprinkler/clear actions use a smaller utility row. Costs,
rejection messages and the Field Guide remain available. The camera centers
the selected bed above the dock, and pointer placement uses the same projection.

## Worlds and navigation

The main menu order is **New Game / Continue / Colonization / Join**.
Colonization opens **New expedition / Continue expedition / Join expedition**.
Combat saves and colony saves have separate browsing lists; the shared account
quota remains three owned saves across both modes. Save-and-return from the
garden opens its own Continue page. An invitation still determines its room and
mode on the server.

| Destination | Opening globe | Playable surveyed district |
| --- | --- | --- |
| Morrow (`morrow-v1`) | Green continents, blue-green seas, ivory cloud bands | Dawnmeadow Reach: flowering woodland, meadow valleys and freshwater pond chains |
| Nacre (`nacre-v1`) | Turquoise seas, lavender islands and pale shores | Pearlwater Basin: sheltered connected wetlands, lagoons, fungal canopies and floating coastal plants |
| Aurelia (`aurelia-v1`) | Golden continents, blue lakes and mineral bands | Sunfold Terraces: broad walkable terraces, golden grasses and fan-like alien tree canopies |

`public/colony-planets.js` supplies names, descriptions, fictional survey facts
and surface palettes to both presentations. The globes use independent
procedural textures with shared space-scene lighting. The ground uses distinct,
deterministic 72-by-56 district maps, existing terrain/collision kinds and a
protected starting clearing. A district is a local survey, not the entire globe.
The common growing rules, starter equipment and economy are unchanged.

New colony campaigns default to Morrow; new combat campaigns still default to
Caldera. The server rejects civilian planet IDs in combat. Existing colony saves
on Caldera, Vesper and Sirocco remain accessible under Continue expedition, with
their original terrain and construction. Legacy colony creation IDs remain
accepted for older clients. No existing save is converted or regenerated.

This stage originally used a simple fade after successful room admission. The
later [MYCORRHIZAL stage](COLONY_CARRIER_ARRIVAL.md) adds the carrier and controlled
shuttle descent. Combat arrival retains its current spacecraft and pod.

## Validation and evidence

Checks use disposable accounts, databases and gardens. New tests cover distinct
deterministic maps, connected starting land, mode-aware admission and reopening
all six old/new colony templates without replacing stored geography. Browser
checks cover all three worlds, actual planting/reload, the separate lobby and
save lists, phone sizing, co-op and the existing full growing/delivery flow.
Validation completed:

- TypeScript plus **94 tests in 11 files** covering colony rules/runtime,
  projections, all six colony saves, campaign mode/lifecycle/deletion, combat
  entry and planet persistence.
- **3 additional presentation/continuity tests** for the existing Sirocco entry.
- **22 distinct browser scenarios**: 7 colony/HUD/lobby scenarios and 15 existing
  entry/alignment scenarios. These include actual 45-second crop growth, delivery,
  phone controls, all three new districts, zoom/pan picking, co-op, reload,
  legacy saves, blocked storage, reduced motion and refused room admission.
- JavaScript syntax and scoped whitespace checks passed. Desktop and phone
  screenshots were visually inspected. No browser page errors were reported in
  the colony scenarios.

Review images:

- [Compact phone HUD](testing/evidence/2026-11-01/colony-refined-hud-phone.png)
- [Desktop crop panel](testing/evidence/2026-11-01/colony-refined-hud-desktop.png)
- [Morrow garden](testing/evidence/2026-11-01/colony-morrow-garden.png),
  [Nacre garden](testing/evidence/2026-11-01/colony-nacre-garden.png),
  [Aurelia district](testing/evidence/2026-11-01/colony-aurelia-district.png)
- [Main menu](testing/evidence/2026-11-01/colony-branch-menu-desktop.png)
- [Opening Morrow](testing/evidence/2026-11-01/colony-opening-morrow-desktop.png),
  [Nacre](testing/evidence/2026-11-01/colony-opening-nacre-desktop.png),
  [Aurelia](testing/evidence/2026-11-01/colony-opening-aurelia-desktop.png)

The opening checks have a separate
[validation record](testing/evidence/2026-11-01/colony-opening-validation.json).

This is local implementation and validation, not a hosted deployment claim.

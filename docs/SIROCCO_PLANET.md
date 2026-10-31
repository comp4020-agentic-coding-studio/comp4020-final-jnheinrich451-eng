# Sirocco: firm desert and navigable sand seas

Author-approved first playable stage, 1 November 2026. Implemented locally;
not a Fly release or a claim of validated hosted combat capacity.

## Player experience

New Game now offers **Sirocco (SRC / 03)** alongside Caldera and Vesper. Its
512 × 384 map contains four broad desert plateaus, dense alien compounds,
turquoise oasis lakes, rust-colored mesa chains and a connected copper sand sea.
Each plateau has one recommended starting clearing. Those recommendations are
shared choices, not exclusive seats, permanent safe zones or immunity from raids.

Pale, flat desert supports robots, tracked vehicles and construction. Darker,
rippled loose sand supports ships using fictional sand-skimming technology.
Ships cast hover shadows and throw dust. Sandports use the same platform,
berth, assembly, exchange, remote return and ramp rules as ordinary docks.
Submarines burrow with Ctrl and surface with Space, keep five-minute endurance,
and can move and launch missiles while beneath the sand. Small real oasis lakes
exclude ships. Teal and violet umbrella palms are decoration: they fade near
units, sit beneath combat objects and do not supply invisible collision or cover.

Mountains are impassable mesas using the existing ground/air restrictions.
Dunes are static cosmetic ridges, not moving terrain or an elevation simulation.
The existing bridge builder works here. A heavy crossing can connect banks
**200:180 → 200:221** (40 interior rows); completed decks retain ship underpasses.
Incomplete bridges reserve both layers. The four broad sandport sites are
**112:172, 400:172, 112:212 and 400:212**; these are optional surveyed examples,
not additional placement restrictions.

## Rules and persistence

- Template `sirocco-v1` has its own deterministic generator. Only a newly
  created Sirocco campaign uses it. Existing Caldera/Vesper worlds, construction,
  objectives, coordinates and progression are not regenerated or migrated.
- Loose sand reuses the naval terrain class (`terrain=0`, `waterKinds=1`).
  Firm desert uses normal land classes; oasis water uses `waterKinds=3`.
  Ship hull clearance, land placement, remote routing and collision stay
  authoritative and unchanged. Ships cannot cross ordinary firm sand.
- Ocean-class sand separates the four geographic pressure budgets. Oases,
  mountains and completed bridges do not create or merge these budgets. The
  existing `1 + 0.7 × (eligible players − 1)` scaling applies once per plateau.
- Normal city production, wandering pressure, skimmers, AA and Root-born siege
  centipedes apply, with the existing global 24 active-plus-reserved budget and
  individual species caps. Four sampled city seeds each admit 48 city groups;
  these are facilities, not simultaneously active mobile enemies.
- Ordinary naval enemies appear as sand burrowers in loose sand, with the same
  warnings, damage and submerged-submarine exclusion. Their oasis presentation
  remains watery. Vesper's aquatic hive stays Vesper-specific; no new desert
  enemy statistics or hive behavior is introduced.
- Weapon eligibility, land-only fire/gas footprints, prices, salvage and final
  conquest are unchanged. Clearing every objective stops new arrivals and leaves
  existing survivors for cleanup.
- All three playable globes now appear on entry. Sirocco's preview is a baked
  sample of the actual generator, checked for drift. Fictional survey facts are
  setting text only, with no gameplay or scientific claim.

## Rendering budget

Detailed terrain uses the existing bounded chunk cache and cheap overview map.
Palm positions are cached from immutable terrain (68 in this layout); only
viewport-visible palms render, with no overlay below zoom 0.25. Ship dust is
analytic and bounded to 16 plumes per hull, fewer with reduced effects. None of
these particles, canopies or shadows adds network traffic or simulation entities.

## Verification

- `spec/sirocco.test.ts`: deterministic geometry; four legal core/runway
  reserves; connected sand sea; all ship classes excluded from firm ground and
  oases; full-size carrier routes, docks and bridge underpasses; dense city seeds
  with protected reserves and valid centipede corridors.
- `spec/landing-zones-persistence.test.ts`: Sirocco added to the existing real
  campaign/SQLite restart test, retaining terrain, masks, starting choices,
  partially damaged/conquered sites and objective membership without duplication.
- Presentation tests cover exact globe-mask agreement, distinct surface colors,
  palms and saved entry selection. Naval effect tests distinguish dust from water
  and preserve the actual oasis effects.
- `tests/browser/sirocco.spec.js`: normal account/campaign flow, selection and
  reload, core deployment, robot movement, oasis overview, valid paid orbital
  sandport preview/build and saved return at 1920 × 1080 and 390 × 844.
- Entry navigation tests include all three destinations, interrupted planet
  transitions and reduced motion; desktop/laptop/phone layouts were checked.
- `tests/browser/sirocco-naval.spec.js`: desktop and phone verify sand wakes,
  moving burrow/surface controls, remote gunship orders and state propagation
  between two connected players. Disposable saves use the actual generated
  terrain with prebuilt vessels and no hostile sites; this checks naval handling
  and synchronization, not combat-load capacity. Both runs had no browser errors.

The full local check completed with TypeScript clean and **1,107 tests passing
in 140 files**. Both campaign browser scenarios passed, as did four entry browser
scenarios and both two-player naval browser scenarios. The first preview
consistency probe caught the intermediate generator
change for the bridge strait; the preview was rebaked before the successful full
check. Captures are under `docs/testing/evidence/2026-11-01/`.

These are automated local checks. Sustained Fly combat performance and human
balance assessment remain separate work. Further desert-specific enemies,
weather, moving dunes and new resource mechanics are not implemented here.

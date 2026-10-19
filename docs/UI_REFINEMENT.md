# UI refinement — survey-instrument interface

Status: **agreed by the author, 12 October** (decisions in §9). All five
stages are implemented; see §10 (stage 1) and §11 (stages 2–5). It changes
presentation and input mapping only: no server rule, price, range, collision or
permission changes. Prices and specs shown in the UI must come from
`public/logistics.js` and the existing weapon/footprint modules, never from
copies in this document.

## 1. Problems in the current interface

Observed in `public/index.html`, `public/app.js` and `docs/previews/`:

| Area | Current behaviour | Effect |
|---|---|---|
| First entry | Orbit view still shows rover weapon readouts, the tank loadout selectors and the "Combat 1" button. The site panel explains validity in prose paragraphs. | A new player sees controls they cannot use yet and has to read to learn why a site fails. |
| Deployment | Assets are split: sentries/cores/tanks/rails/cannons/missiles in the tray (category chosen by a `<select>`), factory/launch station/recycler in the Supplies dialog. Only the sentry card shows a price. Utility buttons (find tank, legacy switches, operate cannon) are mixed in with assets. | No single place to answer "what can I build, what does it cost, can I afford it". |
| Hotkeys | One `if` chain in `app.js:1413`. `1` means "Combat mode" on foot but "HE shell" in a cannon; `G` means grid or ship ramp. No keys for supplies, room, map overview, objectives or asset selection. | Keys are hard to learn and cannot be listed automatically. |
| Help | One long help dialog with every vehicle's manual. | Players can't find the controls for what they're doing right now. |
| Look | Warm amber/teal "field kit" palette, emoji glyphs (⚓ ✈ ✚), rounded panels; gold is used for both buttons and the desired-target crosshair. | Colours don't carry a consistent meaning; it doesn't read as an instrument. |

## 2. Visual direction: "planetary survey instrument"

The HUD should feel like a calibrated scientific instrument looking at the planet.
It shows measurements with units, and every colour means one thing.

**Principles**

1. **Colour encodes meaning, nothing else.** Decorative colour is removed.
2. **Every number has a unit**: tiles (`t`), seconds (`s`), degrees (`°`),
   supplies (`SUP`). Tabular monospace digits, so readouts don't jitter.
3. **Catalogue designations.** Every asset has a short code (e.g. `G-02`),
   which also appears on its key cap and spec sheet.
4. **Schematic plan views** replace emoji and sprite thumbnails in menus: the
   true footprint drawn as line art on a tile grid (57-cell cross, 3×3 carriage,
   6×10 airbase). This matches the overhead 2D projection.
5. **Hairline, square panels**: 1 px rules, 2 px radius, corner tick marks,
   section labels like `DEPLOY / GROUND`.

**Colour tokens** (replacing `--accent` etc. in `style.css`)

| Token | Value | Meaning — and only this |
|---|---|---|
| `--void` | `#0b1116` | Off-map / page background |
| `--panel` | `#0e171cf0` | Instrument panel fill |
| `--rule` | `#9fc3cf2e` | Hairlines, grid, inactive borders |
| `--ink` / `--muted` | `#e4edef` / `#8ba2a9` | Text / secondary labels |
| `--intent` | `#f0c44c` gold | **Operator intent**: desired target crosshair (kept), current selection, focus ring |
| `--actual` | `#a9dcff` pale cyan | **Measured/actual state**: actual aim diamond and ring (kept), friendly assets, telemetry |
| `--valid` | `#7fe0a0` | Clear site, weapon ready, affordable |
| `--warn` | `#ff9a3d` | Incoming attack warnings, reloads, low battery |
| `--hostile` | `#ff5e57` | Enemies, hostile territory, blocked cells, unaffordable cost |
| `--fire` / `--gas` | existing field colours | Hazard fields (unchanged) |

This keeps the agreed "gold crosshair = desired target, pale-blue diamond =
current aim point" semantics; the change is that gold is no longer used for
ordinary buttons.

**Type**: IBM Plex Sans for labels and IBM Plex Mono for readouts. Both are OFL,
**self-hosted** in `public/assets/fonts/` with the licence recorded, so Docker
builds don't depend on Google Fonts. Fallback: `Segoe UI`/`Cascadia Code`.

**Icons**: one small inline-SVG line-icon set (1.5 px stroke) for categories and
map tools, replacing `⚓ ✈ ✚ ⛶ ⌖ ⋯` glyphs.

**Map overlays (cheap, canvas only)**

- Edge graticule: column/row labels every 8 tiles along the viewport edges.
- Scale bar bottom-left (`0 ── 8 t`), updating with zoom.
- Cursor telemetry: `X 088 · Y 060 · BRG 042° · RNG 12.4 t` from your body
  (or controlled facility) to the cursor. Replaces the `SECTOR 24 / 18` label.
- Range rings drawn as thin labelled arcs (`40 t`).
- The ground keeps the planet's natural scene: terrain art and textures stay as
  they are (final biological art is still open). The instrument style applies
  only to the HUD, menus and the thin overlays drawn on top of the terrain.
  Overlays use a dark halo so they stay readable over any terrain. There are
  no contour lines because elevation isn't implemented.

## 3. HUD layout by state

The HUD becomes a set of fixed **zones**. Their contents change with the
player's state (`orbit`, `on foot`, `in vehicle`, `operating facility`,
`placing`, `disabled`). Ground controls never appear in orbit.

```
┌───────────────────────────────────────────────────────────────────────────┐
│ FRONTIER  CALDERA-01   ● UPLINK 38 ms   2 OPERATORS    [Room P][?][ID]    │ ← header
├─────────────────────┐   ┌───────── STATE BANNER ─────────┐   ┌───────────┐ │
│ OPERATIONS          │   │ ON FOOT · ROBOT R-01           │   │ SURVEY    │ │
│ ▸ Destroy alert stn │   └────────────────────────────────┘   │ [minimap] │ │
│   Settlement 1/3    │                                        │ legend    │ │
│ ▸ Next site  O      │                                        ├───────────┤ │
│ HULL ████████░ 82   │            (battlefield)               │ + − ⌖ ▦ M │ │
└─────────────────────┘                                        └───────────┘ │
│                                                                            │
│ ├─┼─ 8 t   X 088 Y 060 BRG 042° RNG 12.4 t     SUP 1 140  ▲2/s  ● Saved    │ ← telemetry
│ ┌──────────────────────── CONTEXT STRIP ──────────────────────────────────┐│
│ │ R-01 ROBOT │ [LMB/Space] FUEL JET  ready │ [RMB/J] LASER  ready │ [B] Deploy [L] Logistics │
│ └─────────────────────────────────────────────────────────────────────────┘│
└───────────────────────────────────────────────────────────────────────────┘
```

**Context strip** — one shared template replacing the separate robot dock,
`tank-loadout`, `ship-controls`, `aircraft-controls` and `facility-controls`
panels (same element IDs/handlers behind it where possible):

`[unit ID + hull]  [primary: key · name · reload arc]  [secondary: …]  [context actions with key caps]`

| State | Strip shows |
|---|---|
| Orbit | `01 SURVEY → 02 SELECT SITE → 03 CONFIRM DROP` step indicator; no weapons |
| On foot | Robot fuel jet / laser, `E` when something boardable is in reach |
| Tank | `1` HE · `2` Magnetic (charge bar), `Q` secondary APCR/Fuel, `E` exit |
| Cannon / missile battery | `1 2 3` HE/Fire/Gas, LMB fire, `R` rotate area, trajectory readout, `Esc` exit |
| Gunship / submarine | Fore/aft turret reloads, port/starboard arcs, `G` ramp, `Ctrl`/`Space` depth, battery |
| Aircraft | Speed `6.0–12.0 t/s`, runs left, `LMB` release |
| Placing | Asset code + name, cost, validity, `R` rotate/shape, `Enter` confirm, `Esc` cancel |
| Disabled | Recovery core selector + countdown (existing recovery panel restyled) |

The supplies readout moves out of the "SUPPLIES / Logistics" button into the
telemetry row as a permanent instrument value (`SUP 1 140 ▲2/s` while below
the reserve threshold).

## 4. First entry (orbit → landing)

Rules unchanged: guests without a core/vehicle start in orbital core selection
with no ground body, and the server still decides validity.

1. **Uplink screen** (existing loading overlay) shows only real steps as a log:
   `session ✓ · world snapshot ✓ · build fingerprint ✓`.
2. **Orbital survey.** State banner `ORBIT · NO GROUND BODY`. The context strip
   is the three-step indicator. Ground HUD (weapons, tank loadout, touch pad,
   fire buttons) is hidden.
3. **Site analysis panel** replaces the prose site panel with a readout:

```
SITE ANALYSIS                         X 029  Y 013
G-02 ORBITAL CORE · 57-cell cross
Terrain      grass 49 · sand 8 · rock 0
Flooring     0 rocks covered
Hostile      nearest site 31.2 t · outside red territory
Cost         120 SUP   (balance 1 200)
Checks       ✓ land   ✓ clear   ✓ inside map   ✓ 1 core per scout
[ CONFIRM ORBITAL DROP  ⏎ ]
```

   Checks list only conditions the client preview already evaluates. Their
   text reuses the existing rejection messages, and the server's reply is
   still final.
4. **Descent → unfolding → robot exits** (existing animation). The banner changes
   to `ON FOOT`, and the Operations panel shows a three-item **first-landing log**
   (`Core landed ✓`, `Place a sentry — B`, `Locate a hostile site — O`), each
   ticked from real world state (reusing the existing `task-*` checklist).

## 5. Deployment catalogue (`B`)

One catalogue holds every deployable asset, including the logistics buildings
that are currently in the Supplies dialog. Supplies keeps the *operations*
(recycler jobs, cargo launch, repairs, factory orders, emergency tank).

```
┌ DEPLOY ───────────────────────────────────────────────── SUP 1 140 ─ × ┐
│  GROUND   RAIL   STRIKE   LOGISTICS   NAVAL   AIR          Z ◂  ▸ X   │
├────────────────────────────────────────────┬──────────────────────────┤
│ ┌1──────────┐ ┌2──────────┐ ┌3──────────┐   │ G-03 TANK DROP POD       │
│ │ ▢ plan    │ │  ✚ plan   │ │  ┼ plan   │   │ [schematic, true scale]  │
│ │ G-01      │ │ G-02      │ │ G-03      │   │ Footprint  17-cell cross │
│ │ SENTRY    │ │ CORE      │ │ TANK POD  │   │ Cannon     HE 14 t       │
│ │ 1×1  8 t  │ │ 57 cells  │ │ 17 cells  │   │ Secondary  APCR / fuel   │
│ │ 25 SUP    │ │ 120 SUP   │ │ 100 SUP   │   │ Limit      1 / scout     │
│ └───────────┘ └───────────┘ └─used 1/1──┘   │ Cost       100 SUP       │
│                                              │ [ PLACE  ⏎ ]             │
└────────────────────────────────────────────┴──────────────────────────┘
```

**Categories and designations** (specs are rendered from code):

| Tab | Assets |
|---|---|
| GROUND | G-01 APCR sentry · G-02 Orbital core · G-03 Tank drop pod |
| RAIL | R-01 Rail track · R-02 Railway cannon |
| STRIKE | S-01 Missile battery |
| LOGISTICS | L-01 Factory · L-02 Launch station · L-03 Recycler |
| NAVAL | N-01 Coastal gunship · N-02 Missile submarine |
| AIR | A-01 Airbase + bomber · A-02 Orbital attack jet |

**Name and code together.** Cards, spec sheets and the placement strip show
both, e.g. `G-02 · Orbital core`. The code is a client-only identifier. It is
never sent to the server or saved: server requests and saves keep using the
existing `kind` strings. `public/catalogue.js` maps each code to its `kind`,
and the code is used to:

- give each asset a fixed order inside its tab, which is where its `1`–`9`
  hotkey comes from;
- link catalogue cards, spec sheets and `F1` entries to each other;
- give tests a stable selector (`[data-asset="G-02"]`) that doesn't break when
  wording changes;
- let teammates call out assets briefly ("dropping N-01 east").

Codes are never reused or renumbered. A new asset gets the next free number in
its tab.

**Card states**: available · unaffordable (cost in `--hostile`, shortfall shown) ·
limit reached (`used 1/1`) · needs construction support (only for large
infrastructure). When a factory is in range, local price and build time are
shown next to the orbital price.

**Fleet/finder actions** (Find my tank, Find ship/dock, Recall, Operate cannon,
Legacy switches) move to a **ASSETS IN FIELD** list at the bottom of each tab:
one row per owned object, with status and `Locate` / `Operate` buttons. They are
no longer mixed in with the things you can buy.

**Placement**: selecting a card closes the catalogue and enters placement. The
ghost footprint is drawn cell by cell (cyan = valid, red hatch = blocked) when
the existing preview check can tell which cells are blocked; otherwise the whole
footprint is tinted. Construction-support circles appear only for large
infrastructure. Holding `Shift` while confirming keeps placement open for repeat
sentries/rail.

**Phone (390×844)**: the catalogue is a bottom sheet that covers at most 45%
of the height. It has horizontally scrolling category chips and cards inside
the sheet (no page scroll). The detail pane collapses into the selected card.
The existing site-confirmation overlay is kept, and key caps are hidden on
`pointer: coarse`.

## 6. Hotkeys

All bindings live in one table (proposed `public/keymap.js`):
`{ key, context, action, label }`. That table drives the `keydown` handler,
the key caps on buttons, and the `F1` key reference, so they can't disagree.
Letters match `event.code` (physical position), so the WASD layout also works
on non-QWERTY keyboards.

**Global** (no dialog open, focus not in a text field)

| Key | Action | Status |
|---|---|---|
| `B` | Deployment catalogue | existing |
| `L` | Logistics / supplies | new |
| `M` | Toggle orbital survey overview ↔ follow camera | new |
| `O` / `Shift+O` | Locate next / previous hostile objective (replaces seven locate buttons) | new |
| `C` | Recenter on self | existing |
| `+` `-` | Zoom | existing |
| `G` | Tile grid (ramp when in a ship — context wins) | existing |
| `P` | Room menu (solo: pauses) | new |
| `F1` or `?` | Context key reference | new |
| `Esc` | Back out one level: dialog → placement → catalogue → facility control | extended |

**Body and vehicles** (existing unless marked)

| Key | Action |
|---|---|
| `WASD` / arrows | Move / drive / sail / rail travel; aircraft speed and turn |
| Mouse | Aim (gold desired target) |
| `LMB` / `Space` | Primary weapon |
| `RMB` / `J` (hold) | Secondary weapon |
| `E` | Board / exit nearest vehicle or aircraft |
| `1` `2` `3` | Shell type HE / Fire / Gas (cannon, battery, ships). **Tank: `1` HE, `2` Magnetic — new** |
| `Q` | Cycle secondary weapon (tank APCR ↔ fuel jet) — **new** |
| `R` | Rotate strike area (missile battery, submarine) |
| `G` | Shore ramp (ships) |
| `Left Ctrl` / `Space` | Dive / surface (submarine) |

**Catalogue and placement** (only while open)

| Key | Action |
|---|---|
| `Z` / `X` | Previous / next category |
| `1`–`9` | Choose asset in the current category |
| `R` | Rail: cycle shape (EW → NS → J → corners) |
| `T` | Rail: toggle length 1 / 5 |
| `Enter` / click | Confirm site |
| `Shift` + confirm | Place and keep placing |
| `Esc` | Cancel placement |

**Removed / changed**

- `1` no longer means "Combat mode" on foot (`Esc` already does this). This
  frees `1–3` for weapon selection everywhere.
- The `Combat [1]` button becomes the state banner and is no longer a mode switch.

Safety rules are unchanged: releasing a key, losing window focus, opening a menu
or disconnecting still stops held fire, and reconnecting never restarts it.
Phone touch buttons stay as alternatives for every combat action.

## 7. Help and onboarding

- The single long help dialog is split into **spec sheets**, one per asset,
  opened from the catalogue detail pane. The vehicle manual moves into the
  `F1` context reference.
- `F1` shows only the keys valid in the current state, rendered from the keymap.
- The visual-effects settings move to the Room menu.

## 8. Proposed implementation stages

Each stage is reviewed in play before the next, following the project's
stage-by-stage practice:

1. **Visual system**: tokens, self-hosted fonts, panel/key-cap styles, SVG icons.
   CSS and markup only.
2. **State-aware HUD + entry flow**: zones, state banner, hide ground HUD in
   orbit, site analysis readout, first-landing log.
3. **Deployment catalogue**: `public/catalogue.js` (codes, categories, footprint
   references; prices from `COSTS`/`quote`), tabs, spec pane, assets-in-field
   list, logistics buildings moved in, placement strip.
4. **Keymap**: central table, handler refactor of `app.js:1413`, `F1` reference,
   new keys.
5. **Map instrumentation**: graticule labels, scale bar, cursor telemetry.

Checks for each stage: the existing HTTP/domain tests; Playwright screenshots at
1920×1080 and 390×844 in orbit, on foot, placing, in a vehicle and in a facility;
a keyboard-only pass (deploy a sentry, board a tank, fire, exit); a resize; and
confirmation that held fire stops on blur/menu.

## 9. Author decisions (12 October)

1. **Scope of the style**: the ground uses the planet's natural scene. The
   instrument style covers the HUD, menus and map overlays only; the terrain
   renderer is unchanged.
2. **Fonts**: left to the implementer. Use self-hosted IBM Plex Sans/Mono (OFL)
   and record the licence and where the files came from.
3. **Logistics buildings**: approved. Factory, launch station and recycler
   deployment move into the catalogue. Supplies keeps the operations.
4. **Hotkeys**: approved as listed in §6, including dropping `1` = Combat mode.
5. **Designations**: show both the code and the name. Codes are client-side
   identifiers only (see §5) and never change server or save formats.

## 10. Stage 1 implementation record (12 October, local)

- **Tokens.** `public/style.css` defines the §2 colour tokens on `:root`. Every
  hard-coded field-kit colour was replaced by a token. Only the light `/readme/`
  page and the purple contaminated-air banner keep their own colours. `--accent`
  now points to `--intent`, and `--line` to `--rule`.
- **Panels and controls.** Panels have 2 px radii, hairline borders and corner
  ticks (gradient background layers, so the CSP's `style-src 'self'` and the
  existing positioning are unaffected). Shared `kbd`, `select` and `input`
  styles were added. Selected buttons use a gold outline instead of a gold
  fill. Primary actions are pale cyan.
- **Fonts.** IBM Plex Sans 400/500/600 and Mono 400/500 (latin subset, 92 KB)
  are in `public/assets/fonts/` with both OFL licence files. Hashes and source
  are in `manifest.json`. `public/fonts.css` is linked from the game, lobby and
  account pages. The server now serves `.woff2` as `font/woff2` with the same
  one-hour cache as images.
- **Icons.** Inline SVG line icons replace the ⛶ ⌖ ▦ ⋯ ⚑ ✚ ⚓ ✈ glyphs and the
  two Kenney sprite thumbnails in the deploy tray. The rail, cannon and battery
  cards also gained plan-view icons. Accessible names, IDs and handlers are
  unchanged. The Kenney sprites are still used by the canvas renderer.
- **Lobby and account pages** use the same palette and fonts. The planet globe
  art is unchanged.
- **Unchanged:** terrain and canvas rendering (including the gold crosshair and
  blue aim diamond), layout positions, and all gameplay, keys and server rules.

**Checks.** `pnpm typecheck` passed, and `pnpm test` passed 290/290. Isolated
screenshots were taken at 1920×1080 (plus a resize to 1100×700) and 390×844 of
the lobby, login, orbit survey, landed robot, deploy tray (ground and navy) and
help dialog. All fonts returned 200 `font/woff2`, with no page or console
(CSP) errors.

Browser specs: accounts, campaigns, logistics, tank-deployment,
navy-deployment, orbital-entry and aircraft pass. The aircraft phone spec
failed once during the long combined run, then passed 6/6 on repeat (a live-tick
timing flake). Thirteen specs in `island`, `frontier` and `cannon-controls`
fail identically on the unmodified commit `6ce4c67`. They fail on gameplay
expectations such as sentry deployment refused, test shots rejected and 409
conflicts, which look like effects of the 12 October construction/economy
rules, not of this stage. They are still failing and need their own fix.

## 11. Stages 2–5 implementation record (12 October, local)

**Stage 2: state-aware HUD and guided landing** (`public/hud.js`, unit-tested)
- A header banner names one state: orbit, descent, on foot, placing *asset*,
  tank, operating *facility*, ship, aircraft or disabled. `.battlefield` gets a
  matching `data-state` for CSS. The banner hides below 900 px width, where
  phones keep the orbit steps and the existing `#core-status` banner.
- Orbit replaces the bottom dock with Survey / Select site / Confirm drop.
  The core site panel becomes a measured readout: 57-cell footprint terrain,
  covered rocks, nearest hostile site and whether the site is inside red
  territory (the same `sectorRadius` as the map shading), cost and balance,
  and preview checks. The client's existing verdict is shown last, and the
  server still decides.
- The objective panel is renamed Operations. On foot it shows a first-landing
  log (core landed, sentry placed, hostile site located) ticked from state. A
  core's built-in sentry doesn't count. Supplies moved to a `SUP` header
  readout (▲ while refilling below the reserve), which opens logistics.

**Stage 3: deployment catalogue** (`public/catalogue.js`, unit-tested)
- Six tabs: Ground, Rail, Strike, Logistics, Naval, Air. There are 13 coded
  cards (G-01 to A-02). Each shows its code, name, footprint and price, in red
  with the shortfall when unaffordable and green with `IN FIELD` when one is
  owned. Card IDs and click handlers are unchanged.
- The desktop spec pane shows footprint, weapon ranges, reload, HP, limit,
  placement rule and cost. Every number comes from `logistics.js`, `weapons.js`,
  `missile.js`, `ship.js` and the other owning modules. Factory prices are
  shown only for kinds the factory can order (airbase, ship, cannon, battery).
  The first core is quoted as free, matching the server.
- Factory, launch station and recycler deploy from the Logistics tab. The
  Supplies dialog keeps the operations and links back. The finder and recall
  buttons moved into a per-tab IN FIELD row.
- Phones get a bottom sheet of at most 46 % height. Cards scroll sideways
  inside it, the spec pane is hidden, and there is no page scroll.

**Stage 4: keymap** (`public/keymap.js`)
- One ordered `BINDINGS` table defines precedence, labels and scopes.
  `app.js` maps each id to a guard and an action. The first binding whose key
  matches and whose guard passes wins, which preserves the old if-chain order.
  Letters and digits match `event.code`.
- New keys:
  - `L` logistics, `M` survey overview (in a facility it toggles the cannon
    overview), `O` / `Shift+O` locate hostile sites by distance, `P` room menu.
  - `F1` / `?` opens a key reference listing only the keys valid in the
    current state.
  - Catalogue: `Z` / `X` switch tabs, `1–9` pick a card. Picking by key also
    opens the site panel, so keyboard-only players reach the coordinate picker.
  - Placing: `Enter` confirms; `Shift+Enter` (or Shift-click) keeps placing
    sentries. Rails: `R` cycles the shape, `T` toggles the length.
  - Tank: `1` / `2` select HE or Magnetic; `Q` cycles the secondary weapon.
- `1` no longer returns to Combat. `Esc` does, and the Combat button shows
  `Esc`. Held fire still stops on key release, blur, menus and disconnects.

**Stage 5: survey instruments** (`public/instruments.js`, unit-tested)
- Edge graticule labels use power-of-two spacing that stays at least 70 px
  apart, plus a scale bar (desktop always; phones in orbit or overview). Both
  are drawn in screen space with a dark halo over the unchanged terrain.
- The coordinates readout is now cursor telemetry:
  `X 088 · Y 060 · BRG 042° · RNG 12.4 t`, measured from you or your
  facility. It is hidden in contaminated air, as before.
- The zoom label now follows camera animations; it used to go stale after
  landing.

**Not done as designed:**
- Vehicle and facility panels keep their own layouts (restyled), not one
  merged context strip. Merging them would mean rewriting every vehicle
  control's handlers.
- Range rings are not labelled.
- The visual-effects settings stay in the help dialog, because the legacy
  field has no room menu.
- Older stage docs still describe "Ground forces / Navy / Air force" menus.
  This record supersedes those paths.

**Test repair alongside these stages:**
- 36 browser tests in 14 spec files were already failing on `6ce4c67`. They
  predated orbital entry, construction support, the unfolding dock, the
  economy's request-based aircraft replacement or the `?legacy=1` entry URL.
- The specs repaired are island, frontier, cannon-controls, compact-rail,
  switches, rail, rail-floor, missile, missile-fields, submarine, shells,
  turn-clearance, anti-air and hazard-visibility.
- The setups now land cores first (or seed completed cores), keep facilities
  inside support, seat rover-weapon tests in a tank
  (`tests/browser/rover-helper.js`) and use the three-tiles-from-shore dock
  site.
- The shells gas check moved to the Eastern plain drill sector. Since cores
  carry automatic sentries and guarding robots fire, crawlers near the island
  beacon die before reaching the gas.
- Assertions were only changed where the rule itself changed: the core's
  built-in sentry counts as a foundation, joining guests have no ground body,
  and aircraft replacement is ordered after the cargo timer.
- `tests/browser/catalogue-keys.spec.js` covers stages 3–4. orbital-entry
  covers stage 2.

**Results (12 October, local):**
- `pnpm typecheck` passed, and `pnpm test` passed 300/300.
- The full Playwright run had 76/87 passing before the last spec repairs. Each
  repaired spec was then re-run and passes; campaigns' one failure was a timing
  flake under load and passes alone.
- Three tests still fail exactly as they do on `6ce4c67` (verified in a
  separate worktree). They are gameplay checks this UI work did not change:
  - scanner (desktop and phone): the DETECTED warning does not clear after
    escaping behind the ridge;
  - ship-armament on phone: after the touch aim at (312, 236) the main-gun
    fire button stays disabled (no in-range solution). On `6ce4c67` it fails
    one step earlier, on the side-arc readout. The cause is not yet diagnosed.
- Screenshots were checked at 1920×1080 (plus a resize) and 390×844.


## 18 October: direct orbital cards and explicit deployment funding

The Strike catalogue now exposes walking HE (S-02), fire curtain (S-03), gas
seeding (S-04) and cutting beam (S-05) directly. Selecting a card keeps targeting
in a slim strip inside the bottom deployment tray. V uses the same tray.
The mouse previews the target, R rotates HE/fire by 90 degrees, and LMB calls
the strike immediately. Gas uses a circular pattern. Beam uses one click to
anchor its start and a second to choose its endpoint and call. Selecting a card
or moving the pointer does not spend or launch. The direction dropdown,
coordinate form and separate call button have been removed. A small rotation
button supports phones; tapping calls a strike while dragging pans.
Committed orders, shared cooldowns, prices and server validation are unchanged.

Eligible facility cards show both ORB and GND prices. At the selected site,
Delivery lists orbital delivery and only the completed friendly cores, outposts
or factories whose circle contains the whole footprint. Local construction costs
25% (rounded up) in shared GND and takes 60 seconds. Moving outside support
removes local choices and visibly returns to ORB; returning inside requires a
new explicit local selection. Blue circles remain visible during eligible
placement even while orbital delivery is selected. Insufficient GND does not
hide the choice: the placement reason reports the shortage. Existing special
rules remain: first core/emergency tank, free rails, orbital-only empty shipyards
and aircraft delivery, and GND vessel construction at an existing shipyard.

Local validation: type checking and the catalogue, support-network and orbital
domain checks; browser coverage verifies separate-pool spending and movement
inside/outside support at desktop and phone sizes. Strike browser checks cover
all four payloads, confirmation, committed targets and reload. These are local
checks, not a deployment or Fly performance claim.

## 19 October: placement catalogue, funding halves and movement through panels

The catalogue now places new equipment. Navy cards immediately open shore
placement for the selected ship and its unfolding dock; they do not open the
shipyard management dialog. Existing ship repair, replacement and retirement
remain dock interactions (E). Tank replacement/location and artillery/switch
management move to Logistics (L), preserving recovery outside Deploy.

Air has three independent entries: Empty airbase (A-01), Attack jet (A-02),
and Bomber (A-03). An airbase placed through the catalogue is always empty.
Aircraft cards enter map selection for a completed, empty owned airbase or
carrier. Clicking a card does not spend resources or replace an aircraft.
Confirmation sends a new-only delivery request; the server rejects occupied or
reserved runways, including a runway occupied after the preview was shown.
The first bomber remains free once per campaign. Cruise/boarding/recall remain
at the apron, flight deck and H air-support controls. Existing saved aircraft
and shared fleet capacity are unchanged; the legacy explicit exchange API is
still available to carrier service controls.

Inside construction coverage, eligible cards have adjacent blue ORB and gold
GND halves. Each half is a separate accessible button with its own price.
Outside coverage, only the full-width ORB card remains. Before placement,
coverage follows the selected footprint (or the current unit when first opening
Deploy). The site preview repeats the funding buttons and checks the complete
footprint. A preferred GND choice can resume when moving back into coverage;
outside it, the actual quote and confirmation use ORB. Unaffordable choices
remain visibly disabled. Costs and 60-second local assembly remain unchanged.
Carrier local construction now uses the same supported-kind admission as the
other ships; its existing price and geometry are unchanged.

WASD movement continues through Deploy, placement, logistics and support panels
for robots, tanks, utility vehicles, ships and aircraft. Panels own the pointer,
so opening them stops held fire and prevents cursor motion from retargeting
weapons. Editing an input/select/contenteditable element owns its keys; key
release, lost focus and hidden tabs clear held movement. Help, key reference,
room pause, orbit, death and deployment still prevent movement. Arrow keys on
category tabs retain normal tab navigation. Vehicle crews can browse Deploy
with B, but must disembark to place ground equipment.

Validation is local: deployment-flow browser cases exercise desktop/phone
empty-airbase and aircraft admission, direct naval placement, and panel movement
for all five body types. Funding browser cases verify both pools and changing
coverage; air-cruise regression cases retain shared runway travel. No save
migration, commit, push or Fly deployment is part of this UI stage.

Validation checkpoint: `pnpm check` passed 472 tests across 69 files and type
checking. The 13 catalogue/funding/deployment browser cases passed; the added
tank-replacement-in-Logistics case also passed. Shared-airfield cruise passed
on desktop and phone; attack-jet delivery/fire passed on desktop and phone.
Screenshots were reviewed at desktop and 390-pixel phone widths.

Broader regression limits: the updated legacy aircraft/navy/transport browser
suite is not fully green. Runs encountered native Node/V8 errors and
`v is not a function` evaluation errors, plus delivery/steering/firing polling
failures. A separate run with Node JIT disabled also hit timing/approach
failures. These failures are not established as regressions or as pre-existing
bugs; retain their tests for follow-up. Passing focused tests does not replace
manual review of flight, naval firing and transport ramp approaches.

### Separate docks and contextual workshops — 19 October 2026

This supersedes the preceding combined ship-and-dock catalogue behavior.
N-05 deploys an empty dock; N-01 through N-04 select an existing empty dock
on the map and build the selected vessel for GND. Deploy never exchanges a
live vehicle. Empty airbases stay separate from aircraft. Aircraft catalogue
cards retain rapid ORB delivery, including the first free orbital bomber;
local airbase workshops offer slower GND assembly instead.

An active robot entering its own completed dock or airbase sees a nonmodal
workshop at the bottom right. It shows the resident vehicle, available shared
GND, vehicle choices, price, trade-in credit and net payment. Leaving closes
it; dismissing it keeps it closed until re-entry. WASD remains available.
E and Dock controls retain the existing naval boarding/management dialog.
Aircraft boarding and cruise controls remain at the apron.

Both workshops assemble for 60 seconds using cosmetic drones and saved
server timers. Empty docks support ORB or discounted GND construction inside
a friendly support circle, just like airbases. Each dock still reserves one
ship, even while it is away; aircraft still share fleet capacity and runways.

Trade-in credit is floor(80% of the prior recorded net payment), only in the
same GND pool, capped at the new price. The next receipt records the new net
payment, not list price or credit. No extra cash is refunded. Free vehicles,
ORB purchases, lost vehicles and older vehicles without purchase receipts
have no GND credit. All new ship and aircraft purchases record their pool and
actual cost; existing save records remain playable without a migration.

The server validates ownership, readiness, fleet capacity, berth/runway
availability, current vehicle revision, passengers, cargo and carrier aircraft.
A ship must be stationary at its original dock; aircraft must be parked and
unoccupied. Successful orders replace the saved vehicle and debit supplies
in one SQLite transaction. An order identifier makes retries harmless; stale
orders, insufficient funds and foreign ownership preserve the current vehicle.
Existing sunk wrecks remain. Legacy combined-deployment APIs remain compatible
for old clients and tests; the new catalogue does not use them.

Local validation: `pnpm check` passed type checking and 477 tests in 70 files.
Six focused service tests additionally cover receipts, replay/concurrent
orders, restart, ownership, insufficient funds, active vehicles, reserved
runways and empty-dock GND construction. The last test was added after the
full-suite run. Broader legacy flight/naval browser limitations documented
above remain; this change does not claim to resolve those suites. No README,
account configuration, live saves, commit, push or Fly deployment was changed.

Final focused browser run: all 18 catalogue, funding and deployment-flow cases
passed, including automatic dock/airbase workshops and exchanges on desktop
and phone, dismissal, map-selected empty-dock orders, and WASD for all five
body types. Final targeted service tests (6) and typecheck also passed after
fixing recovery for a ship destroyed during unfinished assembly: its loss
countdown still applies, but the old assembly timer no longer blocks rebuilding.


## Ground artillery and map-based Remote, 19 October 2026

Railway cannon and missile battery now belong to Ground. Rail keeps track
construction; Orbital contains orbital attacks. Existing asset codes R-02 and
S-01 remain stable, while the visible category hotkeys follow card order.
No prices, placement rules, saves or weapon mechanics change in this stage.

The bottom bar has Remote (F). From an active robot or tank it opens an
overhead view framing the friendly artillery network. Gold, screen-sized map
buttons select a cannon or missile battery directly; wheel/zoom buttons and
panning remain available. Unfinished or occupied facilities are muted and
cannot be selected. The old artillery dropdown/sidebar has been removed.
Acquiring control opens the existing bottom weapon controls. Escape cancels
selection or releases control and returns to the unit. WASD remains available
while selecting; the map selection click does not fire a weapon.

The existing server remains authoritative for construction readiness and
exclusive control, including a second player acquiring a facility between
preview and click. Cancelling an outstanding request sends a release after
the request completes. Losing focus or connectivity cancels selection.
The mode does not expose hostile units through fog or change control leases.

Validation: typecheck and 46 focused catalogue/rail/missile tests passed.
Sixteen existing catalogue/deployment/workshop browser cases passed, and the
four new Remote browser cases passed on their final run. These cover desktop
and phone acquisition, shell selection, release, WASD, switching to logistics,
cancelling a pending acquisition, occupied markers and a concurrent claim.
The first concurrency test failed only on warning capitalization; its corrected
assertion passed. Desktop and phone screenshots were inspected locally.
The full browser suite and Fly deployment were not run for this stage.


## Robot command access and remote aircraft, 19 October 2026

This supersedes the preceding robot-or-tank Remote rule and earlier vehicle
catalogue access: only the robot opens Deploy and Remote. Initial core landing
from orbit still works. Vehicle movement/logistics controls remain independent.
Remote includes cruising aircraft with a compact map-targeting bar, R approach
rotation and LMB/tap commitment; WASD continues controlling the robot. Phone
movement buttons sit above the targeting bar. See docs/AIR_TRAFFIC.md for the
accepted anti-air avoidance, finite jet pass and post-strike cruise behavior.

## Destroyed dock recovery, 19 October 2026

Deploy → Logistics places equipment; Field logistics (L or the GND/ORB counter)
contains Recovery and construction → Damaged infrastructure. The old direction
to "check Logistics" confused these two screens. Dock controls now also offers
Rebuild dock directly, using the existing server repair order: 90 GND and eight
seconds, in the original position, retaining the assigned vessel. Both repair
panels show insufficient GND and live rebuild progress instead of inviting a
duplicate order. Field logistics preserves the full facility ID when submitting
a repair, including older IDs containing colons. Airbase rebuilding remains
150 GND through Field logistics. Prices, ownership and persistence rules are
unchanged.

Validation: type checking and 38 focused UI, shipyard and logistics tests passed,
including repair affordability, selection changes, duplicate-order protection
and the existing server rebuild/restart coverage. Implemented locally; not yet
pushed or deployed.

### Ruin artwork and tank placement feedback

Destroyed docks (including old narrow docks and empty shipyards), runways and
helipads now use deterministic scorched/cracked surfaces and bent metal panels.
Operational lights and berth markings disappear; the destroyed label stays
visible. Existing eight-second repair jobs show drones and a countdown and
restore normal art when complete. No extra particles, server entities, save
fields or collision changes are introduced. Other destroyed structures keep
their existing salvage/removal rules.

The first clarification retained the one-tank-per-player rule pending a
fleet-size decision; the subsequent [tank fleet stage](TANK_GUARD.md) removes
that limit and adds an individual tank selector under L → Field equipment.
Blocked placement no longer universally says "Choose a clear site". Finding a
tank closes the logistics modal and can locate one carried by a transport.

Validation: type checking, 25 tank/transport/repair-UI tests and the browser
blocked-placement-to-replacement flow passed. Intact/destroyed/rebuilding dock
and airfield previews were rendered and inspected locally. Not yet deployed.

## Menu navigation and map tools, 19 October 2026

Escape closes the current dialog, planner, catalogue or placement, even while
an input has focus or the room is paused. From combat it opens the Room menu
(the field guide in the legacy test world); closing Room resumes the battle.
It does not save-and-leave the campaign. The single keymap entry also appears
in F1. Switching between help and key reference keeps a solo room paused.

In a campaign, the DEMO/ID link opens the same Room menu without navigating or
disconnecting the pilot. Account settings remains available there; its return
link uses the active campaign instead of the planet lobby.

The map toolbar contains only zoom in/out, recenter, alert-station location,
planet overview, survey overview and tile grid. A shared layout stacks it below
the minimap and captions on desktop and phone. Other hostile-site locations
remain available through O/Shift+O. Site inspection and orbital/air support
shortcuts are available under L > Field equipment; deployment and V/H remain.

Validation: desktop/phone campaign and account browser checks, focused menu
navigation and toolbar layout checks (including phone landscape), type checking
and catalogue/tank-guard tests. Implemented locally; not yet pushed or deployed.

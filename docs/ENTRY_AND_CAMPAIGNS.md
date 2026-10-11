# Entry, planet selection and campaign ownership

9 October 2026. Optional accounts, orbital entry and campaign isolation are
implemented locally. `/` and `/campaigns/` provide the one-planet selector and
create/join/resume flow. The legacy shared world is retained at `/?legacy=1`.
See [ACCOUNT_DESIGN.md](ACCOUNT_DESIGN.md) for the Email/Demo flows and current
guest-linking/session defaults; Brevo receipt remains unverified.

## Planet entry stage

**Scope:** select Caldera -> create a named save -> open the room -> orbital
selection/core descent/robot; or resume a saved participant directly. Joining
by invitation chooses the host's campaign without another planet-selection step.
The same save supports solo play and invited teammates. No new combat rule is
introduced by this stage; permanent conquest remains a future combat objective.

**Presentation:** one reusable planet card with an upper-left monospace label,
soft terrain and slow rotation. Its texture is painted once from the existing
Caldera template. CSS animates the preview on the client; it does not start a
simulation or read another campaign. Rotation can be paused, starts paused for
reduced-motion users and pauses in a hidden tab. The globe is an entry preview,
not a change to the overhead square-tile battlefield or a promise of a larger map.

**State and authority:** selecting the card is local UI state; only the existing
server create endpoint writes the campaign. The server lists available templates
and rejects unknown IDs. Creation records `caldera-v1`; omitted template IDs
remain compatible with existing clients. Opening/resuming uses the saved ID and
existing membership rules. Adding a second card still requires a corresponding
world generator/migration; a metadata entry alone is insufficient.

**Entry and failure:** account login and Play as guest now lead to the lobby.
Guests can immediately use a host's code; Email/Demo accounts can select Caldera
and create saves. Existing saves and code redemption bypass selection. Failed
create/join requests stay in the lobby with their error; no room is opened by
viewing/selecting a planet. The legacy field test remains explicitly labelled.
Room invites remain under **Room → Create invitation code** on the battlefield.

**Deferred:** optional video, second planet, addressed/email invitations,
conquest and economy. [ECONOMY_DESIGN.md](ECONOMY_DESIGN.md) reserves the future
rules and integration boundary; current deployment remains free within its caps.

**Checks:** reject unavailable templates without a partial save; create the
selected template; verify account/guest entry, keyboard selection, motion
controls, phone layout, invitation bypass and saved robot return. Retain the
legacy orbital-deployment regression through its explicit URL.

Validation on 9 October: typecheck and **186 tests across 34 files passed**;
all **six selected desktop/phone browser checks passed** (accounts, campaign
entry/invite/saved return and legacy orbital deployment). Desktop and 390px phone
screenshots were reviewed; no horizontal overflow or browser script errors were
reported. Local port 8080 serves the new default entry. The historical gameplay
browser tests now name the legacy URL explicitly; they were not all rerun.
This stage has not been deployed to Fly.

## Implemented first landing

New guests, and existing guests with neither a core nor an occupied vehicle,
automatically enter orbital core selection. They retain their identity and owned
objects but have no ground body, collision, movement, weapons or interaction
rights until their core is accepted. The server permits only initial core
placement from orbit, excludes orbital presences from ground collision/target
lists, and blocks ground actions throughout the descent. The browser hides their
body and weapon HUD, stays in survey mode, and restores canvas focus for control
after landing. Only completed deployment unlocks movement and firing.

Returning core owners and occupied tank/ship/aircraft pilots retain their saved
state. An interrupted core landing resumes rather than creating another core.
Orbital presence is currently derived from saved core/vehicle ownership; revisit
that rule before implementing core destruction or multiple campaigns.

The old painted helipad and its reserved placement area are removed. Those tiles
use ordinary terrain rules; the existing optional defense drill remains a test
encounter, labelled a drill beacon rather than a helipad. Terrain saves and
deployed units are not erased by this update.

Validation: typecheck and 164 tests passed, including orbital action rejection,
restart, non-blocking orbital visitors and saved core descent. Four browser checks
passed: initial landing/resume/movement and tank deployment/boarding/saved exit,
each on desktop and phone. Screenshots checked for the absent helipad and orbit
HUD. Other historical browser scenarios were not all rerun in this stage.

## Why the legacy field test shares a world

The legacy runtime in `server.js` opens `world.sqlite` in the configured data
directory, reads its world from `meta`, and loads shared facilities and vehicles.
Each guest gets a different browser-bound scout identity inside that world.
Guest creation does not create a campaign. Named campaigns now have separate
world databases and runtimes, authorized through the shared campaign service.

Separate four concepts:

- Account or guest identity: who is playing and how they return.
- Planet template: terrain/theme/objective definitions used to start a game.
- Campaign: one saved instance with a host, members and shared progress.
- Player presence: orbital, deployment or on-ground state within a campaign;
  different from being logged in or connected.

**Agreed:** create one's own saved campaign or join a friend's. Selecting a
planet does not automatically put everyone into one public world. Start with one
planet template through a reusable selector. Reusing a card does not eliminate
the terrain, encounter and balance work needed for a different planet.

## Intended entry sequence

1. Optional opening video, if the author makes one. Always skippable; absent or
   failed media must not block entry. Returning players can bypass it.
2. Registration/login, with real email and Demo modes; no ANU restriction.
   Keep Play as guest under the existing guest-entry agreement.
3. Planet selection: circular, slowly rotating globes with blurred terrain and
   legible scientific-style names at the upper-left. Start with one selectable
   planet; do not imply a second playable world exists. Provide a static/reduced-
   motion presentation that retains selection information.
4. Resume/create an owned campaign or join a friend's campaign. These can be
   actions on the planet card rather than another mandatory full-screen page.
   Email/Demo accounts may host; unregistered guests may only join. Invited
   accounts retain membership, but may enter only while the owner opens the room.
5. A new participant enters orbital survey and chooses a valid core landing site.
   Before deployment, they have an identity but **no ground body/operator**.
6. The server accepts and saves the core deployment, plays descent/unfolding,
   and releases the robot when ready.

Returning players resume saved position, life and vehicle state rather than
landing another free core. Return from orbit resumes selection; return during
an accepted landing resumes that deployment. Reconnect cannot duplicate cores.
The free training rover has been removed from the first-entry path.

## Implementation boundaries

Campaign isolation comes before promising private worlds in the selector. Every
world read, mutation, stream, ownership check and saved entity must resolve an
authorized campaign on the server. A client-supplied campaign ID alone is not
authorization. Budget simulation and persistence across campaigns; saved campaigns
need not all simulate when nobody is playing.

Orbital presence must not be a target, ground collision obstacle or gunner.
The server rejects movement, firing, boarding and ordinary ground deployment
until that participant has an eligible body; only authorized initial core
placement is available. Hiding the rover sprite alone would leave invisible
gameplay behavior. Define whether orbital viewers keep simulation active before
changing encounter sleep rules.

Do not give the existing public world to whichever account registers first.
Retain it as the legacy shared test campaign, or migrate by an explicit owner
decision. Current account attachment preserves the registering guest's identity;
the clarified room policy closes and saves on owner exit, returning members to
the lobby. Departing guests' contributions remain, with the host able to manage
their buildings. Personal guest visits expire on deliberate leave, room closure,
restart or a 30-second disconnected interval. Owner interruption freezes the room
for 30 seconds before closure. Campaign deletion remains outside this stage.

## Proposed delivery order and acceptance

The next-stage brief, filled author answers and feasibility review are in
[CAMPAIGN_STAGE.md](CAMPAIGN_STAGE.md). The review distinguishes requested behavior
from later invitation/planet work. Its implementation section records the concrete
lifecycle, combat checkpoints, limits and validation of the local campaign layer.

1. Local reset tooling for repeatable tests (implemented below).
2. Account/session handling and both email modes (implemented locally; configure
   and verify actual SMTP receipt before claiming provider integration).
3. Campaign ownership, membership and isolation on the existing planet template
   (implemented locally, including single-use codes and a plain campaign list).
4. Planet selector around the now-implemented orbital-to-core-to-robot entry.
5. Optional video, visual polish and further planet templates.

Check two accounts with isolated campaigns, invited shared play, rejected cross-
campaign requests, no pre-landing body, concurrent landing validation, saved return
and disconnect during descent. Account creation is not campaign creation.

## Temporary local world reset

Implemented: `scripts/reset-world.mjs` and `world-maintenance.js`. This operator
command resets legacy local shared-world progress, facilities, vehicles, equipment
and metadata. Accounts and linked/pending player IDs are retained; unlinked guests
are deleted and account sessions are signed out. Named campaigns and account
membership are retained; invitation codes are revoked. It is not a browser
endpoint or per-campaign reset. Restart regenerates the existing terrain template,
not new random geography. Reload clients and sign in again; old unlinked guest
cookies receive new identities and retained account players enter orbit.

Stop the local server, then run from the repository root:

```powershell
node scripts/reset-world.mjs --data-dir .local/data --confirm-reset
pnpm.cmd dev
```

Use the actual directory if the server has a custom `DATA_DIR`. Before clearing,
SQLite creates a complete backup, including committed WAL content, in that
directory's `backups/` folder and prints its path. Backups contain guest credentials
and must stay private. Failed backup leaves progress intact. Unknown future tables
are rejected so future accounts cannot be silently erased.

The updated server holds a separate SQLite maintenance lock; reset refuses while
that server uses the directory. Always stop older pre-tooling server processes
too, since they do not participate in the new lock protocol. A crash releases the
SQLite lock without requiring manual removal of a stale PID file.

To restore, stop the server, preserve the current data directory, and copy the
printed backup as `world.sqlite` into a **new empty data directory**. Start with
`DATA_DIR` set to that directory. Do not overwrite a live database or mix a backup
with old `-wal`/`-shm` files. Backup retention is manual for this temporary tool.

The author selected local testing first. No Fly reset or deployment is part of
this stage. Checks use temporary worlds; the existing local save is untouched.

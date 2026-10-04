# Gunship broadsides and main salvo

Implemented 2026-10-04. Close swimmers can approach inside the main guns'
six-tile minimum range. The ship now has an independent secondary mount on
each side and two twin-barrel main turrets. This is a first balance pass.

## Controls and behavior

Updated: one click fires a turret volley; a rapid double-click fires a salvo.

- One LMB click / Space press / Volley button tap fires the next ready turret,
  using both barrels. Repeated separate clicks select the other ready turret.
- Two clicks or presses within 240ms fire all ready main turrets together: four
  rounds when both are loaded, two when only one is loaded. The client waits
  up to 240ms before dispatching a single click; a double-click sends one salvo
  command, with no extra single shot.
  Their muzzle positions, lateral impact offsets and slightly different flight
  times separate the trails and impacts. All four use the selected HE/Fire/Gas
  ammunition and existing heavy-shell damage or hazard profiles.
- Main aiming uses the cursor's distance and each actual turret bearing. The
  turrets traverse at 60 degrees/s, independently of hull rotation. Four blue
  diamonds preview their impacts. Range remains 6-40 tiles. Each turret reloads for six seconds independently;
  its cooldown persists across shell changes and restart. FORE/AFT HUD readouts
  show individual readiness.
- Held RMB / J / the Side guns button fires the mount that can bear on the
  cursor. Port and starboard each cover 160 degrees centered outward, leaving
  fore/aft blind sectors. The eight-tile range is measured from each mount.
  Each gun traverses at 270 degrees/s, must align within four degrees, and
  fires a 10-damage direct-hit round at 36 tiles/s every 180ms. No explosion.
- Side mounts move with the hull and cannot traverse through their inward
  limits. W/S drives; A/D brings the appropriate side to bear. Side guns have
  independent cooldowns and can fire during the main reload. Release, focus
  loss, menus, control changes and disconnection clear held fire.

The main salvo is simultaneous, not a queued automatic burst. Accepted rounds
retain their origins, bearings and ammunition. Pending click recognition is
canceled on blur, menus, disconnect, shell selection and seat/body changes. Steering,
changing shells or losing the ship cannot retarget rounds already in flight.
Friendly units remain immune. Side bullets share existing APCR rock/artillery
collision and enemy-only damage. Surface fire/gas use the existing naval rules.

## Authority, capacity and saves

`public/ship-armament.js` shares mount geometry and aim calculations between
the server and canvas. The server owns traverse, eligibility and cooldowns;
client-provided weapon or angle fields cannot redirect a secondary shot.
The side endpoint accepts individual shots, not persistent server autofire.

Every shot is validated before any round or reload is committed: all selected
actual impacts must be on the map, two slots per selected turret must be
available, and incoming fire/gas must fit existing count and area limits.
There are still at most eight heavy rounds in flight and 64 light projectiles
including reserved magnetic charges. Each hazardous main round reserves its
own full field. Rejected salvos do not partly fire or consume reload.

Independent main reloads and next-turret order are saved in additive ship JSON
fields. Old shared reloads initialize both turrets with the remaining cooldown;
replacement ships start both ready. The old reload field summarizes the larger
remaining timer and no longer gates firing.

New aft and side angles use additive fields in the existing ship JSON and
the existing movement checkpoint. Old saves initialize missing mounts from
the main bearing and outward side bearings. Cursor targets are transient.
Worlds, hull health, seats, docking and construction retain their prior rules.
Tracers, flashes, recoil and arc overlays are client visuals; no new particle
entities or synchronized water physics are introduced.

## Validation

`spec/ship-armament.test.ts` covers hull-relative arcs and heading wrap,
traverse/legacy defaults, independent reloads, close swimmer kills, immutable
four-round salvos, friendly immunity, and atomic rejection at limits/bounds.
`spec/ship.test.ts` also verifies HTTP authorization, forged inputs, actual
server bearing, main reload across restart, mount persistence and no automatic
secondary shots without requests. Type checking and 130 domain/HTTP tests pass.

`tests/browser/ship-armament.spec.js` verifies desktop RMB and phone button
holds, port/starboard selection, keyboard J, release/blur stop, blind sectors,
LMB/touch salvos, reload, a second viewer, resize and no page overflow/errors.
Both 1920x1080 and 390x844 pass; inspected screenshots are in
`docs/previews/ship-side-guns-*` and `ship-salvo-*`. The existing navy deployment
and docking, naval survival/replacement and tank deployment browser cases
also pass at both sizes: eight passing browser cases in total. These checks establish
behavior under a bounded workload, not final balance or 256 MB capacity.

Volley control validation: type checking and all 139 domain/HTTP tests pass.
Additional cases cover alternating mounts, independent reloads across restart
and ammunition, legacy cooldowns, one-ready-turret salvos and atomic capacity
rejection. Browser checks cover single shots, double-click/tap recognition,
FORE/AFT readouts, canceled pending clicks and no duplicate fire request.

# Gunship broadsides and main salvo

Implemented 2026-10-04; main battery revised locally on 22 October, secondary
battery on 23 October. Close swimmers can approach inside the main guns'
six-tile minimum range. The gunship now has six twin secondary mounts and three
triple-barrel main turrets. These are provisional balance values.

## Controls and behavior

Updated: one click fires a turret volley; a rapid double-click fires a salvo.

- One LMB click / Space press / Volley button tap fires the next ready turret,
  using three barrels. Repeated separate clicks cycle FORE -> RAISED -> AFT,
  skipping reloading turrets. The transport retains one twin-barrel bow turret.
- Two clicks or presses within 240ms fire all ready main turrets together: nine,
  six or three rounds depending on how many are ready. The client waits
  up to 240ms before dispatching a single click; a double-click sends one salvo
  command, with no extra single shot.
  Their muzzle positions, lateral impact offsets and slightly different flight
  times separate the trails and impacts. All rounds use the selected HE/Fire/Gas
  ammunition and existing heavy-shell damage or hazard profiles.
- Main aiming uses the cursor's distance and each actual turret bearing. The
  turrets traverse at 60 degrees/s, independently of hull rotation. Nine blue
  diamonds preview their impacts. Range is now 6-100 tiles. Each turret reloads for six seconds independently;
  its cooldown persists across shell changes and restart. FORE/RAISED/AFT HUD readouts
  show individual readiness.
- Held RMB / J / the Side guns button cycles the three twin mounts on the side
  facing the cursor, fore -> middle -> aft, skipping mounts that cannot bear.
  Port and starboard each cover 160 degrees centered outward, leaving fore/aft
  blind sectors. The eight-tile range is measured from each mount. Each mount
  traverses independently at 270 degrees/s and must align within four degrees.
  One pair fires per broadside every 180ms: two five-damage rounds at 36 tiles/s,
  preserving the former maximum damage rate before misses. No explosion.
- The green dispersion circle shows the spread at the aim plane. Radius grows
  from 0.12 tiles by 0.035 per tile of distance; the display also encloses current
  bearing error. Deterministic lateral dispersion stays inside outward arcs.
  Direct bullets continue to their range limit or first collision. Each barrel
  has its own muzzle flash and recoil. Carrier and transport retain their original
  two single secondary mounts; submarines have none.
- Side mounts move with the hull and cannot traverse through their inward
  limits. W/S drives; A/D brings the appropriate side to bear. Side guns have
  separate port/starboard cooldowns and can fire during the main reload. Release, focus
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
actual impacts must be on the map, three slots per selected gunship turret must be
available, and incoming fire/gas must fit existing count and area limits.
Artillery/naval admission uses a shared 12-incoming-shell threshold (aircraft
retain their separate admission rules); light projectiles retain their 64-slot
budget including reserved magnetic charges. Fire/Gas permit nine of one type,
12 fields total, including incoming reservations. Area limits remain 256 per type
and 512 total. Nine fire circles fit the per-type area budget. Each hazardous main round reserves its
own full field. Rejected salvos do not partly fire or consume reload.

Independent main reloads and next-turret order are saved in additive ship JSON
fields. Old shared reloads initialize all turrets with the remaining cooldown. Old
two-turret saves retain FORE/AFT exactly, with RAISED inheriting the saved summary
cooldown to avoid a free ready weapon during reload. New ships start ready. The old reload field summarizes the larger
remaining timer and no longer gates firing.

Raised, aft and side angles use additive fields in the existing ship JSON and
the existing movement checkpoint. Old saves initialize missing mounts from
the main bearing and outward side bearings. Cursor targets are transient.
Worlds, hull health, seats, docking and construction retain their prior rules.
Tracers, flashes, recoil and arc overlays are client visuals; no new particle
entities or synchronized water physics are introduced.

## Historical validation (before the triple-battery revision)

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

## Triple-battery validation

The 22 October stage adds checks for nine unique muzzle/owner records, individual
bearings, legacy timer migration, Fire/Gas capacity, atomic competing-ship
admission and accepted attacks surviving ship loss/combat checkpoint restoration.
HTTP checks verify three-shell cycling, independent timers and restart. Browser
checks exercise desktop and phone single/double clicks, all three HUD timers,
keyboard/secondary controls, peer visibility, resize and no duplicate dispatch.
Per-shell damage, six-second reload, range and hull handling are unchanged: a full
nine-round salvo is therefore stronger than the former four-round salvo and still
needs gameplay balance review. Secondary expansion is documented below.

Validation evidence: `.local/naval-triples-regression.log` records 641 passing
checks and two old eight-field fixtures. After updating those fixtures to the
shared nine-field limit, all 21 checks in their two files pass in
`.local/naval-capacity-regression.log`. TypeScript and diff/evidence checks pass.
Desktop and phone nine-shell browser cases pass individually; the initial
concurrent run needed a larger wall-clock allowance for simulation reload, and
a Windows Node worker also exited before executing one case. No gameplay timer
was lengthened. Local implementation only; no Fly capacity or deployment claim.

## Twin-secondary stage, 23 October

Six mount bearings, per-broadside firing order and cooldowns survive ordinary
ship/combat checkpoints. Legacy ships seed the added bearings from their existing
side turret angles. Replacement hulls clear the old firing order and added angles.
Each pair requires two free light-projectile slots (including magnetic charge
reservations); rejection spends neither cooldown nor order. Accepted bullets keep
their five-damage value, origin and direction through restart. Legacy single
rounds without the new damage field retain their original ten damage.

`spec/secondary-battery.test.ts` checks cyclic selection, invalid-mount skipping,
dispersion/arc bounds at rotated headings, atomic capacity rejection, restored
damage/cooldown/order, friendly immunity and unchanged carrier/transport behavior.
The existing ship HTTP and browser checks now assert paired fire, all three
mounts cycling, and independent mount persistence. Desktop and phone checks cover
held RMB/J/touch, release/blur, side switching and a second viewer; screenshots
show the dispersion circle and readiness count. This is local functional evidence;
the doubled light-projectile rate still needs multiplayer/Fly load measurement.

Validation: 69 domain/HTTP checks pass across nine files (55 battery/ship/carrier/
transport checks plus 14 combat/checkpoint/vehicle persistence regressions).
Both browser sizes pass. TypeScript, diff checks and coursework evidence checks
pass. Logs and inspected screenshots are under `.local/secondary-battery-*` and
`.local/secondary-browser-results/`. Not committed or deployed in this stage.

## Remote support stage, 23 October

[REMOTE_NAVAL_ORDERS.md](REMOTE_NAVAL_ORDERS.md) extends main-gun range to 100
tiles and adds saved movement, shore landing, three-target / three-salvo orders,
and automatic uncrewed broadside defence. Its rules supersede the earlier
request-only secondary-fire limitation above.

## Inboard secondary positions, 24 October

The author chose a slimmer Iowa silhouette (see [Ship visual scale](SHIP_VISUAL_SCALE.md)),
so the six gunship twin mounts moved off the hull edge onto the superstructure.
In hull-relative mount units (scaled by `shipArtScale`), they sit at x = ±0.6
(previously ±1.02) and y = -0.25 / 0.2 / 0.65 (previously -0.55 / 0 / 0.55). On
large 4 x 12 hulls this is ±1.2 tiles abeam at -0.75 / 0.6 / 1.95 tiles.
Server muzzles, arcs, dispersion and canvas art share `BATTERY_MOUNTS`, so the
eight-tile range, 160-degree arcs, cadence and damage are unchanged. They are
measured from the new positions, so reach beyond the side is slightly shorter.
The side-arc overlay is drawn from the middle mount. Saved bearings keep their
keys. Carrier and transport side guns keep their original edge positions.

## Transport stern turret, 24 October

The transport's one main turret moved to the stern and fires three barrels
(mount `fore`, label STERN, y 1.35). Its two single side guns moved aft to x ±0.58,
y 1.2 and are fired from these per-ship mounts. See
[Armored transport](ARMORED_TRANSPORT.md).

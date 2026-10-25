# Rail weapons: presentation and next weapon

24 October 2026. Author's sketches and requested first stage.

## Current local stage

- Railway cannon R-02 returns to **Rail**, beside track R-01. Missile batteries
  remain in Ground. Remote selection and crew locks are unchanged.
- Rails draw over terrain and metal flooring, beneath remains, wrecks, facilities
  and units. Placement ghosts remain overlays so the proposed route is readable.
- Completely new five-tile EW/NS segments arrive as a single central metal crate.
  Both inner tiles open together, then both outer tiles: **1 -> 3 -> 5**. Impact,
  dust and small optional shake reuse the metal-pod presentation. Reduced effects
  suppress dust and shake. The final five metal floor tiles persist.
- This track animation is cosmetic: accepted track keeps its immediate usability
  and remains free. New corners and one-tile straight pieces share one compact
  drop-crate animation. The crate reveals the track on one permanent metal base
  tile, matching the straight segment's flooring; no walls unfold around it.
  Junction upgrades and partially overlapping
  extensions retain their existing instant placement. Animation time
  is saved with cargo state, resumes after loading, and retires after completion.
- The cannon follows the first sketch: circular bearing, four stabilizers,
  angular breech, tapered sleeve and long single barrel with a plain muzzle.
  The author's follow-up sketch lengthens the barrel to about 1.7 times the first
  version, widens its bore and uses two gently tapered sections with only a small
  reduction at the forward section. There is no muzzle brake.
  Its existing 3-by-3 body and carriage clearance stay unchanged.
- Maximum ballistic range is **180 tiles**, previously 60, for HE, fire and gas.
  The upper elevation limit adjusts to preserve the **six-tile minimum**. Shared
  six-second reload, field budgets and physical traverse stay unchanged.
  More distant shells take longer to arrive under the existing ballistic model.
  Already accepted shells keep their stored trajectories.
- Follow-up balance: rail HE blast radius doubles from 3 to 6 tiles, including
  the full-damage core (1.1 to 2.2). Centre damage triples from 140 to 420 and
  edge damage from 20 to 60. The aiming circle uses the same profile. Naval HE,
  fire/gas fields and the independent eight-tile crater retain their values.
  Accepted shells keep their stored launch profile, including across restart.
- Wheel and +/- zoom now use the survey-scale lower bound in ordinary robot
  and vehicle play too. The 35% normal-play clamp is removed; maximum zoom remains
  180%. Zooming does not change control mode or automatically enter Remote.
- Cannon cargo panels may cover supporting rails; other machinery, terrain and
  body obstruction checks still apply. This fixes a discovered deployment conflict
  between its pod flooring and the track it needs to stand on.

## Rail MAC: implemented locally, ready for playtest

R-03 is a separate rail weapon using the second drawing: broad radiator housing,
two long parallel rails and cyan charging lights. Deploy through **B > Rail >
Rail MAC** on a clear, supported three-tile rail run, then select it with
**Remote / F**. WASD drives the carriage; stop and wait for the stabilizers,
aim with the mouse and click LMB to commit one shot. Escape releases control.
The radiator uses a steel frame: the previous gold outline was part of the mount
art, not an orbital crate. GND assembly does not create orbital pod panels.

Provisional balance for the first author playtest:

| Setting | Value |
| --- | --- |
| Purchase | 280 ORB globally, or 70 GND within construction support |
| Range / projectile speed | 180 tiles / 240 tiles per second |
| Charge / cooldown | 2.5 seconds / 10 seconds after discharge |
| Damage | 900 per enemy, effective against Bulwark armor |
| Penetration | Up to three distinct enemies, as requested |
| Capacity | One MAC and one ordinary rail cannon per scout; eight rail weapons total |

- One kinetic ammunition type; no explosive area damage or hazard-field budget.
  Rock and solid machinery stop the shot. A hostile facility takes a direct hit
  and stops it; friendly machinery blocks it without receiving damage.
- Charging locks the carriage and accepted direction. It cannot redirect toward
  later mouse movement. Accepted discharge continues after Escape, disconnect,
  or loss of the carriage; it is a committed attack, not a cancellable preview.
  Cooling permits movement, but firing still requires a stopped, braced carriage.
- Named campaigns save charge progress, locked trajectory, remaining travel and
  already-hit enemy IDs before acknowledging acceptance and during simulation.
  Restart resumes the attack without replaying penetrated targets. Legacy test
  combat retains its existing transient restart behavior.
- Brief server-confirmed traces show the fast shot. Cosmetic blood smears point
  along the shot direction; machinery produces no blood. Dead creatures retain
  their normal recyclable remains. Effects are bounded and support reduced mode.
- The existing rail discharge sound plays once, rather than once per trace tick.
  No additional audio asset is required.

Validation uses disposable worlds: charge timing, three-target armor penetration,
fourth-target survival, cover, friendly immunity, salvage, restart mid-charge and
mid-flight, acceptance rollback, paid deployment, operator authorization and
desktop/phone deployment and firing. No author save is reset.

Next: author playtest and balance tuning. Audio assets and additional planets
remain separate polish work.

## MAC mechanical detail - 24 October 2026

The latest sketch adds a rectangular coupling block between the radiator and
the existing twin rails. A recessed toothed ring rotates inside the block;
exposed meshing gears and a clamped cable loop run around its outer side.
Two metal collars finish the muzzle. Barrel geometry, targeting, recoil and
weapon balance retain their existing values. Animation uses the browser clock
and freezes with Reduced effects, without network or saved-state changes.

Local review covers ready, charging and cooling renders, horizontal rotation,
continuous animation and a stationary Reduced effects render, plus typecheck
and the required readiness checks.

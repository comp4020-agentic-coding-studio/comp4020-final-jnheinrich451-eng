# Combat feel and three shell types — concept record

Recorded 2026-10-01 after the user accepted the fullscreen layout and first drill.
Scope of this step: express and evaluate the concept. No new gameplay, effects,
enemy art or audio is implemented by this document. The wider vision remains in
[GAME_IDEAS.md](GAME_IDEAS.md).

Subsequent implementation: the user approved the first HE/crawler feedback step.
See [docs/HE_EFFECTS.md](docs/HE_EFFECTS.md) for implemented rules and measurements.
Artillery incendiary/gas fields are now playable; see
[docs/ARTILLERY_FIELDS.md](docs/ARTILLERY_FIELDS.md) for current tuning and limits.
Audio remains a later stage. Robot fuel/laser
weapons and personal survival are implemented in docs/ROBOT_COMBAT_DESIGN.md and
docs/SURVIVAL.md. The new railway-cannon proposal is recorded in
[docs/RAIL_ARTILLERY_DESIGN.md](docs/RAIL_ARTILLERY_DESIGN.md).

Robot-specific follow-up: [ROBOT_COMBAT_DESIGN.md](docs/ROBOT_COMBAT_DESIGN.md)
records the user's default liquid flamethrower, laser rifle, burning/fleeing
enemies, weapon-sized blast previews and aim-facing strafing. These are design
rules implemented in the current robot slice; proposed extensions are labelled
separately in that document.

## User's intended experience

- Make fighting feel like being under attack: players must defend themselves
  from death while eliminating hostile aliens. The current pad-defense drill
  now includes robot health, telegraphed attacks and shared-core recovery.
- The impact and the kill are rewards in themselves. Prioritize convincing
  feedback, enemy reactions and visible consequences; currency is not the focus
  of this step.
- Candidate enemies: powerful, ruthless-looking red-skinned monsters, possibly
  two-headed, crawling fast. Use purple blood to avoid human-like gore. This is
  an art direction to record first, not a settled sprite or animation request.
- Sound matters. The user intends to find free sound assets later. No audio
  selection or sourcing is required now.
- Define HE, incendiary and gas shells first; build effects progressively.
  HE should have a bomb/explosion effect and a "crate" effect. We tentatively
  interpret "crate" as **crater**, pending correction.

## Roles of the three shells

| Shell | User's direction | Tactical role proposed for the prototype |
| --- | --- | --- |
| HE | Explosion and likely crater | Immediate removal of a nearby threat or clustered enemies. One impact, one blast. |
| Incendiary | Slow monsters, burn/blacken their bodies, lethal fire contact, monsters avoid heat, fixed lifetime | Deny ground and steer approaches for a limited time. |
| Gas | Lethal contact, attracts monsters, each monster consumes some capacity, vanishes at zero | A trap with finite capacity that draws enemies away from an approach. |

These identities are deliberately different: HE solves an immediate problem,
fire changes where enemies can safely travel, and gas changes where they want
to travel. Attraction is fictional alien behavior, not a claim about real gas.

## Suggested first rules — proposals, not settled specifications

### HE: immediate impact

- Resolve a radial blast once on impact. Make an ordinary monster's direct or
  close hit visibly decisive. Radius, damage and any edge falloff remain open.
- Use a brief flash, pressure ring, debris/dust and a clear enemy hit/death
  response as separate readable beats. Avoid a long opaque effect hiding the
  surviving threats.
- Begin with a cosmetic crater/scorch mark. Terrain deformation, collision
  changes and lasting pathfinding consequences require a separate decision.
  The user may make explosion/crater artwork later.

### Incendiary: avoid the heat; contact is lethal

- Keep the user's lethal-contact rule for monsters in this first prototype.
  Do not silently replace it with weak repeated damage.
- Separate the requested slowing from the lethal region: a proposed outer heat
  band slows and warns; the visible burning core kills on contact. If a single
  boundary is preferred, drop slowing rather than claiming a monster both dies
  immediately and spends time burning alive in that same region.
- Enemies already inside the burning core when the shell lands die. Approaching
  monsters try to route around it. If no safe route exists, they can wait outside
  or seek another reachable objective, then reconsider when the fire expires.
  Do not require them to knowingly march into fire just to produce kills.
- Blackening can be a short death transformation and charred remains. It does
  not require survivors inside the lethal core. Exact gore and remains are open.
- The area disappears after a fixed **simulation-time** lifetime. Exact duration
  and area are not chosen. In an empty paused world the timer should also pause.

### Gas: attraction with a finite kill capacity

- A shell establishes a visible lethal region with remaining capacity. Nearby
  monsters are attracted into it according to a bounded lure range.
- Proposed simple accounting: each monster killed consumes one capacity unit,
  once. At zero, remove the region. The user's broader idea also permits different
  consumption for different monsters later; no weights are settled now.
- Resolve simultaneous entrants in a stable server order. A field with one unit
  left kills one entrant, consumes that unit, and cannot kill another afterwards.
  A monster overlapping several fields dies once and consumes capacity in only
  the field credited with that kill.
- A monster that touches gas is neutralized immediately; its death animation
  may linger briefly but it cannot keep moving or attacking as a living enemy.
- Suggested interaction rule: avoiding lethal fire takes priority over gas
  attraction. Fire can guide monsters toward an accessible gas trap, but the lure
  should not make them run through a fire wall. This priority needs play review.
- No timeout is implied by the user's gas idea. Whether unused gas persists,
  can be recalled, or eventually disperses remains open. A finite active-field
  limit and reload/cost rule are candidates to prevent unlimited prepared traps.

## Keep danger without weakening the weapon fantasy

Lethal fire and gas are intentional. Balance can come from placement, limited
coverage, reload, fire duration, gas capacity and enemies approaching from more
than one direction. Exact costs and timings should follow a playable comparison.
Do not introduce resistant enemies or immunity just to cancel the weapon's identity.
Special enemy exceptions, if wanted, need their own visible explanation and decision.

Personal survival needs its own small stage: alien attack tells, player health,
clear damage feedback, and a recoverable robot death/return loop. Earlier ideas
about facility control during respawn and a replicator remain in GAME_IDEAS.md;
their exact timings and consequences are not newly approved here. Avoid lengthy
inactivity as the default penalty while the core combat is being evaluated.

The established friendly-fire restriction remains: player HE, fire and gas do
not damage friendly players or structures. Alien attacks can threaten players.
Purple blood alone does not determine how graphic an effect feels; initially use
brief, stylized splashes and readable silhouettes. Dismemberment is not required.

## Feedback language to develop later

| Event | Visual direction | Sound role, when assets are available |
| --- | --- | --- |
| Cannon fires | Muzzle flash and recoil | Short firing transient |
| HE impact | Sharp flash, blast, dust, crater | Punchy impact then low decay |
| Monster hit | Brief reaction that does not conceal the target | Distinct hit cue |
| Monster killed | Clear collapse/disappearance and purple trace | Brief kill/death cue |
| Fire contact | Immediate neutralization, darkening and charred trace | Ignition plus restrained fire bed |
| Gas contact | Readable collapse; field density/capacity visibly falls | Gas release plus subtle depletion cue |

Keep the hazard boundary readable beneath decorative flames or clouds. Use
shape/motion and indicators as well as color to distinguish the two areas.
Keep flashes and screen shake restrained, with options to reduce them. Later
sound imports need their source, license and any attribution recorded; "free"
does not by itself specify reuse permissions. No effects or assets are promised
as already available.

## Shared simulation and bounded presentation

Damage, deaths, hazard boundaries, fire expiry and gas capacity belong to the
server. Every browser should agree on outcomes. Browsers render particles, smoke,
sound and decals locally; decorative particle count must not change collision.
Represent a hazard as an area and a small amount of state rather than a server
entity for every flame or smoke particle. Bound active fields and local effects;
reconsider enemy routes on relevant changes or a limited cadence.

This is an architecture direction, not evidence that full combat fits the
256 MB hosting limit. Measure a representative hazard/pathfinding workload later.
Current drills reset at server restart. Saving craters, blood, corpses or active
hazards is a future policy decision; do not silently grow the durable world log.

## Suggested progression and observable checks

1. Validate HE impact and one monster's hit/death response. A crude circle and
   temporary enemy art are enough to check blast outcomes first.
2. Add personal danger and a recoverable death loop so combat has stakes.
3. Test one fire region: monsters inside die, approaching monsters avoid it,
   any outer slowing is distinct, and the region expires as agreed.
4. Test one gas region: monsters enter, kills consume capacity exactly once,
   and the final capacity unit cannot eliminate several simultaneous entrants.
5. Combine the shells. Check whether each earns a useful role and whether fire
   routes and gas attraction produce understandable choices. Both browsers must
   agree on deaths, remaining gas capacity and expired hazards.
6. Replace temporary feedback with authored art and selected audio, then assess
   density, readability and server cost under a representative fight.

The user sets the pace. These steps are a proposal for later review, not an
instruction to start all of them now. Missing asset packs do not block discussing
or testing the underlying rules.

## Follow-up: direct controls and sentry weapons

Recorded after the HE play review, 2026-10-01. The user found the HE stage fun,
requested red/orange/gold shards, and asked which gameplay change should follow.

### User's direction

- Desktop movement should use WASD alone; aiming follows the mouse. Simplify
  firing into mouse buttons instead of selecting Cannon, a target, then FIRE.
  The message assigned right-click to both shell and machine gun, so the exact
  left/right mapping has been asked for clarification. Do not silently settle it.
- Player main cannon and machine gun are distinct weapons.
- The ordinary sentry should fire direct rounds rather than the current HE shell.
  Its selectable weapon modes are APCR (the user's chosen name), a flaming fuel
  jet, and gas rounds that create a small cloud on impact.
- The future robot flamethrower should share the fuel-jet visual language:
  a continuous-looking liquid stream with travel and a long trajectory, not a
  loose gaseous puff around the muzzle. This describes the game's appearance;
  no real weapon construction or fluid simulation is required.

### Agreed progression

Follow-up confirmation: LMB cannon and held RMB machine gun; WASD movement and
mouse aim. Replace the interactive HE selector with passive LMB/RMB weapon
readouts that briefly highlight accepted shots. The user accepted the order
below. Steps 1–2 are implemented in [docs/DIRECT_FIRE.md](docs/DIRECT_FIRE.md);
personal survival, fuel and gas remain subsequent playable stages.

1. Establish movement, aiming and firing controls together with a basic player
   machine gun. Keep the shared server in charge of cadence and hits. Preserve
   explicit touch controls and a keyboard firing alternative. Left/right fire
   actions apply in normal combat; deployment keeps its own selection/confirm
   interaction. Choose a deliberate replacement for mouse-drag panning so firing
   and panning cannot happen from the same gesture. Stop held fire on blur,
   pointer cancellation, modal opening and lost connection.
2. Give the ordinary sentry a direct-hit bullet mode using that same firing
   implementation. APCR is its game label; armor and penetration behavior need
   a later decision. A machine-gun bullet should not inherit HE splash or craters.
   Reserve the existing HE behavior for the player cannon and a future artillery
   installation. Existing placed sentries must retain identity and ownership.
3. Add player health, alien attack cues and a recoverable death loop to establish
   the personal danger already requested. Avoid postponing this behind a long
   series of cosmetic upgrades.
4. Build the fuel jet as one complete weapon. Visually, sample the nozzle over
   time and advance connected stream segments forward. Older segments retain
   their trajectories as the weapon turns, creating a trailing curve; add a
   bright core, uneven flame edges, a few detached droplets and an impact flare.
   Damage uses a bounded swept region on the server, not each decorative droplet.
   Contact lethality, deposited fire, avoidance and duration must connect to the
   incendiary rules above. A short hot stream should be legible before adding
   thick smoke or additional fire patches.
5. Add gas rounds and their small finite-capacity clouds. Set a stacking/merging
   rule and active-cloud limit before enabling rapid fire, so repeated bullets
   cannot create unlimited traps. Capacity accounting and attraction follow the
   earlier gas concept; exact numbers remain open.

The fuel/gas selector is proposed as a sentry loadout choice, since these modes
change the whole weapon's behavior and appearance. Whether it can be switched
freely after placement, and by whom, is still a design choice.

### This follow-up's completed visual change

HE debris now includes angular hot shards with short trails: pale gold when hot,
then orange and red while fading. They tumble along the existing ballistic arcs.
They replace part of the existing particle allocation, keeping the same burst
and particle caps and requiring no new server entities or network fields. They
are cosmetic, with no additional fragmentation damage. Water impacts retain
their splash presentation. Reduced effects omits the extra shard glow.

# Frontier sound-effect generation record

Started 8 November 2026, extended for Colonization on 9 November 2026. Source
audio and generation notes for the [War Zone](../docs/WAR_ZONE_GENERATED_AUDIO.md)
and [Colonization](../docs/COLONY_SOUND_EFFECTS.md) runtime integrations.

## Origin and authorship

The author asked Codex to inventory the War Zone weapons for sound preparation, then to identify existing calibers and propose sizes for unspecified weapons. Codex supplied the inventory and marked its proposed sizes as sound-design estimates. The author subsequently supplied the WAV files in this directory and a text record naming ElevenLabs as the generation tool.

The author confirmed that the short wording in the supplied record is what they used for prompts, explaining that ElevenLabs trims longer prompts. The supplied text is preserved verbatim below, including its asset names and brief prompt headings. No longer descriptions have been reconstructed or substituted. This records the supplied wording, not an independently retrieved ElevenLabs request history. Model/version, seed and generation settings were not supplied.

Codex inspected file names and WAV structure and assembled this record. That initial documentation pass did not generate or edit audio, audition the clips, or integrate them into the game. The author then requested integration and clarified that most clips are individual shots; a `_loop` or `_burst` name does not establish repeated firing or a seamless loop. The record is cited in [PROCESS.md](../PROCESS.md#four-corrections).

The author's account of the generation itself, given on 9 November 2026: ElevenLabs returns four takes per prompt, and most sounds took two or three prompt revisions before one take was kept (the author first said five or six, then corrected it against their history). Two screenshots of that history are kept as evidence: [the machine gun](../docs/evidence/sound-generation/elevenlabs-machine-gun-prompts.png) took three prompts, each adding detail to "7.62mm medium machine gun one shot", and [the railgun](../docs/evidence/sound-generation/elevenlabs-railgun-prompts.png) four. The War Zone prompts needed the most rewriting to sound like real military equipment; the generator understood the Colonization prompts with little change. The author-edited vehicle prompts below are the surviving record of those rewrites; discarded takes and intermediate prompts were otherwise not kept. The research note cites this account.

## Initial file audit (8 November 2026)

- 52 WAV files are present, totaling 34,855,896 bytes (33.24 MiB).
- All 52 have readable RIFF/WAVE headers, format and audio-data chunks within file bounds, and PCM format 1: 48,000 Hz, stereo, 16-bit.
- 49 files are 3.48 seconds long; the tank armor impact is 8 seconds, orbital cannon impact is 2 seconds, and magnetic cannon shot is 1 second.
- The supplied list names 100 assets: 50 exact filenames are present, 50 are absent under those exact names, and two additional filenames contain `_single`.
- Presence and valid WAV structure do not establish sound quality, correct weapon identity, seamless loops, or suitable in-game loudness. Those still need listening review.

### Naming differences

| Supplied filename | File present in this folder |
| --- | --- |
| `sfx_exp_bomb_carpet_cluster_burst_01.wav` | [sfx_exp_bomb_carpet_cluster_burst_single_01.wav](sfx_exp_bomb_carpet_cluster_burst_single_01.wav) |
| `sfx_wpn_orbital_cluster_line_drop_01.wav` | [sfx_wpn_orbital_cluster_line_drop_single_01.wav](sfx_wpn_orbital_cluster_line_drop_single_01.wav) |

These are candidate name correspondences only. The `_single` versions have not been treated as verified replacements for a carpet sequence or cluster line, and no files were renamed.

### Caliber and effect labels

- `762mm` in the supplied naming scheme means the proposed **7.62 mm** machine gun; it must not be read as 762 mm. Original filenames are retained.
- 35 mm AA, 30 mm jet rapid gun, and 25/40/105 mm gunship calibers are explicit in the game. The naval 127 mm reference comes from artwork describing a 5-inch mount. Other dimensions and bomb masses in the supplied names are proposed sound-design references; the approximately 500 mm orbital shell is tentative in the intro-video brief.
- Missile dimensions refer to body diameter; bomb values in kg are proposed mass classes. Lasers, flame jets and biological attacks do not acquire a physical caliber from an audio filename.
- Labels such as `gatling`, `chain`, `airburst`, `groundzero` and `skimmer_bile` describe the supplied assets. They do not establish a new weapon mechanism or gameplay behavior. In particular, the friendly 35 mm gun currently uses direct projectiles, and skimmer attacks and aquatic bile attacks are separate game events.

Sources: [ground weapons](../public/weapons.js), [gunship](../public/air-gunship.js), [combat](../public/combat.js), [naval artwork](../public/battleship-art.js), [intro-video brief](../docs/INTRO_VIDEO_BRIEF.md).

### Present files

All files below share the PCM format reported above. Duration is computed from the WAV data size and byte rate.

| File | Seconds | Match to supplied list |
| --- | ---: | --- |
| [sfx_creature_melee_armor_bite_01.wav](sfx_creature_melee_armor_bite_01.wav) | 3.48 | Exact |
| [sfx_creature_melee_heavy_body_slam_01.wav](sfx_creature_melee_heavy_body_slam_01.wav) | 3.48 | Exact |
| [sfx_exp_105mm_he_impact_01.wav](sfx_exp_105mm_he_impact_01.wav) | 3.48 | Exact |
| [sfx_exp_35mm_airburst_flak_01.wav](sfx_exp_35mm_airburst_flak_01.wav) | 3.48 | Exact |
| [sfx_exp_acid_120mm_splash_burst_01.wav](sfx_exp_acid_120mm_splash_burst_01.wav) | 3.48 | Exact |
| [sfx_exp_alien_spore_flak_airburst_01.wav](sfx_exp_alien_spore_flak_airburst_01.wav) | 3.48 | Exact |
| [sfx_exp_bomb_1000kg_cratermaker_01.wav](sfx_exp_bomb_1000kg_cratermaker_01.wav) | 3.48 | Exact |
| [sfx_exp_bomb_carpet_cluster_burst_single_01.wav](sfx_exp_bomb_carpet_cluster_burst_single_01.wav) | 3.48 | Additional `_single` name |
| [sfx_exp_gas_release_pressurized_hiss_01.wav](sfx_exp_gas_release_pressurized_hiss_01.wav) | 3.48 | Exact |
| [sfx_exp_he_120mm_impact_armor_01.wav](sfx_exp_he_120mm_impact_armor_01.wav) | 8.00 | Exact |
| [sfx_exp_he_120mm_impact_dirt_01.wav](sfx_exp_he_120mm_impact_dirt_01.wav) | 3.48 | Exact |
| [sfx_exp_he_127mm_impact_01.wav](sfx_exp_he_127mm_impact_01.wav) | 3.48 | Exact |
| [sfx_exp_heavy_280mm_impact_01.wav](sfx_exp_heavy_280mm_impact_01.wav) | 3.48 | Exact |
| [sfx_exp_incendiary_rupture_burst_01.wav](sfx_exp_incendiary_rupture_burst_01.wav) | 3.48 | Exact |
| [sfx_exp_mac_300mm_kinetic_groundzero_01.wav](sfx_exp_mac_300mm_kinetic_groundzero_01.wav) | 3.48 | Exact |
| [sfx_exp_missile_300mm_detonation_01.wav](sfx_exp_missile_300mm_detonation_01.wav) | 3.48 | Exact |
| [sfx_exp_naval_406mm_he_impact_01.wav](sfx_exp_naval_406mm_he_impact_01.wav) | 3.48 | Exact |
| [sfx_exp_orbital_cannon_groundzero_01.wav](sfx_exp_orbital_cannon_groundzero_01.wav) | 2.00 | Exact |
| [sfx_exp_orbital_heavy_bomb_blast_01.wav](sfx_exp_orbital_heavy_bomb_blast_01.wav) | 3.48 | Exact |
| [sfx_exp_rocket_70mm_he_impact_01.wav](sfx_exp_rocket_70mm_he_impact_01.wav) | 3.48 | Exact |
| [sfx_exp_strategic_500mm_warhead_01.wav](sfx_exp_strategic_500mm_warhead_01.wav) | 3.48 | Exact |
| [sfx_impact_laser_rifle_burn_metal_01.wav](sfx_impact_laser_rifle_burn_metal_01.wav) | 3.48 | Exact |
| [sfx_impact_railgun_120mm_hypervelocity_01.wav](sfx_impact_railgun_120mm_hypervelocity_01.wav) | 3.48 | Exact |
| [sfx_wpn_aa_35mm_single_shot_01.wav](sfx_wpn_aa_35mm_single_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_alien_laser_beam_loop.wav](sfx_wpn_alien_laser_beam_loop.wav) | 3.48 | Exact |
| [sfx_wpn_alien_mortar_120mm_launch_01.wav](sfx_wpn_alien_mortar_120mm_launch_01.wav) | 3.48 | Exact |
| [sfx_wpn_alien_skimmer_bile_spit_01.wav](sfx_wpn_alien_skimmer_bile_spit_01.wav) | 3.48 | Exact |
| [sfx_wpn_alien_spore_flak_launch_01.wav](sfx_wpn_alien_spore_flak_launch_01.wav) | 3.48 | Exact |
| [sfx_wpn_bomb_1000kg_heavy_screamer_01.wav](sfx_wpn_bomb_1000kg_heavy_screamer_01.wav) | 3.48 | Exact |
| [sfx_wpn_bomb_250kg_fall_whistle_01.wav](sfx_wpn_bomb_250kg_fall_whistle_01.wav) | 3.48 | Exact |
| [sfx_wpn_flame_heavy_fire_loop.wav](sfx_wpn_flame_heavy_fire_loop.wav) | 3.48 | Exact |
| [sfx_wpn_flame_robot_fire_loop.wav](sfx_wpn_flame_robot_fire_loop.wav) | 3.48 | Exact |
| [sfx_wpn_gunship_105mm_shot_01.wav](sfx_wpn_gunship_105mm_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_gunship_25mm_gatling_loop.wav](sfx_wpn_gunship_25mm_gatling_loop.wav) | 3.48 | Exact |
| [sfx_wpn_gunship_40mm_shot_01.wav](sfx_wpn_gunship_40mm_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_heli_30mm_single_shot_01.wav](sfx_wpn_heli_30mm_single_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_jet_30mm_gatling_burst_01.wav](sfx_wpn_jet_30mm_gatling_burst_01.wav) | 3.48 | Exact |
| [sfx_wpn_jet_40mm_he_shot_01.wav](sfx_wpn_jet_40mm_he_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_laser_rifle_shot_01.wav](sfx_wpn_laser_rifle_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_mac_300mm_shot_01.wav](sfx_wpn_mac_300mm_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_mg_762mm_shot_loop.wav](sfx_wpn_mg_762mm_shot_loop.wav) | 3.48 | Exact |
| [sfx_wpn_missile_300mm_launch_01.wav](sfx_wpn_missile_300mm_launch_01.wav) | 3.48 | Exact |
| [sfx_wpn_naval_127mm_single_shot_01.wav](sfx_wpn_naval_127mm_single_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_naval_20mm_burst_loop.wav](sfx_wpn_naval_20mm_burst_loop.wav) | 3.48 | Exact |
| [sfx_wpn_naval_406mm_single_shot_01.wav](sfx_wpn_naval_406mm_single_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_orbital_beam_ground_sizzle_loop.wav](sfx_wpn_orbital_beam_ground_sizzle_loop.wav) | 3.48 | Exact |
| [sfx_wpn_orbital_cluster_line_drop_single_01.wav](sfx_wpn_orbital_cluster_line_drop_single_01.wav) | 3.48 | Additional `_single` name |
| [sfx_wpn_railgun_120mm_shot_01.wav](sfx_wpn_railgun_120mm_shot_01.wav) | 1.00 | Exact |
| [sfx_wpn_railway_280mm_shot_01.wav](sfx_wpn_railway_280mm_shot_01.wav) | 3.48 | Exact |
| [sfx_wpn_rocket_70mm_launch_01.wav](sfx_wpn_rocket_70mm_launch_01.wav) | 3.48 | Exact |
| [sfx_wpn_sub_missile_water_eject_01.wav](sfx_wpn_sub_missile_water_eject_01.wav) | 3.48 | Exact |
| [sfx_wpn_tank_120mm_shot_01.wav](sfx_wpn_tank_120mm_shot_01.wav) | 3.48 | Exact |

### Listed files not present under their exact names

These are unfilled entries in the supplied list, not a requirement to generate every variation. Some may ultimately be cut from longer clips or served by shared sounds after listening review. The two naming differences above are included in this exact-name comparison.

- `sfx_wpn_tank_120mm_shot_02.wav`
- `sfx_wpn_railway_280mm_breech_recoil_01.wav`
- `sfx_wpn_naval_406mm_salvo_shot_01.wav`
- `sfx_wpn_naval_127mm_twin_shot_01.wav`
- `sfx_wpn_gunship_105mm_interior_shot_01.wav`
- `sfx_wpn_mg_762mm_shot_attack.wav`
- `sfx_wpn_mg_762mm_shot_tail.wav`
- `sfx_impact_bullet_762mm_dirt_01.wav`
- `sfx_impact_bullet_762mm_metal_01.wav`
- `sfx_wpn_naval_20mm_shot_01.wav`
- `sfx_wpn_naval_20mm_shot_tail.wav`
- `sfx_wpn_gunship_25mm_gatling_attack.wav`
- `sfx_wpn_gunship_25mm_gatling_tail.wav`
- `sfx_wpn_jet_30mm_gatling_tail_01.wav`
- `sfx_exp_30mm_he_cluster_impact_01.wav`
- `sfx_wpn_heli_30mm_chain_burst_01.wav`
- `sfx_wpn_heli_30mm_shot_tail_01.wav`
- `sfx_wpn_aa_35mm_twin_burst_01.wav`
- `sfx_wpn_jet_40mm_he_burst_01.wav`
- `sfx_exp_40mm_he_impact_01.wav`
- `sfx_wpn_gunship_40mm_burst_01.wav`
- `sfx_exp_40mm_impact_dirt_01.wav`
- `sfx_wpn_railgun_120mm_charge_01.wav`
- `sfx_wpn_mac_300mm_charge_01.wav`
- `sfx_wpn_laser_rifle_shot_02.wav`
- `sfx_wpn_alien_laser_charge_01.wav`
- `sfx_wpn_alien_laser_burst_01.wav`
- `sfx_impact_alien_laser_burn_01.wav`
- `sfx_wpn_rocket_70mm_flyby_loop.wav`
- `sfx_wpn_missile_300mm_exhaust_tail_01.wav`
- `sfx_wpn_sub_missile_rocket_ignition_01.wav`
- `sfx_exp_bomb_250kg_single_impact_01.wav`
- `sfx_exp_bomb_carpet_cluster_burst_01.wav`
- `sfx_env_fire_sticky_gel_burn_loop.wav`
- `sfx_wpn_orbital_cannon_incoming_screamer_01.wav`
- `sfx_wpn_orbital_bomb_reentry_tear_01.wav`
- `sfx_wpn_orbital_beam_focus_charge_01.wav`
- `sfx_wpn_orbital_beam_sustained_loop.wav`
- `sfx_wpn_orbital_beam_cutoff_01.wav`
- `sfx_wpn_orbital_cluster_line_drop_01.wav`
- `sfx_exp_orbital_cluster_cascading_blast_01.wav`
- `sfx_wpn_flame_robot_ignite_start.wav`
- `sfx_wpn_flame_robot_ignite_stop.wav`
- `sfx_wpn_flame_heavy_ignite_start.wav`
- `sfx_wpn_flame_heavy_ignite_stop.wav`
- `sfx_wpn_alien_mortar_incoming_whistle_01.wav`
- `sfx_env_acid_corrosion_metal_loop.wav`
- `sfx_wpn_alien_vent_toxic_rupture_01.wav`
- `sfx_impact_bile_splash_armor_01.wav`
- `sfx_creature_melee_chitin_claw_scrape_01.wav`

## Runtime integration

The [sound loader](../public/sound.js) uses the [sound catalogue](../public/sound-catalog.js) to select 67 active recordings from `public/audio/effects/generated/`, with PCM WAV fallbacks when compressed loading or decoding fails. The original WAVs remain unchanged. The [runtime manifest](../public/audio/effects/generated/manifest.json) records source and output hashes, fallback hashes, durations and preparation. The preparation script exports only catalogue selections; superseded source takes remain in this folder. The earlier six-sample Kenney palette remains on disk as historical material and is no longer selected by this loader.

See the [integration record](../docs/WAR_ZONE_GENERATED_AUDIO.md) for exact event mappings, shared impact sounds, finite playback for sustained weapons and browser checks. No seamless loop is inferred from a filename. The final loudness/timbre mix and any future extraction of individual shots from genuinely multi-shot recordings still need listening review.

### Machine-gun replacement, 9 November 2026

The author heard a burst that did not match individual machine-gun firing and
supplied [sfx_wpn_mg_762mm_shot_single_01.wav](sfx_wpn_mg_762mm_shot_single_01.wav).
It replaces `sfx_wpn_mg_762mm_shot_loop.wav` in the `machine-gun` role. The older
take remains as source history and is no longer selected for playback. At this
stage there were 53 source WAVs and 52 active selections. The replacement is 3.48 seconds,
48 kHz stereo PCM16; its full tail is preserved in both browser formats. Source
SHA-256: `8a821ee150dba48a1e6319c562aeae0a0d1cb546d212ed43f09d988cde68b48b`.
The exact new generation prompt/settings were not supplied. The initial prompt
record below is unchanged and must not be treated as this replacement's prompt.

## Supplied deployment and vehicle effects (9 November 2026)

The author supplied all 15 proposed recordings and edited the prompts below for
their generation record. Those edited prompt cells are retained verbatim. The
folder now contains 68 source WAVs, with 67 recordings selected for playback;
only the superseded machine-gun take is inactive. All new sources are 3.48-second,
48 kHz stereo PCM16. Model version, seed and other settings were not supplied.

The last two files match their swapped prompts, confirmed by the author:
`sfx_aircraft_touchdown_01.wav` supplies the continuous mechanical servo, while
`sfx_mechanical_servo_loop.wav` supplies the one-shot aircraft touchdown. Neither
file is renamed. The table retains the originally planned type to preserve the
record; the runtime catalogue explicitly follows the confirmed content.

Eleven continuous sources receive an 80 ms linear tail-to-head crossfade in
derived browser copies only, producing a 3.40-second loop period. One-shot
exports retain their full tails after the existing leading-silence trim. The
opening-panel prompt includes a ground impact; playback uses its first .55
seconds and schedules the separate panel-slam recording at actual contact.
Engine startup/shutdown can be separate later clips. Continuous playback now
follows operating state, movement, distance, pause and mute. Source recordings
and their hashes remain unchanged; join smoothing is not a human mix review.

| Filename as saved | Originally planned type | Author-edited ElevenLabs prompt |
| --- | --- | --- |
| `sfx_pod_descent_loop.wav` | Loop | Heavy cargo pod descending, rushing air and low thruster rumble, seamless loop. |
| `sfx_pod_ground_impact_01.wav` | One shot | One heavy metal drop pod hits ground, heavy metal compacts the ground, deep thud, with later stones scattering, short decay. |
| `sfx_pod_panel_open_01.wav` | One shot | One heavy hinged steel panel opening, hydraulic hiss and metal creak, with it drops to the ground with no slow down, with heavy metal compacting |
| `sfx_pod_panel_ground_slam_01.wav` | One shot | Single heavy armored steel drop pod ramp door slamming flat onto hard desert rock, massive solid iron-on-earth thud, violent metallic clang, brief dirt crunch, single isolated impact event with zero bounces. |
| `sfx_vehicle_engine_idle_loop.wav` | Loop | Heavy military main battle tank 12-cylinder diesel engine idling, steady rhythmic low-frequency mechanical piston throb, deep exhaust purr, continuous smooth engine rumble at constant RPM, zero revving, zero acceleration, seamless loop. |
| `sfx_vehicle_engine_drive_loop.wav` | Loop | Heavy diesel tank engine operating under continuous high load at constant high RPM, powerful sustained exhaust roar, mechanical turbocharger whine, steady vibration, zero gear shifting, zero speed variation, seamless loop. |
| `sfx_vehicle_tracks_loop.wav` | Loop | Continuous heavy steel tank tracks rolling over dry rocky terrain at steady speed, rhythmic metal track link clinking, guide horn squeak, drive sprocket tooth engagement, grinding gravel crunch, unbroken mechanical movement loop. |
| `sfx_ship_engine_loop.wav` | Loop | Colossal naval ship diesel turbine engine operating at steady cruise, deep sub-bass vibration (30-80 Hz) thrumming through thick steel hull plates, distant sustained mechanical drone, continuous unbroken engine loop. |
| `sfx_ship_wake_loop.wav` | Loop | Massive naval ship bow cutting through open ocean water at steady speed, continuous churning foamy wake, heavy water displacement surge, rhythmic surface splash, unbroken oceanic loop. |
| `sfx_ship_sand_slide_loop.wav` | Loop | Massive steel sandship hull sliding continuously across dry desert sand dunes, heavy granular grit friction hiss, rushing fine sand grains rubbing along armored plate, deep hollow metallic hull scraping resonance, steady unbroken loop. |
| `sfx_helicopter_rotor_loop.wav` | Loop |Heavy military attack helicopter main rotor blades chopping through air at constant RPM, steady rhythmic aerodynamic thwack-thwack-thwack, underlying gas turbine whine, stationary perspective, zero doppler, seamless continuous loop. |
| `sfx_jet_engine_loop.wav` | Loop | Military turbofan fighter jet engine running at steady high cruise thrust, searing high-pressure exhaust air roar, high-pitched intake turbine blade whine, unbroken constant combustion loop, stationary aircraft perspective, no flyby. |
| `sfx_heavy_aircraft_engine_loop.wav` | Loop | Four-engine heavy military transport aircraft cruising at constant speed, deep droning turboprop propeller buzz, heavy multi-engine harmonic beat frequency, low airframe rumble, continuous unbroken flight loop. |
| `sfx_mechanical_servo_loop.wav` | Loop | Heavy military aircraft landing gear touching down on runway, sharp rubber tire friction screech against pavement, sudden heavy hydraulic oleo strut compression thud, single isolated touchdown event. |
| `sfx_aircraft_touchdown_01.wav` | One shot | Heavy industrial electric servo motor running at constant velocity, precision planetary gear whine, hydraulic actuator assist hum, smooth high-torque powered mechanical rotation, seamless unbroken movement loop. |

The game schedules the panel-slam recording independently for each panel
reaching the ground. Core/tank pods define impact, unfolding and
staggered panel timing in `public/pod.js` and `public/core-effects.js`; cargo
crates have their own timing in `public/cargo-effects.js`. Ship movement needs
water and sand variants because Sirocco ships travel over sand.

Later useful additions: robot footsteps, vehicle hatch/ramp movement and latches,
rail travel/brakes, submarine dive/surface, damage/destruction, colony shuttle
thrust, construction printing, working processors, sprinkler spray, harvest and
pickup cues, campfire and rain. These remain suggestions, not current sounds.

Also audition the existing naval 20 mm, jet 30 mm and gunship 25 mm recordings
for the same burst-per-shot mismatch. Their `burst`/`loop` filenames are a reason
to check, not evidence that the recordings actually contain multiple shots.

## Colonization effects (9 November 2026)

The author asked for cute sounds for animated facilities, fishing, the furry
mechanical spider, shuttle flights and warehouse cargo drones. The initial
proposal covered 24 cue types. The author then supplied 52 recordings: two
alternating spider footsteps, nine groups of four one-shot variations, six
single-take one-shots and eight single-file loops. These now have a separate
Colonization catalogue and playback path. The prompt rows below retain the
generation wording; they are separate from the War Zone prompts above and the
original supplied record below.

Direction: small, warm, tactile science-fiction sounds. Use rounded chirps,
cushioned mechanical clicks, gentle whirring and water plips. Keep enough real
mechanical detail to match the white-and-gold equipment. Spider vocalizations
should be brief and expressive; facilities should sit quietly beneath the music.
Generate each file separately, with no background music or spoken words. One-shot
files contain one action/reaction; loops are steady beds with no start/stop baked
in. A single footstep can be scheduled at a restrained stride cadence rather
than repeating an entire eight-leg walking sequence.

| Base filename | Type | Generation prompt | Intended cue |
| --- | --- | --- | --- |
| `sfx_colony_spider_step_01.wav` | One shot | One tiny cushioned robot footstep, soft padded tap and faint servo tick. | A walking stride |
| `sfx_colony_spider_curious_01.wav` | One shot | One curious chirrup from a small friendly robot pet, round electronic tone, gentle upward inflection. | Newly noticing a bed or furnishing, used sparingly |
| `sfx_colony_spider_purr_01.wav` | One shot | A small furry mechanical pet gives one brief contented purr, warm vibration and tiny motor hum. | Petting without a fish treat |
| `sfx_colony_spider_happy_01.wav` | One shot | One delighted robot-pet chirrup, soft bouncy electronic squeak with a tiny happy trill. | Adoption or a distinct happy reaction |
| `sfx_colony_spider_eat_01.wav` | One shot | Small friendly mechanical pet eating one treat, gentle crunchy munch and a soft satisfied chirp. | A fish treat actually consumed |
| `sfx_colony_fish_cast_01.wav` | One shot | One light fishing-line swish followed by a small bobber plop into calm water. | Cast or recast |
| `sfx_colony_fish_bite_01.wav` | One shot | One clear playful water plip, tiny bobber tug with a bright delicate droplet ping. | A new bite, clear to the local angler |
| `sfx_colony_fish_reel_loop.wav` | Loop | Small fishing reel turning steadily, soft rounded ratchet clicks and light line friction, seamless loop. | While actively reeling, quiet when released |
| `sfx_colony_fish_catch_01.wav` | One shot | One small fish lifted from water, cheerful splash and a tiny warm two-note success chime. | Confirmed catch and catch card |
| `sfx_colony_fish_escape_01.wav` | One shot | One little fish slips back into a pond, soft descending water bloop and gentle splash. | Confirmed escape; no alarm or failure buzzer |
| `sfx_colony_printer_work_loop.wav` | Loop | Compact friendly construction printer working steadily, soft servo whirs and delicate nozzle fizz, seamless loop. | The construction rig's printing phase |
| `sfx_colony_build_ready_01.wav` | One shot | One small precision mechanism clicks into place with a soft warm completion ping. | Construction reveal completes |
| `sfx_colony_machine_work_loop.wav` | Loop | Cozy compact processing machine working, soft rounded motor hum and muted rhythmic ticks, seamless loop. | Active processors or harvest machinery |
| `sfx_colony_bio_generator_loop.wav` | Loop | Small bio-generator working steadily, soft bubbly gurgles and a warm low hum, seamless loop. | Active bio-generator |
| `sfx_colony_sprinkler_loop.wav` | Loop | Small garden sprinkler spraying steadily, delicate water hiss, droplets and gentle rotary ticks, seamless loop. | Actual irrigation |
| `sfx_colony_harvest_01.wav` | One shot | One ripe alien fruit gently plucked, soft leafy rustle and a satisfying rounded pop. | Accepted harvest action |
| `sfx_colony_item_collect_01.wav` | One shot | One small cargo pickup, soft rounded pop with a light latch click and cushioned clunk. | Crate or item collection |
| `sfx_colony_drone_hover_loop.wav` | Loop | Small friendly cargo drone hovering, soft smooth electric fan hum, airy and rounded, seamless loop. | Warehouse drone flight |
| `sfx_colony_drone_pickup_01.wav` | One shot | One tiny cargo drone gripping a crate, gentle latch clack and a tiny servo chirp. | A crate successfully attached for the return flight |
| `sfx_colony_drone_unload_01.wav` | One shot | One small cargo crate set down at storage, padded clunk and light clamp-release click. | Loaded drone deposits cargo at the warehouse |
| `sfx_colony_shuttle_ignition_01.wav` | One shot | One compact sci-fi shuttle thruster ignition, gentle low whoomp and soft turbine swell. | Belly thrusters ignite for departure |
| `sfx_colony_shuttle_lift_loop.wav` | Loop | Civilian shuttle lift thrusters hovering steadily, warm low hum and airy downward thrust, seamless loop. | Belly-thruster lift, return hover and descent |
| `sfx_colony_shuttle_engine_loop.wav` | Loop | Civilian cargo shuttle engine running steadily, smooth restrained turbine hum and soft exhaust hiss, seamless loop. | Main engine during powered climb and return approach |
| `sfx_colony_shuttle_touchdown_01.wav` | One shot | One cargo shuttle landing gently on its feet, cushioned hydraulic thump and brief landing-gear rattle. | Landing gear meets the pad |

### Supplied variations and runtime copies

The author's playback instructions are implemented as follows:

- `spider_step_01` and `spider_step_02` alternate on audible walking strides.
- `spider_curious`, `spider_purr`, `spider_happy`, `spider_eat`, `fish_cast`,
  `fish_bite`, `item_collect`, `drone_pickup` and `drone_unload` each have
  `_01` through `_04`. Each playback randomly chooses a take other than the
  previous take in that group. All filenames carry the `sfx_colony_` prefix.
- The other six one-shot types each use `_01`; each of the eight loops uses
  its sole supplied `_loop.wav` file.

All 52 sources are 3.48-second, 48 kHz stereo PCM16 WAVs. Original files remain
unchanged. `node scripts/prepare-sound-effects.mjs --colony` exports a separate
collection into `public/audio/effects/colony/`: Ogg Opus plus PCM WAV fallback,
with source/export SHA-256 hashes and durations in its `manifest.json`.
One-shots retain their full tail after leading-silence trimming. Loops use the
existing 80 ms wrap crossfade, producing a 3.40-second repeat period. Runtime
copies total 2,705,132 bytes Ogg and 33,430,604 bytes PCM fallback; decoded audio
uses approximately 63.76 MiB. The preparation check preserved all 259 existing
source and combat-runtime files byte for byte.

Playback and validation are recorded in
[`docs/COLONY_SOUND_EFFECTS.md`](../docs/COLONY_SOUND_EFFECTS.md). Colonization
loads only this palette. The Crew menu provides independent effects volume and
mute, sharing the existing browser preference with War Zone.

Prioritize the spider's purr/curious/eating reactions and fishing's cast, bite,
reel and catch first. Pet feeding already has its own accepted result and counter;
it should choose the eating reaction instead of stacking happy, purr and eating
clips together. The pet has no hunger or upkeep system, so no hungry/distress
alarms are implied. Walking sounds stop when it sits; noticing a plant should
not produce constant chatter.

Fishing's bite should remain easy to hear over background machinery, while a
catch sound waits for the server-confirmed result. Reeling is a continuous
interaction, so its sound follows holding/releasing the reel. Nearby world sounds
can be shared spatially; another player's distant catch should not produce a
full-volume reward cue in this player's interface.

Shuttle audio follows the existing saved flight phases: ignition once, belly
thrusters during lift/hover/descent, main engine during powered flight, then one
touchdown as the landing gear meets the pad. Fade the two loops with their
respective thruster intensity; keep parked and away phases quiet. Separate clips
can follow the animation instead of baking a whole takeoff or landing into one
recording. The shuttle should feel heavier than the drone but remain gentle.

The drone's existing proposed hover loop covers both outbound and return flight.
Play pickup only when a crate attaches, and unload only when a loaded return
actually deposits materials. An empty return after hand collection has no cargo
cue. Use these dedicated cues instead of stacking the generic item-collection
sound on the same event; retain that generic cue for manual/other collection.
Deduplicate by shipment or drone/crate trip and do not replay one-shots on join.
A drone can finish one delivery and begin the next within a simulation tick, so
playback observes successful delivery rather than merely an idle task.

Facility loops follow useful work, with slow cosmetic idle animation staying
quiet. Printer audio follows descend/unfold/print/fold/depart phases rather than
playing a complete canned construction sequence on every frame. The printer's
completion cue marks the visual reveal; it must not imply a new gameplay delay.
Start with only the nearest few quiet machinery layers, preserve music/effects
independence, pause hidden tabs and never replay old catches or pet reactions on
reconnect. Colonization loads its own palette.

Optional later additions: robot track movement, kettle bubbling, charging
connection, light rain, lake water, rustling plants and a quiet
campfire. Existing bio-generator and processor animation, irrigation tasks,
printing stages, warehouse drone tasks and pet/fishing states provide the timing
sources; new gameplay mechanics are not required for this proposal.

Implementation references: `public/colony-pet.js`, `public/colony-rest.js`,
`public/colony-fishing-ui.js`, `public/colony-print-art.js`,
`public/colony-industry.js`, `public/colony-machinery.js`,
`public/colony-shuttle-art.js`, and `public/colony-crates.js`.

## Author-supplied short prompt and filename record

The following block preserves the supplied text exactly. Short headings, punctuation, and proposed filenames are retained as supplied; no extra prompt prose has been added.

```text
The naming conventions follow standard game audio hierarchy (sfx_<category>_<weapon>_<subsystem/action>_<variation>.wav) to drop cleanly into a game engine audio manager or FMOD/Wwise event bus.
- Repository Asset Names:
  - sfx_wpn_tank_120mm_shot_01.wav
  - sfx_wpn_tank_120mm_shot_02.wav
  - sfx_exp_he_120mm_impact_dirt_01.wav
  - sfx_exp_he_120mm_impact_armor_01.wav
- Firing Prompt (ElevenLabs):
- Detonation Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_railway_280mm_shot_01.wav
  - sfx_wpn_railway_280mm_breech_recoil_01.wav
  - sfx_exp_heavy_280mm_impact_01.wav
- Firing Prompt (ElevenLabs):
- Detonation Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_naval_406mm_salvo_shot_01.wav
  - sfx_wpn_naval_406mm_single_shot_01.wav
  - sfx_exp_naval_406mm_he_impact_01.wav
- Firing Prompt (ElevenLabs):
- Detonation Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_naval_127mm_twin_shot_01.wav
  - sfx_wpn_naval_127mm_single_shot_01.wav
  - sfx_exp_he_127mm_impact_01.wav
- Firing Prompt (ElevenLabs):
- Detonation Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_gunship_105mm_shot_01.wav
  - sfx_wpn_gunship_105mm_interior_shot_01.wav
  - sfx_exp_105mm_he_impact_01.wav
- Firing Prompt (ElevenLabs):
- Detonation Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_mg_762mm_shot_attack.wav
  - sfx_wpn_mg_762mm_shot_loop.wav
  - sfx_wpn_mg_762mm_shot_tail.wav
  - sfx_impact_bullet_762mm_dirt_01.wav
  - sfx_impact_bullet_762mm_metal_01.wav
- Firing Loop & Transient Prompt (ElevenLabs):
- Firing Tail / Release Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_naval_20mm_shot_01.wav
  - sfx_wpn_naval_20mm_burst_loop.wav
  - sfx_wpn_naval_20mm_shot_tail.wav
- Firing Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_gunship_25mm_gatling_attack.wav
  - sfx_wpn_gunship_25mm_gatling_loop.wav
  - sfx_wpn_gunship_25mm_gatling_tail.wav
- Firing Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_jet_30mm_gatling_burst_01.wav
  - sfx_wpn_jet_30mm_gatling_tail_01.wav
  - sfx_exp_30mm_he_cluster_impact_01.wav
- Firing Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_heli_30mm_chain_burst_01.wav
  - sfx_wpn_heli_30mm_single_shot_01.wav
  - sfx_wpn_heli_30mm_shot_tail_01.wav
- Firing Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_aa_35mm_twin_burst_01.wav
  - sfx_wpn_aa_35mm_single_shot_01.wav
  - sfx_exp_35mm_airburst_flak_01.wav
- Firing Prompt (ElevenLabs):
- Flak Airburst Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_jet_40mm_he_shot_01.wav
  - sfx_wpn_jet_40mm_he_burst_01.wav
  - sfx_exp_40mm_he_impact_01.wav
- Firing Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_gunship_40mm_shot_01.wav
  - sfx_wpn_gunship_40mm_burst_01.wav
  - sfx_exp_40mm_impact_dirt_01.wav
- Firing Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_railgun_120mm_charge_01.wav
  - sfx_wpn_railgun_120mm_shot_01.wav
  - sfx_impact_railgun_120mm_hypervelocity_01.wav
- Charge & Firing Prompt (ElevenLabs):
- Kinetic Impact Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_mac_300mm_charge_01.wav
  - sfx_wpn_mac_300mm_shot_01.wav
  - sfx_exp_mac_300mm_kinetic_groundzero_01.wav
- Firing Prompt (ElevenLabs):
- Kinetic Impact Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_laser_rifle_shot_01.wav
  - sfx_wpn_laser_rifle_shot_02.wav
  - sfx_impact_laser_rifle_burn_metal_01.wav
- Firing Prompt (ElevenLabs):
- Impact Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_alien_laser_charge_01.wav
  - sfx_wpn_alien_laser_beam_loop.wav
  - sfx_wpn_alien_laser_burst_01.wav
  - sfx_impact_alien_laser_burn_01.wav
- Charge & Firing Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_rocket_70mm_launch_01.wav
  - sfx_wpn_rocket_70mm_flyby_loop.wav
  - sfx_exp_rocket_70mm_he_impact_01.wav
- Launch Prompt (ElevenLabs):
- Detonation Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_missile_300mm_launch_01.wav
  - sfx_wpn_missile_300mm_exhaust_tail_01.wav
  - sfx_exp_missile_300mm_detonation_01.wav
- Launch Prompt (ElevenLabs):
- Detonation Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_sub_missile_water_eject_01.wav
  - sfx_wpn_sub_missile_rocket_ignition_01.wav
  - sfx_exp_strategic_500mm_warhead_01.wav
- Launch Prompt (ElevenLabs):
- Detonation Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_bomb_250kg_fall_whistle_01.wav
  - sfx_exp_bomb_250kg_single_impact_01.wav
  - sfx_exp_bomb_carpet_cluster_burst_01.wav
- Fall & Single Detonation Prompt (ElevenLabs):
- Carpet Sequence Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_bomb_1000kg_heavy_screamer_01.wav
  - sfx_exp_bomb_1000kg_cratermaker_01.wav
- Detonation Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_exp_incendiary_rupture_burst_01.wav
  - sfx_exp_gas_release_pressurized_hiss_01.wav
  - sfx_env_fire_sticky_gel_burn_loop.wav
- Incendiary Rupture Prompt (ElevenLabs):
- Toxic Gas Rupture Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_orbital_cannon_incoming_screamer_01.wav
  - sfx_exp_orbital_cannon_groundzero_01.wav
- Strike Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_orbital_bomb_reentry_tear_01.wav
  - sfx_exp_orbital_heavy_bomb_blast_01.wav
- Strike Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_orbital_beam_focus_charge_01.wav
  - sfx_wpn_orbital_beam_sustained_loop.wav
  - sfx_wpn_orbital_beam_ground_sizzle_loop.wav
  - sfx_wpn_orbital_beam_cutoff_01.wav
- Beam Loop Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_orbital_cluster_line_drop_01.wav
  - sfx_exp_orbital_cluster_cascading_blast_01.wav
- Strike Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_flame_robot_ignite_start.wav
  - sfx_wpn_flame_robot_fire_loop.wav
  - sfx_wpn_flame_robot_ignite_stop.wav
- Ignition & Loop Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_flame_heavy_ignite_start.wav
  - sfx_wpn_flame_heavy_fire_loop.wav
  - sfx_wpn_flame_heavy_ignite_stop.wav
- Loop Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_alien_mortar_120mm_launch_01.wav
  - sfx_wpn_alien_mortar_incoming_whistle_01.wav
  - sfx_exp_acid_120mm_splash_burst_01.wav
  - sfx_env_acid_corrosion_metal_loop.wav
- Bio-Launch Prompt (ElevenLabs):
- Acid Impact Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_alien_spore_flak_launch_01.wav
  - sfx_exp_alien_spore_flak_airburst_01.wav
- Airburst Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_wpn_alien_skimmer_bile_spit_01.wav
  - sfx_wpn_alien_vent_toxic_rupture_01.wav
  - sfx_impact_bile_splash_armor_01.wav
- Bile Spit & Impact Prompt (ElevenLabs):
- Repository Asset Names:
  - sfx_creature_melee_armor_bite_01.wav
  - sfx_creature_melee_chitin_claw_scrape_01.wav
  - sfx_creature_melee_heavy_body_slam_01.wav
- Armor Bite & Scrape Prompt (ElevenLabs):
- Heavy Impact Slam Prompt (ElevenLabs):
```

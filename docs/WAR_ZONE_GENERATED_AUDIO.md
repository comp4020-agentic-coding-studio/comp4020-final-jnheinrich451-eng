# War Zone generated audio

8–9 November 2026. Weapon integration followed by supplied deployment and vehicle sounds. Local implementation; no deployment in this stage.

## Author request and result

The author supplied 52 ElevenLabs WAV recordings and asked to match them to the game weapons and replace the shared sound palette. They clarified that most recordings are a single sound for one shot. The original [generation record](../soundeffect/GENERATION.md) retains their supplied wording. Calibers inferred for sound preparation remain artistic references, not new gameplay specifications.

The game selects distinct firing and impact recordings for tanks, sentries, rail weapons, naval mounts, aircraft, missiles, bombs, orbital strikes and enemy attacks. The author later supplied a replacement machine-gun take and 15 deployment/vehicle recordings: 67 active selections from 68 source files. Some effects share a recording where the supplied collection has no exact counterpart; the weapon mapping is below and the later world-sound mapping follows it.

## Source and browser assets

- Original WAV files are unchanged. [The preparation script](../scripts/prepare-sound-effects.mjs) writes stereo 48 kHz Ogg Opus copies and provenance manifests under [public/audio/effects/generated](../public/audio/effects/generated/README.md).
- The 67 primary Ogg files total 3,212,695 bytes; PCM fallbacks total 44,613,212 bytes and are requested only when Ogg loading/decoding fails. One-shots retain 10 ms before the onset and the complete source tail. Eleven explicit continuous-loop exports use an 80 ms linear wrap crossfade on browser copies, shortening the period to 3.40 seconds; their original WAVs remain unchanged.
- [The manifest](../public/audio/effects/generated/manifest.json) records source/output SHA-256 values, lengths, onset trims, format and encoder settings. Repeating the export with the same encoder produced identical output hashes.
- The old six Kenney samples remain as historical assets; the current catalogue selects generated files only. Their CC0 notices do not describe the new collection.
- Source WAVs are excluded from the Docker build context; prepared files under public are sufficient at runtime. Rebuilding requires FFmpeg with libopus, available in the local video dependency or through FFMPEG_PATH / --ffmpeg.
- Unique files load with four concurrent workers after audio unlock. Decoded stereo Float32 samples occupy approximately 85.09 MiB in the browser, excluding decoder overhead; this is not server memory.

## Event timing and mixing

- Audio follows accepted server shots, resolved impacts and committed release times. Rejected clicks, charging/warning phases and damage-over-time ticks do not fire shot sounds.
- The server adds presentation labels to projectiles and impacts where the old weapon field lost the source identity (for example all aircraft cannon impacts being HE). Saved in-flight projectiles retain that identity. Older saves without labels use family fallbacks; damage, ammunition and cooldown values are unchanged.
- AA travel tracers and later magnetic/MAC travel segments remain silent. Only the initial discharge plays. Each bomber release uses its falling cue; each actual battery/submarine tube launch uses its launch cue. Cluster parent shells have one incoming cue during the last second before their committed impact, not one cue per bomblet.
- Every weapon and impact source plays once at its original pitch, with loop=false. A single isolated shot retains its available tail with a short edge fade. Falling cues can be bounded by flight time. No burst is synthesized from an assumed number of bullets in a filename. Only the eleven explicitly selected deployment/machinery beds loop.
- Flame and laser/beam emitters reuse one finite active voice while snapshots confirm firing. A further finite clip can start after the previous one finishes if firing continues. Confirmation expires after 300 ms, followed by a 40 ms fade. An expired voice is removed from the sustain lookup before fading, so renewed fire cannot attach to a voice already stopping.
- Simultaneous colocated reports share a 90 ms gate; each snapshot starts at most six finite voices, plus up to six ongoing world emitters. At most 16 sources overlap across both groups, including fades. Rapid repeats have per-source limits (normally three; shared small impacts two); replacing a finite voice fades it for 12 ms before its replacement starts. Tails can therefore end early during busy combat.
- Distance attenuation and stereo pan use world coordinates rather than map zoom. [Measured loudness calibration](SOUND_LOUDNESS.md) replaces peak normalization; relative gains and a master compressor retain the intended mix. Sound effects and music retain their independent saved controls; mute, disconnect/reset, pause and hidden tabs stop active sound and do not replay missed events.

## Deliberate shared mappings

- Small 25/30/40 mm and helicopter impacts share the supplied 35 mm impact recording at lower gains. This is an audio substitution, not a new airburst mechanic.
- Skimmer and aquatic bile launches share the supplied spit sound; their impacts reuse the acid splash. Toxic vents reuse the gas hiss. Enemy laser strengths share the beam recording at different gains.
- HE tank impacts on breaker/bulwark/centipede targets use the armor-hit recording; other tank HE impacts use dirt. This selection is based on enemy kind, not a new material simulation.
- The supplied single carpet-bomb clip serves one bomb impact (also orbital bomblets); the single orbital-cluster drop clip serves one incoming parent shell. No extra multi-explosion sequence is synthesized.
- Separate charge/start/stop variations absent from the supplied folder have not been invented. The sound catalogue records relative levels and ranges; final timbre and balance still need the author to listen in play.

## Runtime mapping

All filenames below live in public/audio/effects/generated/. The executable source is [sound-catalog.js](../public/sound-catalog.js).

| Confirmed event / sound ID | Recording |
| --- | --- |
| `tank-shot` | `sfx_wpn_tank_120mm_shot_01.ogg` |
| `tank-impact` | `sfx_exp_he_120mm_impact_dirt_01.ogg` |
| `tank-armor-impact` | `sfx_exp_he_120mm_impact_armor_01.ogg` |
| `machine-gun` | `sfx_wpn_mg_762mm_shot_single_01.ogg` |
| `aa-shot` | `sfx_wpn_aa_35mm_single_shot_01.ogg` |
| `aa-impact` | `sfx_exp_35mm_airburst_flak_01.ogg` |
| `railway-shot` | `sfx_wpn_railway_280mm_shot_01.ogg` |
| `railway-impact` | `sfx_exp_heavy_280mm_impact_01.ogg` |
| `naval-main-shot` | `sfx_wpn_naval_406mm_single_shot_01.ogg` |
| `naval-main-impact` | `sfx_exp_naval_406mm_he_impact_01.ogg` |
| `naval-secondary-shot` | `sfx_wpn_naval_127mm_single_shot_01.ogg` |
| `naval-secondary-impact` | `sfx_exp_he_127mm_impact_01.ogg` |
| `naval-side-shot` | `sfx_wpn_naval_20mm_burst_loop.ogg` |
| `heli-cannon-shot` | `sfx_wpn_heli_30mm_single_shot_01.ogg` |
| `heli-cannon-impact` | `sfx_exp_35mm_airburst_flak_01.ogg` |
| `jet-30-shot` | `sfx_wpn_jet_30mm_gatling_burst_01.ogg` |
| `jet-30-impact` | `sfx_exp_35mm_airburst_flak_01.ogg` |
| `jet-40-shot` | `sfx_wpn_jet_40mm_he_shot_01.ogg` |
| `jet-40-impact` | `sfx_exp_35mm_airburst_flak_01.ogg` |
| `gunship-25-shot` | `sfx_wpn_gunship_25mm_gatling_loop.ogg` |
| `gunship-25-impact` | `sfx_exp_35mm_airburst_flak_01.ogg` |
| `gunship-40-shot` | `sfx_wpn_gunship_40mm_shot_01.ogg` |
| `gunship-40-impact` | `sfx_exp_35mm_airburst_flak_01.ogg` |
| `gunship-105-shot` | `sfx_wpn_gunship_105mm_shot_01.ogg` |
| `gunship-105-impact` | `sfx_exp_105mm_he_impact_01.ogg` |
| `small-impact` | `sfx_exp_35mm_airburst_flak_01.ogg` |
| `magnetic-shot` | `sfx_wpn_railgun_120mm_shot_01.ogg` |
| `magnetic-impact` | `sfx_impact_railgun_120mm_hypervelocity_01.ogg` |
| `mac-shot` | `sfx_wpn_mac_300mm_shot_01.ogg` |
| `mac-impact` | `sfx_exp_mac_300mm_kinetic_groundzero_01.ogg` |
| `laser-shot` | `sfx_wpn_laser_rifle_shot_01.ogg` |
| `laser-impact` | `sfx_impact_laser_rifle_burn_metal_01.ogg` |
| `flame` | `sfx_wpn_flame_robot_fire_loop.ogg` |
| `heavy-flame` | `sfx_wpn_flame_heavy_fire_loop.ogg` |
| `rocket-shot` | `sfx_wpn_rocket_70mm_launch_01.ogg` |
| `rocket-impact` | `sfx_exp_rocket_70mm_he_impact_01.ogg` |
| `missile-shot` | `sfx_wpn_missile_300mm_launch_01.ogg` |
| `missile-impact` | `sfx_exp_missile_300mm_detonation_01.ogg` |
| `submarine-shot` | `sfx_wpn_sub_missile_water_eject_01.ogg` |
| `submarine-impact` | `sfx_exp_strategic_500mm_warhead_01.ogg` |
| `bomb-fall` | `sfx_wpn_bomb_250kg_fall_whistle_01.ogg` |
| `bomb-impact` | `sfx_exp_bomb_carpet_cluster_burst_single_01.ogg` |
| `heavy-bomb-fall` | `sfx_wpn_bomb_1000kg_heavy_screamer_01.ogg` |
| `heavy-bomb-impact` | `sfx_exp_bomb_1000kg_cratermaker_01.ogg` |
| `incendiary-impact` | `sfx_exp_incendiary_rupture_burst_01.ogg` |
| `gas-impact` | `sfx_exp_gas_release_pressurized_hiss_01.ogg` |
| `orbital-impact` | `sfx_exp_orbital_cannon_groundzero_01.ogg` |
| `orbital-heavy-impact` | `sfx_exp_orbital_heavy_bomb_blast_01.ogg` |
| `orbital-cluster-impact` | `sfx_exp_bomb_carpet_cluster_burst_single_01.ogg` |
| `orbital-cluster-fall` | `sfx_wpn_orbital_cluster_line_drop_single_01.ogg` |
| `orbital-beam` | `sfx_wpn_orbital_beam_ground_sizzle_loop.ogg` |
| `alien-laser` | `sfx_wpn_alien_laser_beam_loop.ogg` |
| `alien-heavy-laser` | `sfx_wpn_alien_laser_beam_loop.ogg` |
| `acid-shot` | `sfx_wpn_alien_mortar_120mm_launch_01.ogg` |
| `acid-impact` | `sfx_exp_acid_120mm_splash_burst_01.ogg` |
| `spore-shot` | `sfx_wpn_alien_spore_flak_launch_01.ogg` |
| `spore-impact` | `sfx_exp_alien_spore_flak_airburst_01.ogg` |
| `bile-shot` | `sfx_wpn_alien_skimmer_bile_spit_01.ogg` |
| `bile-impact` | `sfx_exp_acid_120mm_splash_burst_01.ogg` |
| `toxic-vent` | `sfx_exp_gas_release_pressurized_hiss_01.ogg` |
| `creature-bite` | `sfx_creature_melee_armor_bite_01.ogg` |
| `creature-slam` | `sfx_creature_melee_heavy_body_slam_01.ogg` |

## Verification

- All 52 source hashes are unchanged; catalogue entries cover all 52 exported files with no missing names.
- The final focused run passes 132 tests across 13 event, combat, weapon, checkpoint and supplied-invariant files. TypeScript and process-evidence checks also pass.
- Native Chrome checks at 1920 x 1080 and 390 x 844 pass (2/2). They decode all 52 selected files and verify HTTP audio/ogg plus content length, actual server-confirmed naval firing/impact, representative individual weapon mappings, original playback pitch, no automatic looping and retained one-shot tails.
- Browser checks also cover silent baseline/reconnect/rejected fire, no AA/magnetic trace retriggers, finite flame renewal/expiry including a renewal during the expiry fade, mute, inactive/hidden state, distance culling and the six-start/16-overlap limits. The latter uses actual scheduled source intervals including voice replacement fades. Screenshots of the existing audio controls were inspected.
- The initial checks established decoding, event mapping and source scheduling but missed a disconnected output path. See the correction below. These checks are not a human listening evaluation, physical-phone test, deployed-site check or sustained multiplayer audio benchmark.

## Silent-output correction

The author reported that no effects were audible even with effects enabled. The
new mixer connected its master gain to a compressor but omitted the compressor's
connection to AudioContext.destination. Buffers still decoded and sources still
started, so the original tests passed while the whole effects graph was silent.

The missing connection is restored. The browser regression now inserts an inline
analyser only where the production graph already connects to the destination and
checks for nonzero samples during a real, server-confirmed naval shot. The probe
does not create a missing destination connection. This checks the rendered signal
in the final browser output path; it cannot verify the user's OS mixer, selected
audio device or physical speakers.

The corrected desktop and phone checks both pass (2/2), measuring a peak signal
of approximately 0.227 in the final output path. A negative control removed the
connection through browser request interception only: three buffers started, but
the output remained zero and the new assertion failed as intended.

## Loading-error correction

The author subsequently reported continued silence in a named campaign at
localhost:8080, while Apex music worked. Their screenshot showed effects enabled,
nonzero volume and the generic "Some sounds unavailable" error. The existing
message did not reveal which initialization, fetch or decoding step had failed.
An isolated named-campaign probe produced a real laser shot and nonzero output;
the user's server also served the updated mixer and all 52 Ogg files. This did
not establish the precise failure inside the user's browser.

Each compressed recording now has a stereo 48 kHz PCM16 WAV fallback with the
same leading trim and retained tail. The loader tries that file when the Ogg
request or decoder fails, revalidates cached files and reports the failed file
and HTTP/decoder error if both formats fail. Context initialization errors also
have a specific message. The server recognizes audio/wav; byte decoding works
with the existing server's application/octet-stream header as well.

Desktop and phone checks pass (2/2) with every Ogg deliberately made undecodable:
all 52 WAV fallbacks decode and the final output path carries a nonzero signal.
A second scenario returns HTTP 503 for both formats; loading ends with a precise
error, then toggling effects retries successfully after the failure is removed.
Shots missed during loading are not replayed. TypeScript and 31 focused event,
combat-audio and supplied-invariant tests pass. On 9 November 2026 the author
confirmed that effects now work in play. This confirms playback after the fix;
it is not a review of every weapon's timbre or mix balance.

## Single-shot machine-gun correction, 9 November 2026

The author reported that the machine-gun burst did not match each firing event
and supplied `sfx_wpn_mg_762mm_shot_single_01.wav`. The catalogue now selects its
Ogg/PCM copies for `machine-gun`; the earlier take remains on disk but is not
selected. The exporter follows the catalogue, leaving 52 active recordings from
53 source takes. Source hashes and the full 3.48-second tail are preserved.

Thirty-one focused event/combat/invariant checks and TypeScript pass. Desktop
and phone browser checks pass (2/2): an ordinary APCR event starts exactly one
new single-shot recording, at rate 1 with looping disabled, and its measured
final output peak is 0.107524842. All 52 primary files and PCM fallbacks decode.
The existing loader, mute, visibility, voice-limit and output checks also pass.

## Supplied deployment and vehicle audio, 9 November 2026

The author supplied all 15 proposed WAVs and revised the prompt table in
[GENERATION.md](../soundeffect/GENERATION.md#supplied-deployment-and-vehicle-effects-9-november-2026).
Those prompt rows remain verbatim. They confirmed that the last two recordings
follow the swapped prompts, so the catalogue maps by content and preserves the
filenames. The original 52 prepared weapon exports remain byte-identical.

| Runtime role | Source filename | Trigger |
| --- | --- | --- |
| `pod-descent` | `sfx_pod_descent_loop.wav` | Current descending core, tank, cargo, aircraft or recovery pod |
| `pod-impact` | `sfx_pod_ground_impact_01.wav` | Fresh contact with the ground |
| `pod-panel-open` | `sfx_pod_panel_open_01.wav` | First .55 seconds of each opening action |
| `pod-panel-slam` | `sfx_pod_panel_ground_slam_01.wav` | Each independently timed panel reaching ground |
| `vehicle-idle` | `sfx_vehicle_engine_idle_loop.wav` | Occupied ground vehicle, quieter under load |
| `vehicle-drive` | `sfx_vehicle_engine_drive_loop.wav` | Actual ground movement/pivoting |
| `vehicle-tracks` | `sfx_vehicle_tracks_loop.wav` | Tracked vehicle moving/pivoting |
| `ship-engine` | `sfx_ship_engine_loop.wav` | Occupied or moving ship; quieter underwater |
| `ship-wake` | `sfx_ship_wake_loop.wav` | Moving ship on the water surface |
| `ship-sand` | `sfx_ship_sand_slide_loop.wav` | Moving ship on Sirocco |
| `helicopter-rotor` | `sfx_helicopter_rotor_loop.wav` | Helicopter taking off, flying or landing |
| `jet-engine` | `sfx_jet_engine_loop.wav` | Attack jet taking off, flying or landing |
| `heavy-aircraft-engine` | `sfx_heavy_aircraft_engine_loop.wav` | Other powered aircraft taking off, flying or landing |
| `mechanical-servo` | `sfx_aircraft_touchdown_01.wav` | Observed powered turret or artillery elevation/traverse movement |
| `aircraft-touchdown` | `sfx_mechanical_servo_loop.wav` | Observed landing-to-parked transition |

The opening recording contains its own later impact; the short playback window
ends before that peak so the isolated slam can follow the animation's contact.
Core and tank panels open at the shared POD timings and slam independently;
simultaneous cargo-crate doors share a single opening/contact cue. Rail crates,
factory aircraft assembly and completed deployments do not invent door impacts.

`WorldSoundEvents` reads accepted world/vehicle snapshots without changing
simulation or save data. One-shot thresholds are silent on join/reconnect,
discard events older than 350 ms and never replay muted history. Continuous
emitters describe current operation, so joining near a running engine is audible
after activation. Empty stationary ground vehicles, parked aircraft and destroyed
machinery are silent; occupied ground vehicles can idle. Utilities do not acquire
tank-track noise and pilots do not duplicate vehicle engines.

The nearest/loudest six loop layers share the existing sixteen-source budget
with weapons. Their gains, stereo positions and modest rates update on fresh
snapshots without restarting a source. Absence fades a layer in 60 ms; no new
simulation time for 500 ms also expires it. Pausing, muting, hiding the tab,
disconnect/reset and runtime changes stop it. New sources wait for existing fades
to finish before using their voice slots. These are War Zone sounds; the later
colony machinery/environment list remains a proposal.

Local verification: 42 focused event/combat/invariant tests, TypeScript and the
process evidence check pass. Existing weapon browser checks pass on desktop and
phone (2/2), decoding all 67 primary and 67 fallback files. World-audio browser
checks also pass (2/2): a real accepted core deployment produces one landing and
four panel slams, reconnect does not replay them, and measured engine output
continues beyond a full loop period. Spatial updates retain the same sources;
parking, destruction, pause/inactivity, mute, hidden tabs, reset, frozen clocks
and missing snapshots stop them. Measured total overlap peaks at sixteen.

The browser checks caught an early test comparison against a still-fading engine;
that harness now compares settled levels and samples output afresh after a loop.
A separate state review found that transported tanks retain zero velocity fields:
audio now uses the matching pilot's current velocity, falling back to observed
position changes. The eleven world-event cases and both world browser checks
include that correction. Desktop/phone screenshots were inspected. No user save
was accessed by these fixtures. Mix balance and perceived loop quality still
await the author's listening review.

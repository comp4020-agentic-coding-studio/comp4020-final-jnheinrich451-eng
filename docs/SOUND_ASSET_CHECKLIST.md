# Sound effects to collect

## Direction

Author feedback: the current laser sound is good; the other weapon sounds feel
too playful. Keep the laser and look for heavier, more believable mechanical
weapon sounds. Cinematic recordings are fine if they fit the game; exact real-world
weapon models are not required. Apex remains the background music.

Start with batch 1. The later batches are optional future work, not required to
replace the current weapon palette. One good sample per role is enough initially;
two or three variations are welcome.

## Batch 1 — replace the current weapon sounds

The suggested names are for incoming files, not automatic runtime replacements.
Search phrases are descriptions to help find material, not verified asset listings.

| Collected | Suggested filename | Used for | Sound to look for / search phrase |
| --- | --- | --- | --- |
| [ ] | `tank_cannon` | Tank HE cannon | Single tank cannon shot: sharp initial crack, deep punch, outdoor decay. Search: tank cannon firing exterior single shot. |
| [ ] | `heavy_artillery` | Rail artillery and naval main guns | Large artillery report with weight and a longer rumble. Search: heavy artillery cannon distant tail. One shared sample is fine initially. |
| [ ] | `machine_gun` | Tank machine gun, sentries and naval secondary guns | Dry mechanical gunfire. A clean single shot or short burst, without voices. Search: heavy machine gun isolated burst. |
| [ ] | `aircraft_autocannon` | Attack jet, helicopter and aerial-gunship rapid guns | Dense, fast cannon burst with a mechanical growl. Search: aircraft autocannon burst / rotary cannon burst. |
| [ ] | `missile_launch` | Missile battery and submarine launch | Ignition thump followed by a rushing rocket motor. Search: missile launch rocket ignition whoosh. |
| [ ] | `explosion_medium` | Tank shells, rockets and ordinary bomb impacts | Ground-impact crack and low body, with debris settling. Search: outdoor explosion debris single. |
| [ ] | `explosion_heavy` | Large bombs and heavy artillery impacts | Deep blast, strong initial impact and a natural rumbling tail. Search: large explosion low rumble outdoor. |
| KEEP | Existing laser | Robot laser; current magnetic shot also shares this file | `public/audio/effects/rail.ogg`. Laser approved; no replacement needed for this batch. |

For one-shot effects, roughly 0.2–3 seconds is a useful starting point; a heavy
explosion can have a longer tail. Keep the original recording if it is longer.
We can trim silence and shape the tail during integration.

## Batch 2 — vehicle movement

Collect steady loops first. Idle and moving/load variants are useful; startup,
shutdown and acceleration transitions can come later.

| Collected | Suggested filename | Used for | Sound to look for |
| --- | --- | --- | --- |
| [ ] | `tank_engine_idle` / `tank_engine_load` | Tank | Heavy diesel idle and steady engine under load. |
| [ ] | `tank_tracks_loop` | Tank tracks | Track clatter and metal tread movement, preferably separate from the engine. |
| [ ] | `utility_engine_loop` | Recycler and bridge builder | Smaller industrial engine; one shared family is enough. |
| [ ] | `rail_movement_loop` | Moving rail cannon | Slow steel wheels, rail clatter and mechanical grinding. |
| [ ] | `jet_engine_loop` | Bomber and attack jet | Steady jet thrust; avoid a recording that is only a rapid flyby. |
| [ ] | `propeller_engine_loop` | Aerial gunship | Heavy propeller aircraft engine drone. |
| [ ] | `helicopter_rotor_loop` | Helicopter | Steady rotor chop and turbine body. |
| [ ] | `ship_engine_loop` | Surface ships | Low marine-engine rumble. |
| [ ] | `ship_wake_loop` | Moving ships | Water rushing, bow wash and propeller turbulence. |
| [ ] | `submarine_hum_loop` | Submerged submarine | Quiet machinery/electric hum, kept restrained. |

Around 3–10 seconds of clean steady material is useful for loop candidates.
An already seamless loop is ideal; otherwise we can find a loop region and crossfade.

## Batch 3 — additional weapons, construction and creatures

| Collected | Suggested filename | Used for | Sound to look for |
| --- | --- | --- | --- |
| [ ] | `flamethrower_loop` | Robot/tank fuel jets | Sustained pressurized flame roar. |
| [ ] | `magnetic_charge` | Tank magnetic cannon | Short electrical charge rising into discharge; optional, since the current shot already has audio. |
| [ ] | `small_impact` | Bullets and light cannon hits | Short dirt/stone impact; metal variant optional. |
| [ ] | `pod_impact` | Orbital drop-pod landing | Heavy metal object hitting the ground. |
| [ ] | `panel_unfold` / `panel_slam` | Drop-pod walls and ramp machinery | Hydraulic/mechanical movement, then a heavy plate hitting the ground. |
| [ ] | `construction_drone_loop` | Local construction | Quiet small motors and occasional tool chatter. |
| [ ] | `bridge_section_lock` | Bridge construction | Steel section sliding and locking into place. |
| [ ] | `creature_attack` / `creature_death` | Land enemies | Short alien screech/growl and a separate death sound. |
| [ ] | `heavy_creature_attack` | Bulwarks and larger enemies | Lower, heavier creature sound. |
| [ ] | `aquatic_attack` | Swimming enemies | Wet creature attack or splash. |
| [ ] | `hive_ambience_loop` | Living enemy facilities | Unsettling organic pulse, wet movement or restrained whining. |

Creature sounds can be designed/fantasy effects. They do not need to be realistic
animal recordings. Separate short calls from continuous ambience.

## Where to put files

Use this source folder when you have downloads:

```text
audio/sfx-candidates/
  weapons/
  vehicles/
  creatures/
  construction/
  SOURCES.md
```

WAV, FLAC, Ogg or MP3 originals are welcome; prefer WAV/FLAC when available.
Keep the best-quality original and its supplied licence/readme. No need to convert
or normalize files yourself. Mono is convenient for individual weapon sounds;
stereo is also usable. Avoid music, spoken commentary, watermarks and unrelated
background sounds mixed into the recording.

For each download, add a small entry to `SOURCES.md`:

```text
File: weapons/tank_cannon.wav
Asset title:
Creator:
Source/download page:
Licence name and included licence file:
Required attribution, if supplied:
Preferred part of recording / notes:
```

The new folder is a collection location; adding files there does not change the
game automatically. We will select samples, preserve provenance, copy the chosen
runtime assets into `public/audio/effects/`, and tune their playback together.

## Integration note

The current six-file palette shares several sounds across weapons. The new list
deliberately separates roles so a naval gun need not sound like a tank or an
aircraft cannon. Integration may therefore add sound mappings.

Current playback also lowers cannon pitch and cuts some clips short. Simply
overwriting the existing files could make a good recording sound wrong. When
replacing them, retune pitch, volume, burst timing and tail length for each sample.

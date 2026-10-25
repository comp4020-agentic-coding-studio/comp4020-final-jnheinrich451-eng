# Weapon sound effects

23 October 2026. Implemented and checked locally; not deployed by this stage.

## Playable scope

Tank cannons, naval and rail artillery, machine guns, aircraft guns, magnetic and
laser shots, battery/submarine missile launches and explosive impacts now have
browser audio. Bomb releases remain silent; their impacts sound. Sustained flame,
engines, rotors, monster calls and hive ambience are later stages.

Help (?) contains separate effects on/off and volume controls, saved in this
browser. Default effects volume is 55%; Apex retains its independent settings.
A click, tap or key unlocks browser audio. Hidden tabs stop effects, and unavailable
files show a retry message without blocking the game. Toggle effects off/on to retry.

Six small Kenney samples are copied with their bundled CC0 notices into
`public/audio/effects/`; its README maps each runtime name to the original source.
They total 273,972 bytes (about 268 KiB). Sources are unchanged; playback applies peak
normalization, pitch changes and short gain envelopes. This is a provisional
stylized palette, not a claim of realistic recordings or a completed listening mix.
Author playtest feedback: the laser sound is good; the other effects feel too
playful. Keep the laser while sourcing heavier replacement recordings using the
[sound asset checklist](SOUND_ASSET_CHECKLIST.md). The current playback mix remains
in place until replacements are selected.

## Event and runtime rules

- Audio follows authoritative shots, impacts and missile launch timing. Rejected
  input has no firing sound. No gameplay, saves or server event formats change.
- The first snapshot of a connection/runtime is a silent baseline. Seen event IDs
  suppress repeats; events older than 350 ms are discarded. Disconnect and tab
  visibility changes reset the baseline. Muted/paused/hidden events are consumed,
  never queued for later playback.
- The camera is the listener, measured in world tiles. Gun sounds fade by 18 tiles,
  ordinary cannon/impact sounds by 32, and heavy fire by 48. Overview zoom does not
  increase these ranges. Horizontal direction controls stereo position.
- Nearby rounds of the same sound in a four-tile cell share a 90 ms gate. Each
  snapshot starts at most six voices, favoring closer events. At most sixteen
  voices play simultaneously; higher-priority sounds can replace quieter ones.
  Group history is capped at 128 entries. A compressor limits stacked peaks.
- Web Audio buffers are decoded once per page. Audio does not add per-bullet
  network messages or server synthesis. This does not establish Fly capacity.

## Validation

- Four domain cases cover join/reconnect/runtime baselines, duplicate and stale
  events, shot/impact separation, weapon mapping, staged/moving missile launch
  origins, excluding bomb releases, attenuation and stereo direction.
- Both supplied invariant tests and TypeScript checking pass.
- Desktop 1920 x 1080 and phone 390 x 844 Chrome checks decoded all six Ogg assets,
  verified MIME/length, confirmed rejected server fire stayed silent and a real
  accepted naval salvo/impact started native audio sources, and checked persistent
  independent effects controls. Screenshots were inspected.
- A native browser mixer probe grouped 100 co-located shots into one sound;
  dispersed batches started at most six. Repeated snapshots, reset/reconnect
  baselines, far-away shots, mute and hidden-tab history produced no replay.
- These are functional playback and layout checks, not human listening results,
  physical-phone certification or a sustained performance benchmark.

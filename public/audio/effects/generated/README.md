# Author-generated game sounds

Runtime copies of 67 selected author-supplied WAV files in `soundeffect/`, first
prepared 8 November 2026. The single-shot machine-gun take replaced the earlier
burst on 9 November; the older take remains on disk but is not selected. The
author then supplied 15 deployment, engine and movement recordings on 9 November.
There are 68 original WAVs and 67 current selections, including 11 explicit loops.
The
[generation record](../../../../soundeffect/GENERATION.md)
preserves the supplied prompts and filenames, including the author's revisions. These generated sounds are
separate from the older Kenney samples in the parent directory; the parent CC0
notices describe those older files, not this collection.

`manifest.json` records every original filename and SHA-256, runtime filename and
SHA-256, source and output byte sizes, PCM duration, leading trim, and source peak.
Each entry also records `fallbackFile`, `fallbackSha256` and `fallbackBytes` for
its uncompressed PCM WAVE copy. The manifest's `fallbackEncoding` identifies
stereo, 48 kHz, 16-bit PCM; `schemaVersion` is 3. Explicit continuous-loop entries
also have `loopPreparation` recording the crossfade method, overlap duration/frame
count and rotation of the source start.
`manifest.js` exports the same file entries as `SOUND_ASSETS` for browser imports.
The source WAVs remain unchanged; the script prepares the current catalogue
selections. Primary exports are stereo, 48 kHz Ogg Opus at
128 kb/s VBR. Each has a PCM WAVE fallback for browsers unable to decode Opus.
Both formats use the same prepared samples; WAVE fallbacks are requested only
when the primary format fails. One-shot exports trim only leading near-silence:
the first sample above -60 dB relative to source peak is retained with 10 ms of
pre-roll, and the full tail remains. Existing weapon exports are unchanged.

Only the 11 recordings explicitly selected as continuous loops receive an
80 ms linear wrap crossfade. The export starts 80 ms into the original, keeps
the middle unchanged and blends the final 80 ms into the original first 80 ms.
The last sample then continues into its original neighbor at the next loop
boundary. This preserves source content in an overlap, shortening each 3.48 s
source to a 3.40 s loop period. Linear weights do not exceed the original peak;
no pitch changes or normalization are baked in. This smooths the waveform join,
but does not establish a listening-reviewed musical or mechanical seamless loop.

The author confirmed two filenames follow swapped prompt rows:
`sfx_aircraft_touchdown_01.wav` contains the mechanical-servo loop, while
`sfx_mechanical_servo_loop.wav` contains the touchdown one-shot. Catalogue roles
and loop preparation follow that confirmation; the original names are retained.

Rebuild from the repository root with:

```text
node scripts/prepare-sound-effects.mjs
```

FFmpeg must provide `libopus`. The script accepts `--ffmpeg <executable>` or
`FFMPEG_PATH`, then checks PATH and the existing local Remotion video dependency.
Rebuilding is not required for deployment: the generated files are already under
`public/`. The encoder version and settings are recorded in the manifest.

The author clarified that most clips represent one shot. A `_loop` or `_burst`
filename does not establish a seamless loop or permission to replay a complete
multi-shot burst for each projectile. Playback timing belongs to the game audio
mapping. File checks and browser decoding do not replace a human listening pass.

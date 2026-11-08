# Generated Colonization sound effects

Author-supplied ElevenLabs recordings, prepared for browser playback. These are
separate from the historical CC0 palette and from the War Zone exports.

The [generation record](../../../../soundeffect/GENERATION.md) preserves prompts
and filenames. The [integration record](../../../../docs/COLONY_SOUND_EFFECTS.md)
describes playback. `manifest.json` contains all source and export hashes,
durations, loop preparation and encoder details.

Rebuild with `node scripts/prepare-sound-effects.mjs --colony`. Keep the original
WAVs under `soundeffect/` unchanged. Each Ogg has a PCM WAV fallback. The colony
loads these 52 files only; its 24 cue types use two alternating footsteps, nine
four-variation groups, six single one-shots and eight single-file loops.

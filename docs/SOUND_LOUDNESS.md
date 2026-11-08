# Sound-effect loudness calibration

Evidence scope: this record captures local working-tree measurements. The
documentation commit carrying it does not include the calibration runtime or
reproduction script; those belong to the separate audio change. These results
do not establish deployed behavior.

9 November 2026. The author noticed uneven levels in the generated recordings
and asked for waveform measurements and a consistent scale. Both active palettes
are calibrated: 67 War Zone recordings and 52 Colonization recordings, with their
119 Ogg files and 119 PCM fallbacks measured separately.

The former `.8 / decodedPeak` adjustment matched the highest sample, leaving
large loudness differences between takes. The replacement applies one fixed
measured gain per file, then retains the existing role volume, distance, pan and
master control. It does not compress a recording, change its pitch, trim it again
or modify any audio bytes. Alternation, random selection and loop timing remain
the same.

## Measured result

An independent pass decoded each file, applied the actual calibration multiplied
by its maximum catalogue gain, and measured that signal again. For a fair before
comparison, it also rendered the old peak-normalized signal at the same role
gain. These measurements precede panning, master volume and simultaneous mixing.
The spread includes every take and both codecs in each family.

| Variation family | Previous spread (LU) | Calibrated spread (LU) |
| --- | ---: | ---: |
| Fishing bite | 14.47 | 0.45 |
| Spider purr | 6.99 | 0.02 |
| Drone unloading | 6.63 | 0.04 |
| Spider eating | 6.09 | 0.03 |
| Fishing cast | 5.08 | 0.05 |
| Spider happy | 4.69 | 0.28 |
| Spider curious | 4.12 | 0.06 |
| Drone pickup | 3.83 | 0.02 |
| Item collection | 2.36 | 0.43 |
| Spider footsteps | 0.29 | 0.10 |

All 238 measured final signals were finite and their individual post-role true
peaks stayed at or below -2.06 dBTP. Every variation family stayed within 0.45 LU.
This does not mean all game events should sound equally loud: the role gains
still keep machinery and footsteps quieter than major arrivals or explosions.
Timbre and listening context also affect perceived balance.

## Method and limits

FFmpeg's `loudnorm` input statistics supply gated integrated loudness and true
peak. Only measurements are retained; its processed output is discarded.
Peak and full-file RMS statistics are also recorded. The bundled encoder lacks
float PCM output, so those two statistics use a quarter-level PCM24 decode with
that known attenuation removed mathematically; this does not rewrite an asset.
See the [FFmpeg filter documentation](https://ffmpeg.org/ffmpeg-filters.html#loudnorm)
and [EBU metering specification](https://tech.ebu.ch/docs/tech/tech3341.pdf).

The chosen game reference is -20 LUFS before role volume. The maximum increase
is 36 dB, accommodating quiet files that the old peak normalizer already boosted
substantially. The peak allowance is -2 dBTP after the strongest catalogue role
that uses a file. All takes in a variation family share the lowest achievable
target across both codecs, rounded downward to 0.1 LU. The sharpest fishing-bite
take makes that family use -22 LUFS; the other families use -20 LUFS. This keeps
the attack intact while matching its alternatives.

The calibration and role factors multiply together in a single Web Audio
`GainNode`; calibration alone may exceed one. The browser's decoded-sample peak
guard can only lower that gain if decoding/resampling needs more headroom.
[Web Audio gain processing](https://www.w3.org/TR/webaudio-1.0/#GainNode) applies
the computed gain to each input sample. The -2 dBTP policy describes an individual
voice before panning and summation; it is not a guarantee about the final mix's
true peak. The existing master compressor and voice limits still apply.

The arithmetic report predicts exact family matching, but remeasurement is the
result used above. Gating makes measured loudness somewhat level-dependent:
quiet tails can cross the absolute measurement threshold. An initial diagnostic
comparison found 37 signals more than 0.3 LU from their arithmetic prediction,
with a maximum difference of 1.79 LU. Those residuals remain in the verification
record; they are not reported as exact measured matches. No further compression
or repeated gain adjustment was introduced to chase that arithmetic estimate.

## Reproduction and evidence

- [Per-file CSV](audio-loudness.csv): waveform statistics, gain correction and
  explicitly labelled predicted reference/voice levels.
- [Calibration JSON](audio-loudness.json): settings, source/runtime hashes,
  per-codec measurements and variation groups.
- [Independent verification JSON](audio-loudness-verification.json): remeasured
  post-role levels, fair before/after comparisons and prediction residuals.
- `node scripts/measure-sound-effects.mjs --check` verifies active coverage,
  source/export hashes, role gains, family targets and generated modules.
- `node scripts/measure-sound-effects.mjs` recalibrates both palettes, reusing
  unchanged measurements. `--fresh` forces measurement; `--mode combat` or
  `--mode colony` limits it to one palette. Preparation now invokes calibration
  automatically for its palette. Recalibrate after changing recordings or role
  gains. Source WAVs and generation prompts stay in the existing
  [generation record](../soundeffect/GENERATION.md).

Validation: 46 focused tests and TypeScript passed. Four native browser checks
passed for both palettes on desktop/phone, covering real speaker-path output,
codec fallback, variation selection, loops and lifecycle cleanup. A fifth test
used both production mixers at 100% volume: four overlapping colony bites
produced left/right sampled output peaks of 0.75343/0.81271; six heavy combat
effects produced 0.53949/0.66352. All samples were finite and below full scale.
The sharp bite's actual gain matched calibration within 1%, confirming that the
old peak normalization was replaced. These are sampled browser output checks,
not a physical-speaker or final-mix true-peak certification. All five browser
checks passed on their first runs in this calibration stage.

Logs: `.local/loudness-tests.log`, `.local/loudness-browser.log` and
`.local/loudness-headroom-browser.log`. The source/runtime preservation check
covers 360 existing audio files.

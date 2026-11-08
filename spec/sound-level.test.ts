import { expect, it } from 'vitest';
import { soundSampleScale } from '../public/sound-level.js';
import { achievableFamilyTarget, calibrateLoudness } from '../scripts/lib/sound-loudness.mjs';

const voice = { scale: 3, maxProfileGain: .2, peakCeilingDbtp: -2 };

it('brings a quiet recording and a loud recording to the same reference without crushing either', () => {
  const quiet = { integratedLufs: -47, truePeakDbtp: -33, maxProfileGain: .11 };
  const loud = { integratedLufs: -14, truePeakDbtp: -1, maxProfileGain: .11 };
  const a = calibrateLoudness(quiet), b = calibrateLoudness(loud);
  expect(a.predictedLufs).toBe(-20); expect(b.predictedLufs).toBe(-20);
  expect(a.gainDb).toBe(27); expect(b.gainDb).toBe(-6);
  expect(a.predictedVoiceTruePeakDbtp).toBeLessThan(-2);
  expect(b.predictedVoiceTruePeakDbtp).toBeLessThan(-2);
});

it('matches an entire variation family to the sharpest take instead of clipping that take', () => {
  const takes = [
    { integratedLufs: -43.4, truePeakDbtp: -9.48, maxProfileGain: .2 },
    { integratedLufs: -20, truePeakDbtp: -3, maxProfileGain: .2 },
  ];
  const effectiveTargetLufs = achievableFamilyTarget(takes);
  expect(effectiveTargetLufs).toBe(-22);
  for (const take of takes) {
    const level = calibrateLoudness({...take, effectiveTargetLufs});
    expect(level.predictedLufs).toBeCloseTo(-22, 8);
    expect(level.predictedVoiceTruePeakDbtp).toBeLessThanOrEqual(-2);
  }
  // A codec with a higher reconstructed true peak constrains the whole family.
  expect(achievableFamilyTarget([...takes, {...takes[0], truePeakDbtp: -9.2}])).toBe(-22.3);
});

it('bounds pathological amplification and rejects unmeasurable loudness', () => {
  const limited = calibrateLoudness({integratedLufs: -65, truePeakDbtp: -55, maxProfileGain: .1});
  expect(limited.gainDb).toBe(36); expect(limited.limitedBy).toContain('boost-limit');
  expect(() => calibrateLoudness({integratedLufs: -Infinity, truePeakDbtp: -50, maxProfileGain: .1})).toThrow();
});

it('keeps measured loudness gain instead of normalizing every decoded peak again', () => {
  // Both buffers are within the role's peak allowance. A different crest factor
  // must not undo the measured loudness match between variants.
  expect(soundSampleScale(voice, 1)).toBe(3);
  expect(soundSampleScale(voice, .5)).toBe(3);
});

it('reduces a codec or resampling overshoot at the strongest role output', () => {
  const decodedPeak = 2;
  const scale = soundSampleScale(voice, decodedPeak);
  expect(scale).toBeLessThan(voice.scale);
  expect(decodedPeak * scale * voice.maxProfileGain).toBeCloseTo(10 ** (-2 / 20), 12);
});

it('rejects silence and missing calibration instead of amplifying invalid measurements', () => {
  for (const peak of [0, -1, NaN, Infinity]) expect(() => soundSampleScale(voice, peak)).toThrow();
  for (const level of [null, {}, {...voice, scale: Infinity}, {...voice, maxProfileGain: 0}]) {
    expect(() => soundSampleScale(level, .5)).toThrow();
  }
});

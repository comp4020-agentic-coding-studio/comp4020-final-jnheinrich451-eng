// Offline gated-loudness calibration replaces peak normalization. Role gain,
// distance and the player's volume are applied by the mixer afterward.
// The single voice GainNode multiplies calibration and role gain together;
// the calibration reference itself need not have a peak below full scale.
export function soundSampleScale(level, decodedPeak) {
  if (!level || !Number.isFinite(level.scale) || level.scale <= 0 ||
      !Number.isFinite(level.maxProfileGain) || level.maxProfileGain <= 0 ||
      !Number.isFinite(level.peakCeilingDbtp) || level.peakCeilingDbtp > 0) {
    throw new Error('Missing or invalid loudness calibration; prepare the sound effects again');
  }
  if (!Number.isFinite(decodedPeak) || decodedPeak <= 0) throw new Error('Silent or invalid recording');
  // Browser resampling/codec differences may raise a sample peak beyond the
  // offline measurement. Only reduce gain in that case; never normalize it up.
  const peakCeiling = 10 ** (level.peakCeilingDbtp / 20);
  return Math.min(level.scale, peakCeiling / (decodedPeak * level.maxProfileGain));
}

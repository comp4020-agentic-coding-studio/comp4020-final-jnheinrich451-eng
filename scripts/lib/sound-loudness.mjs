// Static calibration only: preserve the recording's internal dynamics.
export const LOUDNESS_POLICY = Object.freeze({ targetLufs: -20, maxBoostDb: 36, ceilingDbtp: -2 });

function headroom(measurement, policy) {
  if (!Number.isFinite(measurement.maxProfileGain) || measurement.maxProfileGain <= 0) {
    throw new Error('Loudness calibration requires a positive maximum catalogue gain.');
  }
  return policy.ceilingDbtp - measurement.truePeakDbtp - 20 * Math.log10(measurement.maxProfileGain);
}

export function achievableFamilyTarget(measurements, policy = LOUDNESS_POLICY) {
  if (!measurements.length) throw new Error('A variation family must contain measurements.');
  const target = Math.min(policy.targetLufs, ...measurements.map(measurement =>
    measurement.integratedLufs + Math.min(policy.maxBoostDb, headroom(measurement, policy))));
  if (!Number.isFinite(target)) throw new Error('Variation family contains an invalid loudness measurement.');
  // Round down so every take, including both codec versions, has enough headroom.
  return Math.floor((target + 1e-9) * 10) / 10;
}

export function calibrateLoudness(measurement, policy = LOUDNESS_POLICY) {
  const { integratedLufs, truePeakDbtp } = measurement;
  if (![integratedLufs, truePeakDbtp, policy.targetLufs, policy.maxBoostDb, policy.ceilingDbtp].every(Number.isFinite)) {
    throw new Error('Loudness calibration requires finite measured LUFS, true peak and policy values.');
  }
  const effectiveTargetLufs = measurement.effectiveTargetLufs ?? policy.targetLufs;
  if (!Number.isFinite(effectiveTargetLufs) || effectiveTargetLufs > policy.targetLufs + 1e-7) {
    throw new Error('An effective family target must not exceed the reference target.');
  }
  const desired = effectiveTargetLufs - integratedLufs;
  const peakLimit = headroom(measurement, policy);
  const gainDb = Math.min(desired, policy.maxBoostDb, peakLimit);
  const limitedBy = [];
  if (gainDb < desired - 1e-7) {
    if (Math.abs(gainDb - policy.maxBoostDb) < 1e-7) limitedBy.push('boost-limit');
    if (Math.abs(gainDb - peakLimit) < 1e-7) limitedBy.push('true-peak');
  }
  const roleDb = 20 * Math.log10(measurement.maxProfileGain);
  return { gainDb, scale: 10 ** (gainDb / 20), predictedLufs: integratedLufs + gainDb,
    predictedTruePeakDbtp: truePeakDbtp + gainDb,
    predictedVoiceLufs: integratedLufs + gainDb + roleDb,
    predictedVoiceTruePeakDbtp: truePeakDbtp + gainDb + roleDb, limitedBy };
}

export function waveformStats(bytes) {
  if (bytes.length % 4) throw new Error('Decoded float audio has an incomplete sample.');
  let peak = 0, sum = 0;
  const count = bytes.length / 4;
  for (let offset = 0; offset < bytes.length; offset += 4) {
    const value = bytes.readFloatLE(offset);
    if (!Number.isFinite(value)) throw new Error('Decoded audio has a non-finite sample.');
    peak = Math.max(peak, Math.abs(value)); sum += value * value;
  }
  if (!count || !peak) throw new Error('Decoded audio is silent or empty.');
  return { samplePeakDbfs: 20 * Math.log10(peak), rmsDbfs: 10 * Math.log10(sum / count) };
}

export function decodedWaveStats(bytes, attenuation = .25) {
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') throw new Error('Expected decoded RIFF/WAVE audio.');
  let bits, data;
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const id = bytes.toString('ascii', offset, offset + 4), length = bytes.readUInt32LE(offset + 4);
    if (id === 'fmt ') bits = bytes.readUInt16LE(offset + 22);
    if (id === 'data') { data = bytes.subarray(offset + 8, Math.min(bytes.length, offset + 8 + length)); break; }
    offset += 8 + length + (length % 2);
  }
  if (bits !== 24 || !data || data.length % 3 || !Number.isFinite(attenuation) || attenuation <= 0) throw new Error('Expected complete PCM24 decoded samples.');
  let peak = 0, sum = 0;
  const count = data.length / 3;
  for (let offset = 0; offset < data.length; offset += 3) {
    const integer = data.readIntLE(offset, 3);
    if (Math.abs(integer) >= 8388607) throw new Error('Waveform measurement exhausted its decoding headroom.');
    const value = integer / 8388608 / attenuation;
    peak = Math.max(peak, Math.abs(value)); sum += value * value;
  }
  if (!count || !peak) throw new Error('Decoded audio is silent or empty.');
  return { samplePeakDbfs: 20 * Math.log10(peak), rmsDbfs: 10 * Math.log10(sum / count) };
}

export function levelSpread(values) {
  if (!values.length) return null;
  return Math.max(...values) - Math.min(...values);
}

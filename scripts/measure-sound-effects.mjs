// Measure prepared assets and write playback gains; never rewrite any audio.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SOUND_FILES, SOUND_PROFILES } from '../public/sound-catalog.js';
import { COLONY_SOUND_FILES, COLONY_SOUND_PROFILES } from '../public/colony-sound-catalog.js';
import { LOUDNESS_POLICY, calibrateLoudness, achievableFamilyTarget, decodedWaveStats, levelSpread } from './lib/sound-loudness.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const audioRoot = path.join(root, 'public/audio/effects');
const policy = { ...LOUDNESS_POLICY };
let ffmpegArgument, check = false, fresh = false, modeOption = 'all';
const usage = 'Usage: node scripts/measure-sound-effects.mjs [--mode all|combat|colony] [--target <LUFS>] [--max-boost <dB>] [--ceiling <dBTP>] [--ffmpeg <path>] [--fresh] [--check]';
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  const option = args[i];
  if (option === '--help') { console.log(usage); process.exit(0); }
  if (option === '--check') { check = true; continue; }
  if (option === '--fresh') { fresh = true; continue; }
  if (['--target', '--max-boost', '--ceiling', '--ffmpeg', '--mode'].includes(option) && args[i + 1] !== undefined) {
    const value = args[++i];
    if (option === '--ffmpeg') ffmpegArgument = value;
    else if (option === '--mode') modeOption = value;
    else policy[{ '--target': 'targetLufs', '--max-boost': 'maxBoostDb', '--ceiling': 'ceilingDbtp' }[option]] = Number(value);
  } else throw new Error(usage);
}
if (!Object.values(policy).every(Number.isFinite) || policy.targetLufs < -70 || policy.targetLufs > -5 ||
    policy.maxBoostDb < 0 || policy.maxBoostDb > 48 || policy.ceilingDbtp < -9 || policy.ceilingDbtp > 0) {
  throw new Error('Choose target -70..-5 LUFS, maximum boost 0..48 dB and ceiling -9..0 dBTP.');
}
if (check && fresh) throw new Error('--check is read-only; --fresh requests new measurements.');
if (!['all', 'combat', 'colony'].includes(modeOption)) throw new Error('--mode must be all, combat or colony.');

const allModes = [
  { name: 'generated', files: [...new Set(Object.values(SOUND_FILES))].sort(), profiles: SOUND_PROFILES },
  { name: 'colony', files: [...COLONY_SOUND_FILES].sort(), profiles: COLONY_SOUND_PROFILES },
];
const modes = allModes.filter(mode => modeOption === 'all' || mode.name === (modeOption === 'combat' ? 'generated' : 'colony'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const round = value => Number(value.toFixed(6));
const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-5;

function run(ffmpeg, options, binary = false) {
  const result = spawnSync(ffmpeg, options, { encoding: binary ? undefined : 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(String(result.stderr || result.error?.message || 'FFmpeg failed'));
  return result;
}
function resolveFfmpeg() {
  if (ffmpegArgument || process.env.FFMPEG_PATH) return ffmpegArgument || process.env.FFMPEG_PATH;
  if (spawnSync('ffmpeg', ['-version'], { windowsHide: true }).status === 0) return 'ffmpeg';
  const packages = path.join(root, 'video/node_modules/.pnpm');
  if (existsSync(packages)) for (const name of readdirSync(packages).filter(n => n.startsWith('@remotion+compositor-win32-x64-msvc@')).sort().reverse()) {
    const candidate = path.join(packages, name, 'node_modules/@remotion/compositor-win32-x64-msvc/ffmpeg.exe');
    if (existsSync(candidate)) return candidate;
  }
  throw new Error('FFmpeg with loudnorm is required. Use --ffmpeg <path> or FFMPEG_PATH.');
}
function measure(ffmpeg, filename) {
  const source = path.join(audioRoot, filename);
  // Only input_* metrics are retained. The normalized filter output is discarded.
  const result = run(ffmpeg, ['-hide_banner', '-nostats', '-nostdin', '-i', source, '-vn', '-sn', '-dn',
    '-af', 'loudnorm=I=-18:TP=-2:LRA=11:print_format=json', '-f', 'null', '-']);
  const match = String(result.stderr).match(/\{\s*"input_i"[\s\S]*?\}/);
  if (!match) throw new Error(filename + ': FFmpeg returned no loudnorm input measurements.');
  const raw = JSON.parse(match[0]);
  const measurement = { integratedLufs: Number(raw.input_i), truePeakDbtp: Number(raw.input_tp),
    loudnessRangeLu: Number(raw.input_lra), gateThresholdLufs: Number(raw.input_thresh) };
  if (!Object.values(measurement).every(Number.isFinite)) {
    throw new Error(filename + ': loudness is undefined/silent or too short for gated measurement; review this recording explicitly.');
  }
  const decoded = run(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-nostdin', '-i', source,
    '-vn', '-sn', '-dn', '-af', 'volume=0.25', '-c:a', 'pcm_s24le', '-f', 'wav', 'pipe:1'], true);
  // The bundled encoder has PCM24 rather than float output. Decode with 12 dB
  // headroom and undo that scale in the measurement, never in a runtime file.
  return { ...measurement, ...decodedWaveStats(decoded.stdout) };
}
function entriesFor(mode) {
  const manifest = JSON.parse(readFileSync(path.join(audioRoot, mode.name, 'manifest.json'), 'utf8'));
  const entries = new Map(manifest.files.map(entry => [entry.file, entry]));
  return mode.files.flatMap(file => {
    const entry = entries.get(path.basename(file));
    if (!entry) throw new Error(file + ': missing from preparation manifest. Rebuild runtime assets first.');
    const sourceSha256 = sha256(readFileSync(path.join(root, entry.source)));
    if (sourceSha256 !== entry.sourceSha256) throw new Error(entry.source + ': source changed; rebuild runtime assets before measuring.');
    return [
      { file, expectedHash: entry.outputSha256, source: entry.source, sourceSha256 },
      { file: mode.name + '/' + entry.fallbackFile, expectedHash: entry.fallbackSha256, source: entry.source, sourceSha256 },
    ].map(item => {
      const contentSha256 = sha256(readFileSync(path.join(audioRoot, item.file)));
      if (contentSha256 !== item.expectedHash) throw new Error(item.file + ': runtime export does not match preparation manifest. Rebuild it first.');
      const maxProfileGain = Math.max(...Object.values(mode.profiles)
        .filter(profile => (profile.files || [profile.file]).includes(file)).map(profile => profile.gain));
      if (!Number.isFinite(maxProfileGain) || maxProfileGain <= 0) throw new Error(file + ': invalid catalogue gain.');
      return { file: item.file, contentSha256, source: item.source, sourceSha256, maxProfileGain };
    });
  });
}
function variantGroups(mode, levels) {
  return Object.entries(mode.profiles).flatMap(([kind, profile]) => {
    const files = profile.files || [profile.file];
    if (files.length < 2) return [];
    return ['ogg', 'wav'].map(extension => {
      const takes = files.map(file => levels[file.replace(/\.ogg$/, '.' + extension)]);
      const old = takes.map(take => take.integratedLufs + 20 * Math.log10(.8) - take.samplePeakDbfs);
      return { mode: mode.name, kind, extension, takes: takes.length, effectiveTargetLufs: takes[0].effectiveTargetLufs,
        rawSpreadLu: round(levelSpread(takes.map(take => take.integratedLufs))),
        previousPeakNormalizedSpreadLu: round(levelSpread(old)), calibratedSpreadLu: round(levelSpread(takes.map(take => take.predictedLufs))) };
    });
  });
}
function effectiveTargets(mode, measurements) {
  const targets = Object.fromEntries(Object.keys(measurements).map(file => [file, policy.targetLufs]));
  for (const profile of Object.values(mode.profiles)) {
    if (!profile.files || profile.files.length < 2) continue;
    const filenames = profile.files.flatMap(file => [file, file.replace(/\.ogg$/, '.wav')]);
    const target = achievableFamilyTarget(filenames.map(file => measurements[file]), policy);
    for (const file of filenames) targets[file] = Math.min(targets[file], target);
  }
  return targets;
}
function renderModule(levels) {
  return '// Generated by scripts/measure-sound-effects.mjs. Gain metadata only; audio files are unchanged.\n' +
    'export const SOUND_LEVELS = Object.freeze(Object.fromEntries(Object.entries(' + JSON.stringify(levels, null, 2) +
    ').map(([file, level]) => [file, Object.freeze(level)])));\n';
}

const ffmpeg = check ? null : resolveFfmpeg();
const analyzer = check ? null : String(run(ffmpeg, ['-version']).stdout).split(/\r?\n/)[0];
const complete = [];
for (const mode of modes) {
  const output = path.join(audioRoot, mode.name), jsonPath = path.join(output, 'loudness.json');
  const previous = existsSync(jsonPath) ? JSON.parse(readFileSync(jsonPath, 'utf8')) : null;
  const entries = entriesFor(mode), levels = {};
  if (check) {
    if (!previous || previous.schemaVersion !== 1 || JSON.stringify(previous.policy) !== JSON.stringify(policy)) {
      throw new Error(mode.name + ': missing/stale calibration policy; run the measurement script.');
    }
    if (JSON.stringify(Object.keys(previous.levels).sort()) !== JSON.stringify(entries.map(entry => entry.file).sort())) {
      throw new Error(mode.name + ': calibration coverage does not match the active catalogue.');
    }
    for (const entry of entries) {
      const value = previous.levels[entry.file], expected = calibrateLoudness(value, policy);
      if (entry.contentSha256 !== value.contentSha256 || entry.sourceSha256 !== value.sourceSha256) throw new Error(entry.file + ': stale measurement hashes.');
      if (!near(entry.maxProfileGain, value.maxProfileGain)) throw new Error(entry.file + ': catalogue gain changed; recalibrate.');
      for (const field of ['gainDb', 'scale', 'predictedLufs', 'predictedTruePeakDbtp', 'predictedVoiceLufs', 'predictedVoiceTruePeakDbtp']) {
        if (!near(value[field], expected[field])) throw new Error(entry.file + ': invalid ' + field);
      }
      if (JSON.stringify(value.limitedBy) !== JSON.stringify(expected.limitedBy)) throw new Error(entry.file + ': incorrect limiting reason.');
    }
    const targets = effectiveTargets(mode, previous.levels);
    for (const [file, target] of Object.entries(targets)) if (!near(target, previous.levels[file].effectiveTargetLufs)) throw new Error(file + ': stale variation-family target.');
    if (readFileSync(path.join(output, 'loudness.js'), 'utf8') !== renderModule(previous.levels)) throw new Error(mode.name + ': runtime calibration module differs from the report.');
    console.log('Verified ' + mode.name + ': ' + entries.length + ' codec measurements, active coverage, source/export hashes and calibration limits.');
    continue;
  }
  let measured = 0;
  for (const entry of entries) {
    const cached = !fresh && previous?.analyzer === analyzer && previous?.levels?.[entry.file];
    const measurement = cached?.contentSha256 === entry.contentSha256 ? {
      integratedLufs: cached.integratedLufs, truePeakDbtp: cached.truePeakDbtp, loudnessRangeLu: cached.loudnessRangeLu,
      gateThresholdLufs: cached.gateThresholdLufs, samplePeakDbfs: cached.samplePeakDbfs, rmsDbfs: cached.rmsDbfs,
    } : measure(ffmpeg, entry.file);
    levels[entry.file] = { ...entry, ...Object.fromEntries(Object.entries(measurement).map(([key, value]) => [key, round(value)])) };
    if (++measured % 24 === 0 || measured === entries.length) console.log(mode.name + ': measured ' + measured + '/' + entries.length);
  }
  const targets = effectiveTargets(mode, levels);
  for (const [file, measurement] of Object.entries(levels)) {
    Object.assign(measurement, { targetLufs: policy.targetLufs, effectiveTargetLufs: targets[file], peakCeilingDbtp: policy.ceilingDbtp });
    const calibration = calibrateLoudness(measurement, policy);
    Object.assign(measurement, Object.fromEntries(Object.entries(calibration).map(([key, value]) => [key, typeof value === 'number' ? round(value) : value])));
  }
  const report = { schemaVersion: 1, method: 'FFmpeg loudnorm input integrated loudness and true peak; independent fixed playback gain per prepared codec file',
    analyzer, policy, description: 'Static gain replaces peak normalization before catalogue gain, distance attenuation and master volume. True-peak ceiling applies after the largest catalogue gain for that file. Multi-take families share an achievable target across both codecs. No compression or audio-file changes.',
    levels, variantGroups: variantGroups(mode, levels), limitedFiles: Object.values(levels).filter(level => level.limitedBy.length).map(level => level.file) };
  mkdirSync(output, { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(report, null, 2) + '\n');
  writeFileSync(path.join(output, 'loudness.js'), renderModule(levels));
  complete.push(report);
}
if (!check) {
  const reports = allModes.map(mode => {
    const file = path.join(audioRoot, mode.name, 'loudness.json');
    return existsSync(file) ? { mode: mode.name, ...JSON.parse(readFileSync(file, 'utf8')) } : null;
  }).filter(Boolean);
  const rows = reports.flatMap(report => Object.values(report.levels));
  const combined = { schemaVersion: 1, policy, modePolicies: Object.fromEntries(reports.map(report => [report.mode, report.policy])),
    analyzer, levels: Object.assign({}, ...reports.map(report => report.levels)), variantGroups: reports.flatMap(report => report.variantGroups),
    limitedFiles: reports.flatMap(report => report.limitedFiles) };
  writeFileSync(path.join(root, 'docs/audio-loudness.json'), JSON.stringify(combined, null, 2) + '\n');
  const columns = ['file', 'integratedLufs', 'samplePeakDbfs', 'truePeakDbtp', 'rmsDbfs', 'maxProfileGain', 'effectiveTargetLufs', 'gainDb', 'predictedLufs', 'predictedTruePeakDbtp', 'predictedVoiceLufs', 'predictedVoiceTruePeakDbtp', 'limitedBy'];
  const csvCell = value => '"' + String(Array.isArray(value) ? value.join('|') : value).replaceAll('"', '""') + '"';
  writeFileSync(path.join(root, 'docs/audio-loudness.csv'), [columns.join(','), ...rows.map(row => columns.map(column => csvCell(row[column])).join(','))].join('\n') + '\n');
  console.log('Calibrated ' + complete.reduce((sum, report) => sum + Object.keys(report.levels).length, 0) + ' codec files across ' + modes.reduce((sum, mode) => sum + mode.files.length, 0) + ' active recordings. Audio bytes are unchanged.');
}
